/**
 * Claude Sonnet 5.5 Dossier Email Drafter & Post-Call Transcript Autopilot.
 * Combines Website/LinkedIn Recon + Call Transcripts + Colleague Logs + Rep Notes
 * to generate tailored follow-up emails that pass validateRenderedOutput().
 */

import { createServiceClient } from '@/lib/supabase/server';
import { FOLLOWUP_CONFIG, resolveRepConfig } from './config';
import { renderEmail, parseFirstName, validateRenderedOutput } from './render';
import { getOrRunLeadRecon, parseLeadIntelJson, LeadRecon } from './recon';
import { callClaudeSonnet, extractJsonFromClaude } from './claudeClient';
import { companyKey } from './company';

export interface AiDraftResult {
  subject: string;
  body: string;
  recon: LeadRecon;
  rep: {
    name: string;
    title: string;
    phone: string;
    gmail_address: string;
  };
  templateKey: string;
  draftedAt: string;
  model: string;
}

const DRAFTER_SYSTEM_PROMPT = `You are writing a B2B commercial construction follow-up email on behalf of a co-founder at Sea of Blue Inc. (Malik Campbell, Raahim Ahmed, or Ayaan Baig).
Sea of Blue Inc. provides rough, final, and pre-handover touch-up post-construction cleaning for commercial, ICI, multi-family, and custom residential builders across the Greater Toronto Area (GTA).

YOUR GOAL:
Personalize the email body and subject line using the Lead Dossier (Company Website & LinkedIn Recon, Quo Call Transcripts, Colleague Call Logs, and Rep Notes) while keeping the exact purpose and directness of the sequence step's Base Template.

STRICT FORMATTING & STYLE RULES (CRITICAL):
1. Plain contractor-to-contractor English. Short sentences. Under 85 words for the body paragraphs (excluding greeting and signature).
2. NEVER use em-dashes (—) or en-dashes (–). Use a comma or period instead.
3. NEVER use double spaces, bullet lists, or cheesy AI phrases ("I hope this email finds you well", "impressive portfolio", "synergy", "delighted").
4. If the Dossier has specific call transcript details, colleague names spoken to at their company, or specific build types/cities from their website/LinkedIn, weave ONE natural, specific reference into the email.
5. Do NOT include the greeting ("Hi Name,") or the signature block in your "body_paragraphs" JSON field; our renderer attaches the exact greeting and legal signature automatically.
6. Return ONLY valid JSON with this exact shape:
{
  "subject": "Short, specific subject line (3 to 7 words, no em-dashes)",
  "body_paragraphs": "The 1 to 3 short paragraphs of the email body only (separated by \\n\\n, no greeting, no sign-off)",
  "reasoning": "1 short sentence explaining what dossier/website/transcript detail was used"
}`;

function sanitizeForValidation(text: string): string {
  return String(text || '')
    .replace(/[—–]/g, ', ')
    .replace(/\{\{|\}\}/g, '')
    .replace(/\bundefined\b/gi, '')
    .replace(/\bnull\b/gi, '')
    .replace(/[ \t]+([.,?!;])/g, '$1')
    .replace(/ {2,}/g, ' ')
    .trim();
}

export async function draftDossierEmailWithClaude(options: {
  leadId: string;
  templateKey?: string;
  taskId?: string;
  repIdentifier?: string | null;
  customInstruction?: string;
  forceReconRefresh?: boolean;
}): Promise<AiDraftResult> {
  const supabase = await createServiceClient();
  const rawLeadId = String(options.leadId).replace(/^lead_/, '');

  // 1. Load lead
  const { data: lead, error: leadErr } = await supabase
    .from('leads')
    .select('*')
    .eq('id', rawLeadId)
    .single();

  if (leadErr || !lead) {
    throw new Error(`Lead not found: ${rawLeadId}`);
  }

  const intel = parseLeadIntelJson(lead.notes);

  // 2. Load active enrollment & task if any
  const { data: enrollments } = await supabase
    .from('sales_followup_enrollments')
    .select('*')
    .eq('lead_id', rawLeadId)
    .in('status', ['active', 'held', 'paused'])
    .order('created_at', { ascending: false });

  const activeEnr = enrollments?.[0] || null;

  let taskRow: any = null;
  if (options.taskId) {
    const { data: t } = await supabase
      .from('sales_followup_tasks')
      .select('*')
      .eq('id', options.taskId)
      .maybeSingle();
    taskRow = t;
  } else if (activeEnr) {
    const { data: pendingTasks } = await supabase
      .from('sales_followup_tasks')
      .select('*')
      .eq('enrollment_id', activeEnr.id)
      .eq('status', 'pending')
      .eq('kind', 'email')
      .order('due_at', { ascending: true })
      .limit(1);
    taskRow = pendingTasks?.[0] || null;
  }

  const templateKey =
    options.templateKey ||
    taskRow?.template_key ||
    (lead.status === 'walkthrough_booked'
      ? 'wt_confirm'
      : lead.status === 'quoted'
      ? 'quote_day2'
      : lead.status === 'won'
      ? 'won_thanks'
      : lead.status === 'contacted'
      ? 'pickup_recap'
      : 'drip_1');

  // 3. Resolve effective Sales Rep (Malik, Raahim, or Ayaan)
  const repConfig = resolveRepConfig(
    options.repIdentifier || taskRow?.assigned_rep_id || activeEnr?.owner_rep_id || 'malik'
  );

  // Check if rep has custom signature overrides in sales_rep_followup_settings
  const { data: repSettings } = await supabase
    .from('sales_rep_followup_settings')
    .select('*')
    .eq('rep_id', repConfig.auth_user_id)
    .maybeSingle();

  const effectiveRep = {
    name: repSettings?.signature_name || repConfig.name,
    title: repSettings?.signature_title || repConfig.title,
    phone: repSettings?.signature_phone || repConfig.phone,
    gmail_address: repSettings?.gmail_address || repConfig.gmail_address,
  };

  // 4. Get or run Website & LinkedIn Recon
  const recon = await getOrRunLeadRecon(rawLeadId, {
    forceRefresh: options.forceReconRefresh,
  });

  // 5. Render deterministic base template (with recon proof_sentence injected) as fallback & structural reference
  const baseRendered = renderEmail({
    templateKey,
    lead: {
      customer_name: lead.customer_name,
      company_name: lead.company_name,
      city: lead.city,
      sector: intel.sector || lead.service_type,
    },
    rep: {
      signature_name: effectiveRep.name,
      signature_title: effectiveRep.title,
      signature_phone: effectiveRep.phone,
    },
    context: {
      ...(activeEnr?.context || {}),
      proof_sentence: recon.proof_sentence,
    },
    anchorAt: activeEnr?.anchor_at || new Date(),
  });

  // 6. Gather Call Logs & Quo Transcripts (Direct + Colleagues at same company)
  const cKey = companyKey(lead.company_name);
  const { data: callEvents } = await supabase
    .from('events')
    .select('created_at, payload')
    .eq('type', 'PHONE_CALL')
    .order('created_at', { ascending: false })
    .limit(250);

  const directTranscripts: string[] = [];
  const colleagueTouches: string[] = [];

  if (intel.transcript || intel.ai_summary) {
    directTranscripts.push(
      `[Lead Intel Summary/Transcript]: ${intel.ai_summary || ''} ${intel.transcript ? `Transcript: ${String(intel.transcript).slice(0, 600)}` : ''}`
    );
  }

  for (const e of callEvents || []) {
    const p = typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload || {};
    const cid = String(p.contact_id || '').replace(/^lead_/, '');
    if (cid === rawLeadId) {
      directTranscripts.push(
        `[${new Date(e.created_at).toLocaleDateString()} - ${p.outcome_type} by ${p.rep_name || 'Rep'}]: ${p.notes || ''} ${p.ai_summary || ''} ${p.transcript ? `Transcript: ${String(p.transcript).slice(0, 500)}` : ''}`.trim()
      );
    } else if (cKey && companyKey(p.company_name) === cKey) {
      colleagueTouches.push(
        `[Colleague ${p.contact_name || 'Team Member'} - ${p.outcome_type} by ${p.rep_name || 'Rep'}]: ${p.notes || p.ai_summary || 'Dialed'}`
      );
    }
  }

  // 7. Call Claude Sonnet 5.5 to personalize the email
  const userPrompt = [
    `SEQUENCE STEP / TEMPLATE KEY: ${templateKey}`,
    `SENDING REP: ${effectiveRep.name} (${effectiveRep.title}, Sea of Blue Inc.)`,
    `PROSPECT NAME: ${lead.customer_name || 'Decision Maker'}`,
    `PROSPECT TITLE: ${lead.contact_title || intel.seniority || 'Project Lead'}`,
    `COMPANY: ${lead.company_name || 'Commercial Builder'} (${lead.city || 'GTA'})`,
    `WEBSITE & LINKEDIN RECON:`,
    `- Company Summary: ${recon.company_summary}`,
    `- Build Specialty: ${recon.build_specialty}`,
    `- Notable Projects / Sectors: ${(recon.notable_projects || []).join('; ') || 'Commercial builds'}`,
    `- Role Angle: ${recon.contact_role_angle}`,
    `REP NOTES ON LEAD: ${intel.notes || intel.rep_notes || 'None'}`,
    `ENROLLMENT CONTEXT: ${JSON.stringify(activeEnr?.context || {})}`,
    `DIRECT CALL LOGS & QUO TRANSCRIPTS:\n${directTranscripts.slice(0, 4).join('\n') || 'No connected transcript yet (cold outreach / no answer).'}`,
    `COLLEAGUE INTERACTIONS AT THIS COMPANY:\n${colleagueTouches.slice(0, 4).join('\n') || 'None logged.'}`,
    options.customInstruction ? `CUSTOM REP INSTRUCTION: ${options.customInstruction}` : '',
    `\nBASE TEMPLATE SUBJECT: ${baseRendered.subject}`,
    `BASE TEMPLATE FULL EMAIL (for structure & tone reference):\n${baseRendered.body}`,
  ]
    .filter(Boolean)
    .join('\n');

  let finalSubject = baseRendered.subject;
  let finalBody = baseRendered.body;

  try {
    const claudeRes = await callClaudeSonnet({
      systemPrompt: DRAFTER_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 1200,
    });

    const parsed = extractJsonFromClaude<{
      subject?: string;
      body_paragraphs?: string;
    }>(claudeRes.text);

    if (parsed.subject && parsed.body_paragraphs) {
      const cleanSubj = sanitizeForValidation(parsed.subject);
      const cleanParagraphs = parsed.body_paragraphs
        .split(/\n{2,}/)
        .map((p) => sanitizeForValidation(p))
        .filter(Boolean)
        .join('\n\n');

      const firstName = parseFirstName(lead.customer_name);
      const greeting = firstName ? `Hi ${firstName},` : 'Hi,';
      const titleLine = effectiveRep.title
        ? `${effectiveRep.title}, ${FOLLOWUP_CONFIG.company.legalName}`
        : FOLLOWUP_CONFIG.company.legalName;
      const addressLine = FOLLOWUP_CONFIG.company.mailingAddress;

      const assembledBody = [
        greeting,
        '',
        cleanParagraphs,
        '',
        FOLLOWUP_CONFIG.signOff,
        effectiveRep.name,
        titleLine,
        effectiveRep.phone,
        '',
        `${FOLLOWUP_CONFIG.company.legalName}, ${addressLine}, ${FOLLOWUP_CONFIG.company.website}`,
      ].join('\n');

      validateRenderedOutput(cleanSubj, assembledBody, false);
      finalSubject = cleanSubj.charAt(0).toUpperCase() + cleanSubj.slice(1);
      finalBody = assembledBody;
    }
  } catch (err) {
    console.warn('[aiDrafter] Falling back to recon-enhanced deterministic template:', err);
  }

  const draftedAt = new Date().toISOString();

  // Save draft on the task row if present
  if (taskRow?.id) {
    await supabase
      .from('sales_followup_tasks')
      .update({
        rendered_subject: finalSubject,
        rendered_body: finalBody,
        updated_at: draftedAt,
      })
      .eq('id', taskRow.id);
  }

  // Also cache in active enrollment context so UI loads it immediately
  if (activeEnr?.id) {
    const existingDrafts = activeEnr.context?.ai_drafts || {};
    await supabase
      .from('sales_followup_enrollments')
      .update({
        context: {
          ...(activeEnr.context || {}),
          ai_drafts: {
            ...existingDrafts,
            [templateKey]: {
              subject: finalSubject,
              body: finalBody,
              drafted_at: draftedAt,
              rep_name: effectiveRep.name,
            },
          },
        },
        updated_at: draftedAt,
      })
      .eq('id', activeEnr.id);
  }

  return {
    subject: finalSubject,
    body: finalBody,
    recon,
    rep: effectiveRep,
    templateKey,
    draftedAt,
    model: 'claude-sonnet-5-5',
  };
}

export interface TranscriptAutopilotResult {
  extracted_call_note: string;
  next_step: string;
  project_name?: string | null;
  site_address?: string | null;
  callback_date_hint?: string | null;
  referred_colleague?: {
    name: string;
    title?: string;
    email?: string;
    phone?: string;
    matched_lead_id?: string | null;
  } | null;
  coaching_score: number;
  coaching_tip: string;
}

const AUTOPILOT_SYSTEM_PROMPT = `You are the Post-Call Transcript Autopilot for Sea of Blue Inc.
Analyze a sales call transcript or call notes between a Sea of Blue rep (Malik, Raahim, or Ayaan) and a construction prospect.
Return ONLY valid JSON with no em-dashes (—):
{
  "extracted_call_note": "Concise phrase completing 'You mentioned ...' (max 120 chars, lowercase start, no trailing period)",
  "next_step": "Concise next step phrase completing 'Next step: ...' (max 120 chars)",
  "project_name": "Name or city of active/upcoming project if mentioned, else null",
  "site_address": "Site address if mentioned, else null",
  "callback_date_hint": "ISO date or month mentioned to follow up if any, else null",
  "referred_colleague": {
    "name": "Name of colleague they told us to contact if any",
    "title": "Their role/title if mentioned",
    "email": "Email if mentioned",
    "phone": "Phone/ext if mentioned"
  } or null,
  "coaching_score": 1 to 10 integer rating of objection handling and clarity,
  "coaching_tip": "1 practical sentence of feedback for the rep on this call"
}`;

export async function runTranscriptAutopilot(
  leadId: string,
  transcriptOrNotes: string
): Promise<TranscriptAutopilotResult | null> {
  if (!transcriptOrNotes || transcriptOrNotes.trim().length < 20) return null;

  const supabase = await createServiceClient();
  const rawLeadId = String(leadId).replace(/^lead_/, '');

  const { data: lead } = await supabase
    .from('leads')
    .select('id, customer_name, company_name, contact_title, city, notes')
    .eq('id', rawLeadId)
    .maybeSingle();

  // Find colleagues at same company to match referrals automatically
  let colleagues: any[] = [];
  if (lead?.company_name) {
    const { data: cols } = await supabase
      .from('leads')
      .select('id, customer_name, contact_title, customer_email, customer_phone')
      .ilike('company_name', lead.company_name.trim())
      .neq('id', rawLeadId)
      .limit(20);
    colleagues = cols || [];
  }

  const res = await callClaudeSonnet({
    systemPrompt: AUTOPILOT_SYSTEM_PROMPT,
    userPrompt: [
      `Prospect: ${lead?.customer_name || 'Contact'} (${lead?.contact_title || 'Lead'}) at ${lead?.company_name || 'Company'}`,
      `Known Colleagues at Company: ${colleagues.map((c) => `${c.customer_name} (${c.contact_title || 'Colleague'}) [id:${c.id}]`).join(', ') || 'None'}`,
      `Call Transcript / Notes:\n${transcriptOrNotes}`,
    ].join('\n\n'),
    maxTokens: 900,
  });

  const parsed = extractJsonFromClaude<TranscriptAutopilotResult>(res.text);

  if (parsed.referred_colleague?.name && colleagues.length > 0) {
    const refLower = parsed.referred_colleague.name.toLowerCase();
    const matched = colleagues.find((c) =>
      String(c.customer_name || '').toLowerCase().includes(refLower.split(' ')[0])
    );
    if (matched) {
      parsed.referred_colleague.matched_lead_id = matched.id;
    }
  }

  // Persist autopilot insights into lead intel JSON
  if (lead) {
    const intel = parseLeadIntelJson(lead.notes);
    await supabase
      .from('leads')
      .update({
        notes: JSON.stringify({
          ...intel,
          last_autopilot: {
            ...parsed,
            analyzed_at: new Date().toISOString(),
          },
        }),
        updated_at: new Date().toISOString(),
      })
      .eq('id', rawLeadId);
  }

  return parsed;
}
