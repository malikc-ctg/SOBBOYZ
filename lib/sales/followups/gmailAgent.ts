/**
 * Multi-Rep Gmail OAuth, Auto-Sender (15-30 min buffer for No-Answer Drip),
 * and Inbox Scanner + Reminder Engine powered by Claude Sonnet 5.5.
 */

import { createServiceClient } from '@/lib/supabase/server';
import { SALES_REP_LIST, resolveRepConfig, SalesRepConfig } from './config';
import { draftDossierEmailWithClaude } from './aiDrafter';
import { runEngineForTaskAction, runEngineForLeadSignal } from './executor';
import { callClaudeSonnet, extractJsonFromClaude, getFollowupSystemSecrets } from './claudeClient';
import { sendWebPush } from '@/lib/web-push';
import { Resend } from 'resend';

export const AUTO_SEND_DELAY_MINUTES = 0; // Auto-send immediately when marked No Answer

export interface StoredGmailOAuth {
  rep_id: string;
  rep_key: string;
  rep_name: string;
  gmail_address: string;
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
  connected_at: string;
  last_inbox_scan_at?: string;
}

export interface InboxAlertItem {
  id: string;
  lead_id: string | null;
  lead_name: string;
  company_name: string;
  rep_id: string;
  rep_name: string;
  rep_email: string;
  from_email: string;
  subject: string;
  snippet: string;
  classification:
    | 'interested'
    | 'question'
    | 'out_of_office'
    | 'referral'
    | 'not_interested'
    | 'unanswered_reminder';
  ai_summary: string;
  ai_suggested_reply?: string;
  ooo_return_date?: string | null;
  referral_contact?: {
    name?: string;
    title?: string;
    email?: string;
    phone?: string;
  } | null;
  gmail_message_id: string;
  gmail_thread_id?: string;
  status: 'unread' | 'resolved' | 'dismissed';
  created_at: string;
}

/**
 * Generates Google OAuth 2.0 authorization URL for a Sales Rep.
 */
export async function getGmailOAuthUrl(repIdentifier: string, redirectUri: string): Promise<string> {
  const secrets = await getFollowupSystemSecrets();
  const rep = resolveRepConfig(repIdentifier);
  const statePayload = Buffer.from(
    JSON.stringify({
      rep_id: rep.auth_user_id,
      rep_key: rep.key,
      gmail_address: rep.gmail_address,
    })
  ).toString('base64url');

  const params = new URLSearchParams({
    client_id: secrets.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    login_hint: rep.gmail_address,
    scope: [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' '),
    state: statePayload,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchanges OAuth authorization code for tokens and persists them in Supabase.
 */
export async function exchangeGmailCodeAndSave(
  code: string,
  stateBase64: string,
  redirectUri: string
): Promise<StoredGmailOAuth> {
  const secrets = await getFollowupSystemSecrets();
  let stateObj: any = {};
  try {
    stateObj = JSON.parse(Buffer.from(stateBase64, 'base64url').toString('utf8'));
  } catch {
    // fallback to Malik
  }

  const rep = resolveRepConfig(stateObj.rep_id || stateObj.rep_key || 'malik');

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: secrets.GOOGLE_CLIENT_ID,
      client_secret: secrets.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text().catch(() => '');
    throw new Error(`Google token exchange failed: ${errText}`);
  }

  const tokenData = await tokenRes.json();

  // Verify the connected user's email address
  let connectedEmail = rep.gmail_address;
  try {
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    if (profileRes.ok) {
      const profileJson = await profileRes.json();
      if (profileJson.email) connectedEmail = profileJson.email;
    }
  } catch {
    // ignore
  }

  const supabase = await createServiceClient();

  // Check if we already had a refresh_token stored
  const existing = await getRepGmailOAuth(rep.auth_user_id!);

  const stored: StoredGmailOAuth = {
    rep_id: rep.auth_user_id!,
    rep_key: rep.key,
    rep_name: rep.name,
    gmail_address: connectedEmail,
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token || existing?.refresh_token,
    expiry_date: Date.now() + (tokenData.expires_in || 3599) * 1000,
    connected_at: new Date().toISOString(),
    last_inbox_scan_at: existing?.last_inbox_scan_at,
  };

  await supabase.from('sales_followup_processed_events').upsert({
    event_id: rep.auth_user_id!,
    lead_id: null,
    outcome_type: 'GMAIL_OAUTH',
    summary: stored,
    processed_at: new Date().toISOString(),
  });

  // Also update gmail_address in sales_rep_followup_settings
  await supabase
    .from('sales_rep_followup_settings')
    .update({
      gmail_address: connectedEmail,
      updated_at: new Date().toISOString(),
    })
    .eq('rep_id', rep.auth_user_id!);

  return stored;
}

/**
 * Retrieves stored Gmail OAuth record for a rep and refreshes the access_token if expired.
 */
export async function getRepGmailOAuth(repIdentifier?: string | null): Promise<StoredGmailOAuth | null> {
  const rep = resolveRepConfig(repIdentifier);
  if (!rep.auth_user_id) return null;

  const supabase = await createServiceClient();
  const { data } = await supabase
    .from('sales_followup_processed_events')
    .select('*')
    .eq('event_id', rep.auth_user_id)
    .eq('outcome_type', 'GMAIL_OAUTH')
    .maybeSingle();

  if (!data?.summary?.access_token) return null;

  const stored = data.summary as StoredGmailOAuth;

  // Refresh if expiring within 2 minutes
  const secrets = await getFollowupSystemSecrets();
  if (
    stored.refresh_token &&
    stored.expiry_date &&
    Date.now() > stored.expiry_date - 2 * 60 * 1000 &&
    secrets.GOOGLE_CLIENT_ID &&
    secrets.GOOGLE_CLIENT_SECRET
  ) {
    try {
      const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: secrets.GOOGLE_CLIENT_ID,
          client_secret: secrets.GOOGLE_CLIENT_SECRET,
          refresh_token: stored.refresh_token,
          grant_type: 'refresh_token',
        }),
      });
      if (refreshRes.ok) {
        const refreshData = await refreshRes.json();
        stored.access_token = refreshData.access_token;
        stored.expiry_date = Date.now() + (refreshData.expires_in || 3599) * 1000;
        await supabase.from('sales_followup_processed_events').upsert({
          event_id: rep.auth_user_id,
          lead_id: null,
          outcome_type: 'GMAIL_OAUTH',
          summary: stored,
          processed_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn('[gmailAgent] Failed to refresh Gmail access token:', err);
    }
  }

  return stored;
}

/**
 * Returns connection status for all 3 reps (Malik, Raahim, Ayaan).
 */
export async function getAllRepsGmailStatus() {
  const statuses = [];
  for (const rep of SALES_REP_LIST) {
    const oauth = await getRepGmailOAuth(rep.auth_user_id);
    statuses.push({
      key: rep.key,
      rep_id: rep.auth_user_id,
      name: rep.name,
      title: rep.title,
      email: oauth?.gmail_address || rep.gmail_address,
      connected: Boolean(oauth?.access_token),
      connected_at: oauth?.connected_at || null,
      last_inbox_scan_at: oauth?.last_inbox_scan_at || null,
    });
  }
  return statuses;
}

/**
 * Sends a plain-text email through the Rep's connected Gmail account (or Resend fallback).
 */
export async function sendEmailViaRepGmail(options: {
  repIdentifier?: string | null;
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyToMessageId?: string;
}): Promise<{
  sent: boolean;
  channel: 'gmail_api' | 'resend';
  messageId?: string;
  threadId?: string;
  from: string;
}> {
  const rep = resolveRepConfig(options.repIdentifier);
  const oauth = await getRepGmailOAuth(rep.auth_user_id);

  // 1. Send via Rep's connected Gmail API if OAuth is connected
  if (oauth?.access_token) {
    const fromHeader = `${rep.name} <${oauth.gmail_address}>`;
    const encodedSubject = `=?UTF-8?B?${Buffer.from(options.subject, 'utf8').toString('base64')}?=`;
    const mimeLines = [
      `From: ${fromHeader}`,
      `To: ${options.to}`,
      `Subject: ${encodedSubject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 8bit',
    ];
    if (options.inReplyToMessageId) {
      mimeLines.push(`In-Reply-To: ${options.inReplyToMessageId}`);
      mimeLines.push(`References: ${options.inReplyToMessageId}`);
    }
    mimeLines.push('', options.body);

    const rawMime = Buffer.from(mimeLines.join('\r\n'), 'utf8').toString('base64url');
    const sendPayload: Record<string, any> = { raw: rawMime };
    if (options.threadId) sendPayload.threadId = options.threadId;

    const sendRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${oauth.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sendPayload),
    });

    if (sendRes.ok) {
      const sentJson = await sendRes.json();
      return {
        sent: true,
        channel: 'gmail_api',
        messageId: sentJson.id,
        threadId: sentJson.threadId,
        from: oauth.gmail_address,
      };
    } else {
      const errText = await sendRes.text().catch(() => '');
      console.warn('[gmailAgent] Gmail API send failed, falling back to Resend:', errText);
    }
  }

  // 2. Fallback: Send via Resend impersonating the rep's name & reply-to address
  const secrets = await getFollowupSystemSecrets();
  const resendKey = secrets.RESEND_API_KEY || process.env.RESEND_API_KEY;
  if (!resendKey) {
    throw new Error('Neither Rep Gmail OAuth nor RESEND_API_KEY is available to send email.');
  }

  const resend = new Resend(resendKey);
  const { data, error } = await resend.emails.send({
    from: `${rep.name} <${rep.gmail_address}>`,
    replyTo: rep.gmail_address,
    to: options.to,
    subject: options.subject,
    text: options.body,
  });

  if (error) {
    // Secondary fallback to info@seaofblue.app if rep address isn't verified in Resend
    const retry = await resend.emails.send({
      from: `${rep.name} (Sea of Blue) <info@seaofblue.app>`,
      replyTo: rep.gmail_address,
      to: options.to,
      subject: options.subject,
      text: options.body,
    });
    if (retry.error) {
      throw new Error(`Email send failed: ${retry.error.message}`);
    }
    return {
      sent: true,
      channel: 'resend',
      messageId: retry.data?.id,
      from: rep.gmail_address,
    };
  }

  return {
    sent: true,
    channel: 'resend',
    messageId: data?.id,
    from: rep.gmail_address,
  };
}

/**
 * Computes the exact timestamp when a no_answer_drip task will auto-send.
 * For drip_email_1: 20 minutes after task creation.
 * For drip_email_2..4: the scheduled due_at time (9:00 AM Toronto time on Days 4, 9, 14).
 */
export function getTaskAutoSendAt(task: {
  step_key?: string;
  due_at: string;
  created_at: string;
}): Date {
  const dueMs = new Date(task.due_at).getTime();
  if (task.step_key === 'drip_email_1') {
    const createdMs = new Date(task.created_at).getTime();
    return new Date(Math.max(dueMs, createdMs + AUTO_SEND_DELAY_MINUTES * 60 * 1000));
  }
  return new Date(dueMs);
}

/**
 * Runs the Hybrid Follow-Up Agent:
 * 1. Auto-sends due `no_answer_drip` emails (respecting the 20-minute buffer on drip_email_1).
 * 2. Pre-drafts pending warm sequence emails with Claude Sonnet 5.5 so they are waiting for Rep Approval.
 */
export async function runNoAnswerAutoSender(options: {
  forceTaskId?: string;
  leadId?: string;
  limit?: number;
} = {}) {
  const supabase = await createServiceClient();
  const now = new Date();
  const maxItems = options.limit || 10;

  let query = supabase
    .from('sales_followup_tasks')
    .select('*, sales_followup_enrollments!inner(*)')
    .eq('status', 'pending')
    .eq('kind', 'email')
    .order('due_at', { ascending: true })
    .limit(50);

  if (options.forceTaskId) {
    query = supabase
      .from('sales_followup_tasks')
      .select('*, sales_followup_enrollments!inner(*)')
      .eq('id', options.forceTaskId)
      .eq('status', 'pending');
  } else if (options.leadId) {
    query = supabase
      .from('sales_followup_tasks')
      .select('*, sales_followup_enrollments!inner(*)')
      .eq('lead_id', options.leadId)
      .eq('status', 'pending')
      .eq('kind', 'email')
      .order('due_at', { ascending: true });
  }

  const { data: pendingTasks } = await query;

  const autoSent: Array<{ taskId: string; leadId: string; to: string; subject: string; rep: string; channel: string }> = [];
  const preDraftedWarm: Array<{ taskId: string; leadId: string; subject: string }> = [];
  const skipped: Array<{ taskId: string; reason: string }> = [];

  for (const task of pendingTasks || []) {
    if (autoSent.length + preDraftedWarm.length >= maxItems) break;

    const enrollment = task.sales_followup_enrollments;
    if (!enrollment || enrollment.status !== 'active') continue;

    // Check lead & flags
    const { data: lead } = await supabase
      .from('leads')
      .select('id, customer_name, customer_email, company_name, status')
      .eq('id', task.lead_id)
      .maybeSingle();

    if (!lead?.customer_email || !lead.customer_email.includes('@')) {
      skipped.push({ taskId: task.id, reason: 'missing_email' });
      continue;
    }

    const { data: flags } = await supabase
      .from('sales_lead_flags')
      .select('*')
      .eq('lead_id', task.lead_id)
      .maybeSingle();

    if (flags?.email_opt_out_at || flags?.bounced_email || flags?.do_not_contact_at) {
      skipped.push({ taskId: task.id, reason: 'lead_flagged_opt_out_or_bounced' });
      continue;
    }

    const isNoAnswerDrip = enrollment.sequence_key === 'no_answer_drip';
    const autoSendCancelled = Boolean(enrollment.context?.auto_send_cancelled?.[task.step_key]);

    if (isNoAnswerDrip && !autoSendCancelled) {
      const autoSendAt = getTaskAutoSendAt(task);
      const isReadyToAutoSend = Boolean(options.forceTaskId) || autoSendAt.getTime() <= now.getTime();

      if (!isReadyToAutoSend) {
        // Pre-draft during the 20-minute buffer so the rep can preview/edit it before it auto-sends!
        if (!task.rendered_subject || !task.rendered_body) {
          try {
            await draftDossierEmailWithClaude({
              leadId: task.lead_id,
              taskId: task.id,
              templateKey: task.template_key,
              repIdentifier: task.assigned_rep_id || enrollment.owner_rep_id,
            });
            preDraftedWarm.push({
              taskId: task.id,
              leadId: task.lead_id,
              subject: 'Pre-drafted during 20m auto-send buffer',
            });
          } catch (err) {
            console.warn('[AutoSender] Pre-draft failed:', err);
          }
        }
        continue;
      }

      // Ready to Auto-Send!
      try {
        const draft = await draftDossierEmailWithClaude({
          leadId: task.lead_id,
          taskId: task.id,
          templateKey: task.template_key,
          repIdentifier: task.assigned_rep_id || enrollment.owner_rep_id,
        });

        const sendResult = await sendEmailViaRepGmail({
          repIdentifier: task.assigned_rep_id || enrollment.owner_rep_id,
          to: lead.customer_email.trim(),
          subject: draft.subject,
          body: draft.body,
        });

        const nowIso = new Date().toISOString();
        const repConfig = resolveRepConfig(task.assigned_rep_id || enrollment.owner_rep_id);

        await supabase
          .from('sales_followup_tasks')
          .update({
            completed_at: nowIso,
            completed_by: repConfig.auth_user_id,
            sent_to: lead.customer_email.trim(),
            rendered_subject: draft.subject,
            rendered_body: draft.body,
            updated_at: nowIso,
          })
          .eq('id', task.id)
          .eq('status', 'pending');

        await runEngineForTaskAction(
          task.id,
          'sent',
          repConfig.auth_user_id || 'system',
          {
            to: lead.customer_email.trim(),
            subject: draft.subject,
            body: draft.body,
          }
        );

        autoSent.push({
          taskId: task.id,
          leadId: task.lead_id,
          to: lead.customer_email.trim(),
          subject: draft.subject,
          rep: draft.rep.name,
          channel: sendResult.channel,
        });
      } catch (err: any) {
        console.error('[AutoSender] Failed to auto-send task', task.id, err);
        skipped.push({ taskId: task.id, reason: err?.message || 'send_error' });
      }
    } else {
      // Warm Sequence Task: Never auto-send; pre-draft with Claude Sonnet 5.5 for Rep Approval
      if (!task.rendered_subject || !task.rendered_body) {
        try {
          const draft = await draftDossierEmailWithClaude({
            leadId: task.lead_id,
            taskId: task.id,
            templateKey: task.template_key,
            repIdentifier: task.assigned_rep_id || enrollment.owner_rep_id,
          });
          preDraftedWarm.push({
            taskId: task.id,
            leadId: task.lead_id,
            subject: draft.subject,
          });
        } catch (err: any) {
          skipped.push({ taskId: task.id, reason: err?.message || 'warm_draft_error' });
        }
      }
    }
  }

  return {
    autoSent,
    preDraftedWarm,
    skipped,
    timestamp: now.toISOString(),
  };
}

const INBOX_CLASSIFIER_SYSTEM_PROMPT = `You are the Sales Inbox Intelligence Agent for Sea of Blue Inc. (Malik Campbell, Raahim Ahmed, and Ayaan Baig).
Analyze an incoming email from a construction prospect and classify it so our follow-up engine can update the lead dossier and alert the rep.

STRICT RULES:
1. NEVER use em-dashes (—) or en-dashes (–).
2. Return ONLY valid JSON matching this schema:
{
  "classification": "interested" | "question" | "out_of_office" | "referral" | "not_interested",
  "ai_summary": "1 concise sentence summarizing what the prospect said and what the rep needs to do",
  "ai_suggested_reply": "Plain contractor reply body (under 70 words, no greeting or signature, no em-dashes) if a reply is appropriate, else null",
  "ooo_return_date": "ISO date YYYY-MM-DD if Out of Office return date is stated, else null",
  "referral_contact": {
    "name": "Referred person's name if they pointed us to a colleague",
    "title": "Their role/title if mentioned",
    "email": "Their email if mentioned",
    "phone": "Their phone if mentioned"
  } or null
}`;

function extractEmailAddress(headerVal: string): string {
  const m = String(headerVal || '').match(/<([^>]+)>/);
  return (m ? m[1] : headerVal || '').trim().toLowerCase();
}

function decodeGmailBody(payload: any): string {
  if (!payload) return '';
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf8');
  }
  if (Array.isArray(payload.parts)) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return Buffer.from(part.body.data, 'base64url').toString('utf8');
      }
    }
    for (const part of payload.parts) {
      const nested = decodeGmailBody(part);
      if (nested) return nested;
    }
  }
  return '';
}

/**
 * Scans connected Gmail inboxes for Malik, Raahim, and Ayaan:
 * - Detects replies from leads in the database
 * - Runs Claude Sonnet 5.5 classification (Interested, Question, OOO, Referral, Not Interested)
 * - Automatically pauses/stops No-Answer Drips via runEngineForLeadSignal()
 * - Checks for overdue unanswered threads / follow-ups
 * - Sends All-Channel Reminders (Web Push + Resend Email Digest + Touch Centre Alert Banner)
 */
export async function scanRepInboxesAndRemind(options: { sendEmailDigest?: boolean } = {}) {
  const supabase = await createServiceClient();

  // 1. Index all leads by email and domain for O(1) matching
  const { data: allLeads } = await supabase
    .from('leads')
    .select('id, customer_name, customer_email, company_name, contact_title, city');

  const leadByEmail = new Map<string, any>();
  const leadsByDomain = new Map<string, any[]>();

  for (const l of allLeads || []) {
    const email = String(l.customer_email || '').trim().toLowerCase();
    if (email && email.includes('@')) {
      leadByEmail.set(email, l);
      const domain = email.split('@')[1];
      if (domain && !['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'icloud.com'].includes(domain)) {
        if (!leadsByDomain.has(domain)) leadsByDomain.set(domain, []);
        leadsByDomain.get(domain)!.push(l);
      }
    }
  }

  // 2. Load existing processed inbox alerts to avoid duplicate processing
  const { data: existingAlerts } = await supabase
    .from('sales_followup_processed_events')
    .select('event_id, summary')
    .eq('outcome_type', 'INBOX_ALERT')
    .order('processed_at', { ascending: false })
    .limit(500);

  const processedMsgIds = new Set<string>();
  for (const a of existingAlerts || []) {
    if (a.summary?.gmail_message_id) {
      processedMsgIds.add(a.summary.gmail_message_id);
    }
  }

  const newAlerts: InboxAlertItem[] = [];

  // 3. Scan each rep's connected Gmail inbox
  for (const rep of SALES_REP_LIST) {
    const oauth = await getRepGmailOAuth(rep.auth_user_id);
    if (!oauth?.access_token) continue;

    try {
      const q = encodeURIComponent('newer_than:7d -from:me category:primary');
      const listRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=25`,
        {
          headers: { Authorization: `Bearer ${oauth.access_token}` },
        }
      );

      if (!listRes.ok) continue;
      const listJson = await listRes.json();
      const messages = listJson.messages || [];

      for (const m of messages) {
        if (processedMsgIds.has(m.id)) continue;

        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=full`,
          {
            headers: { Authorization: `Bearer ${oauth.access_token}` },
          }
        );
        if (!msgRes.ok) continue;
        const msgData = await msgRes.json();

        const headers: Array<{ name: string; value: string }> = msgData.payload?.headers || [];
        const fromHeader = headers.find((h) => h.name.toLowerCase() === 'from')?.value || '';
        const subjectHeader = headers.find((h) => h.name.toLowerCase() === 'subject')?.value || '(No Subject)';
        const senderEmail = extractEmailAddress(fromHeader);

        if (!senderEmail || senderEmail.endsWith('@seaofblue.app') || senderEmail.endsWith('@seaofblue.ca')) {
          continue;
        }

        const senderDomain = senderEmail.split('@')[1] || '';
        const matchedLead =
          leadByEmail.get(senderEmail) || (senderDomain ? leadsByDomain.get(senderDomain)?.[0] : null);

        if (!matchedLead) continue;

        const bodyText = decodeGmailBody(msgData.payload) || msgData.snippet || '';

        // Classify with Claude Sonnet 5.5
        const claudeRes = await callClaudeSonnet({
          systemPrompt: INBOX_CLASSIFIER_SYSTEM_PROMPT,
          userPrompt: [
            `Rep: ${rep.name} (${rep.gmail_address})`,
            `Lead in CRM: ${matchedLead.customer_name} (${matchedLead.contact_title || 'Contact'}) at ${matchedLead.company_name}`,
            `From Header: ${fromHeader}`,
            `Subject: ${subjectHeader}`,
            `Email Body:\n${bodyText.slice(0, 2500)}`,
          ].join('\n'),
          maxTokens: 900,
        });

        const parsed = extractJsonFromClaude<{
          classification: InboxAlertItem['classification'];
          ai_summary: string;
          ai_suggested_reply?: string;
          ooo_return_date?: string | null;
          referral_contact?: InboxAlertItem['referral_contact'];
        }>(claudeRes.text);

        // Trigger follow-up engine signal automatically so no auto-drip fires after reply!
        if (parsed.classification === 'out_of_office' && parsed.ooo_return_date) {
          await runEngineForLeadSignal(matchedLead.id, 'pause', rep.auth_user_id!, {
            until: parsed.ooo_return_date,
          });
        } else if (parsed.classification === 'not_interested') {
          await runEngineForLeadSignal(matchedLead.id, 'unsubscribe', rep.auth_user_id!, {});
        } else {
          await runEngineForLeadSignal(matchedLead.id, 'replied', rep.auth_user_id!, {
            kind: parsed.classification === 'question' ? 'info' : 'talk',
          });
        }

        const alertId = crypto.randomUUID();
        const alertItem: InboxAlertItem = {
          id: alertId,
          lead_id: matchedLead.id,
          lead_name: matchedLead.customer_name || senderEmail,
          company_name: matchedLead.company_name || senderDomain,
          rep_id: rep.auth_user_id!,
          rep_name: rep.name,
          rep_email: oauth.gmail_address,
          from_email: senderEmail,
          subject: subjectHeader,
          snippet: (msgData.snippet || bodyText).slice(0, 220),
          classification: parsed.classification || 'interested',
          ai_summary: parsed.ai_summary || 'Prospect replied to your follow-up email.',
          ai_suggested_reply: parsed.ai_suggested_reply || undefined,
          ooo_return_date: parsed.ooo_return_date || null,
          referral_contact: parsed.referral_contact || null,
          gmail_message_id: m.id,
          gmail_thread_id: msgData.threadId,
          status: 'unread',
          created_at: new Date().toISOString(),
        };

        await supabase.from('sales_followup_processed_events').insert({
          event_id: alertId,
          lead_id: matchedLead.id,
          outcome_type: 'INBOX_ALERT',
          summary: alertItem,
          processed_at: alertItem.created_at,
        });

        processedMsgIds.add(m.id);
        newAlerts.push(alertItem);

        // Send Web Push notification to the rep
        await notifyRepViaWebPush(rep, alertItem);
      }

      // Update last_inbox_scan_at
      oauth.last_inbox_scan_at = new Date().toISOString();
      await supabase.from('sales_followup_processed_events').upsert({
        event_id: rep.auth_user_id!,
        lead_id: null,
        outcome_type: 'GMAIL_OAUTH',
        summary: oauth,
        processed_at: oauth.last_inbox_scan_at,
      });
    } catch (err) {
      console.warn(`[gmailAgent] Inbox scan error for ${rep.name}:`, err);
    }
  }

  // 4. Send Email Digest / Reminder if new alerts arrived or digest requested
  if (newAlerts.length > 0 || options.sendEmailDigest) {
    await sendRepReminderDigests(newAlerts);
  }

  return {
    scannedReps: SALES_REP_LIST.map((r) => r.name),
    newAlertsCount: newAlerts.length,
    newAlerts,
  };
}

async function notifyRepViaWebPush(rep: SalesRepConfig, alert: InboxAlertItem) {
  try {
    const supabase = await createServiceClient();
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('subscription')
      .eq('user_id', rep.auth_user_id);

    for (const row of subs || []) {
      const sub = typeof row.subscription === 'string' ? JSON.parse(row.subscription) : row.subscription;
      if (sub) {
        await sendWebPush(sub, {
          title: `💬 Lead Reply: ${alert.lead_name} (${alert.company_name})`,
          body: alert.ai_summary,
          tag: `inbox-alert-${alert.id}`,
          url: '/sales',
        });
      }
    }
  } catch {
    // ignore if push_subscriptions table is empty
  }
}

async function sendRepReminderDigests(newAlerts: InboxAlertItem[]) {
  const secrets = await getFollowupSystemSecrets();
  const resendKey = secrets.RESEND_API_KEY || process.env.RESEND_API_KEY;
  if (!resendKey) return;

  const supabase = await createServiceClient();
  const resend = new Resend(resendKey);

  for (const rep of SALES_REP_LIST) {
    const repAlerts = newAlerts.filter((a) => a.rep_id === rep.auth_user_id);

    // Also count overdue pending tasks for this rep
    const { data: dueTasks } = await supabase
      .from('sales_followup_tasks')
      .select('id, title, kind, due_at')
      .eq('assigned_rep_id', rep.auth_user_id)
      .eq('status', 'pending')
      .lte('due_at', new Date().toISOString())
      .limit(15);

    if (repAlerts.length === 0 && (!dueTasks || dueTasks.length === 0)) continue;

    const lines: string[] = [
      `Hi ${rep.name.split(' ')[0]},`,
      '',
      `Here is your Sea of Blue Claude Follow-Up & Inbox Reminder:`,
      '',
    ];

    if (repAlerts.length > 0) {
      lines.push(`=== NEW INBOX REPLIES (${repAlerts.length}) ===`);
      for (const a of repAlerts) {
        lines.push(
          `• ${a.lead_name} (${a.company_name}) [${a.classification.toUpperCase()}]: ${a.ai_summary}`
        );
        if (a.ai_suggested_reply) {
          lines.push(`  Suggested Reply: "${a.ai_suggested_reply}"`);
        }
      }
      lines.push('');
    }

    if (dueTasks && dueTasks.length > 0) {
      lines.push(`=== DUE FOLLOW-UP TASKS (${dueTasks.length}) ===`);
      for (const t of dueTasks.slice(0, 8)) {
        lines.push(`• [${t.kind.toUpperCase()}] ${t.title}`);
      }
      lines.push('');
    }

    lines.push('Open Touch Centre in Sea of Blue to review and send in 1 click.');

    try {
      await resend.emails.send({
        from: 'Sea of Blue AI Copilot <info@seaofblue.app>',
        to: rep.gmail_address,
        subject: `Sea of Blue Follow-Up Alert: ${repAlerts.length} new replies, ${dueTasks?.length || 0} due tasks`,
        text: lines.join('\n'),
      });
    } catch {
      // ignore digest errors
    }
  }
}

/**
 * Fetches recent unread Inbox Alerts for the Touch Centre banner.
 */
export async function getActiveInboxAlerts(repId?: string | null): Promise<InboxAlertItem[]> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from('sales_followup_processed_events')
    .select('event_id, summary, processed_at')
    .eq('outcome_type', 'INBOX_ALERT')
    .order('processed_at', { ascending: false })
    .limit(50);

  const items: InboxAlertItem[] = [];
  for (const row of data || []) {
    const s = row.summary as InboxAlertItem;
    if (!s || s.status === 'dismissed' || s.status === 'resolved') continue;
    if (repId && repId !== 'all' && s.rep_id !== repId) continue;
    items.push(s);
  }
  return items;
}
