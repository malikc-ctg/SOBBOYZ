import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * Verifies Quo / OpenPhone webhook signature or secret header
 */
function verifyQuoWebhook(request: NextRequest, rawBody: string): { isValid: boolean; error?: string } {
  const secret = process.env.QUO_WEBHOOK_SECRET || process.env.OPENPHONE_WEBHOOK_SECRET;

  if (!secret) {
    console.error('[Quo Webhook] QUO_WEBHOOK_SECRET is not configured on server');
    return { isValid: false, error: 'QUO_WEBHOOK_SECRET is not configured' };
  }

  // 1. Standard-Webhooks headers (webhook-id, webhook-timestamp, webhook-signature)
  const webhookId = request.headers.get('webhook-id');
  const webhookTimestamp = request.headers.get('webhook-timestamp');
  const webhookSignature = request.headers.get('webhook-signature');

  if (webhookSignature && webhookTimestamp) {
    const timestampNum = parseInt(webhookTimestamp, 10);
    const nowSec = Math.floor(Date.now() / 1000);
    const tsSec = timestampNum > 1e11 ? Math.floor(timestampNum / 1000) : timestampNum;
    if (!isNaN(tsSec) && Math.abs(nowSec - tsSec) > 300) {
      return { isValid: false, error: 'Webhook timestamp expired (replay attack protection)' };
    }

    const cleanSecret = secret.startsWith('whsec_') ? secret.slice(6) : secret;
    let keyBuffer: Buffer;
    try {
      keyBuffer = Buffer.from(cleanSecret, 'base64');
      if (keyBuffer.length === 0) keyBuffer = Buffer.from(cleanSecret, 'utf-8');
    } catch {
      keyBuffer = Buffer.from(cleanSecret, 'utf-8');
    }

    const toSign = `${webhookId || ''}.${webhookTimestamp}.${rawBody}`;
    const hmac = crypto.createHmac('sha256', keyBuffer).update(toSign).digest('base64');

    const signatures = webhookSignature.split(' ').flatMap(s => s.split(','));
    for (const sig of signatures) {
      const cleanSig = sig.startsWith('v1=') ? sig.slice(3) : sig;
      try {
        if (crypto.timingSafeEqual(Buffer.from(cleanSig), Buffer.from(hmac))) {
          return { isValid: true };
        }
      } catch {}
    }
  }

  // 2. Legacy OpenPhone header: "hmac;1;<timestamp>;<base64-signature>"
  const legacySigHeader = request.headers.get('openphone-signature');
  if (legacySigHeader) {
    const parts = legacySigHeader.split(';');
    if (parts.length >= 4) {
      const ts = parts[2];
      const sigToMatch = parts[3];
      const toSign = `${ts}.${rawBody}`;

      let key: Buffer;
      try {
        key = Buffer.from(secret, 'base64');
        if (key.length === 0) key = Buffer.from(secret, 'utf-8');
      } catch {
        key = Buffer.from(secret, 'utf-8');
      }

      const hmac = crypto.createHmac('sha256', key).update(toSign).digest('base64');
      try {
        if (crypto.timingSafeEqual(Buffer.from(sigToMatch), Buffer.from(hmac))) {
          return { isValid: true };
        }
      } catch {}
    }
  }

  // 3. Custom secret / signature header
  const directSecret = request.headers.get('x-webhook-secret') || 
                       request.headers.get('x-quo-signature') ||
                       request.headers.get('x-quo-secret');
  if (directSecret && (directSecret === secret || directSecret === `whsec_${secret}`)) {
    return { isValid: true };
  }

  // 4. Bearer token in Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token === secret) {
      return { isValid: true };
    }
  }

  return { isValid: false, error: 'Invalid webhook signature or secret' };
}

/**
 * Normalizes phone numbers to standard 10-digit format for robust matching
 */
function cleanPhone(raw: string) {
  if (!raw) return '';
  const withoutExt = raw.split(/ext|\bx\b|#/i)[0];
  const digits = withoutExt.replace(/[^0-9]/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
}

/**
 * Extracts and formats AI summary bullets into clean readable text
 */
function formatSummary(raw: any): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.map(item => (typeof item === 'string' ? item : JSON.stringify(item)));
  }
  if (typeof raw === 'string') {
    return raw
      .split('\n')
      .map(s => s.trim().replace(/^[-•*]\s*/, ''))
      .filter(Boolean);
  }
  return [String(raw)];
}

/**
 * Formats transcript dialogue turns or raw text into full speaker dialogue
 */
function formatTranscript(raw: any): string {
  if (!raw) return '';
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) {
    return raw
      .map((item: any) => {
        if (typeof item === 'string') return item;
        const speaker = item.speaker || item.name || item.role || 'Speaker';
        const text = item.text || item.content || item.transcript || '';
        return `[${speaker}]: "${text}"`;
      })
      .join('\n');
  }
  return JSON.stringify(raw);
}

/**
 * Robustly inspects any contact name sent by Quo / OpenPhone
 */
function extractQuoContactName(call: any, eventData: any, body: any): string | null {
  const candidates = [
    call?.contact?.name,
    call?.contact?.firstName ? `${call.contact.firstName} ${call.contact.lastName || ''}`.trim() : null,
    call?.fromName,
    call?.toName,
    call?.caller?.name,
    call?.externalParty?.name,
    call?.participantName,
    eventData?.contact?.name,
    eventData?.contact?.firstName ? `${eventData.contact.firstName} ${eventData.contact.lastName || ''}`.trim() : null,
    body?.data?.context?.contact?.name,
    body?.data?.context?.contactName
  ];
  return candidates.find(c => c && typeof c === 'string' && c.trim().length > 0) || null;
}

/**
 * POST /api/sales/webhooks/quo
 * Real-time Webhook Receiver for Quo (formerly OpenPhone)
 * Synchronizes calls, transcripts, Sona AI summaries, durations, and SMS messages directly into Sea of Blue
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const verification = verifyQuoWebhook(request, rawBody);
    if (!verification.isValid) {
      console.warn('[Quo Webhook] Authentication failure:', verification.error);
      return NextResponse.json({ error: verification.error || 'Unauthorized' }, { status: 401 });
    }

    let body: any;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const supabase = await createServiceClient();

    const eventType = body.type;
    const eventData = body.data?.object || body.data || {};

    // 1. Handle call.completed
    if (eventType === 'call.completed' || body.object === 'call') {
      const call = eventData;
      const direction = (call.direction || 'outbound').toLowerCase();
      const rawTargetPhone = direction === 'outbound' ? (call.to || call.destination) : (call.from || call.source);
      const cleanTarget = cleanPhone(rawTargetPhone);
      const status = call.status || 'completed';
      const startedAt = call.startedAt || call.created_at || new Date().toISOString();
      const endedAt = call.completedAt || call.endedAt || new Date().toISOString();
      const answeredAt = call.answeredAt || null;

      // Extract duration from all possible Quo fields and fallback to timestamp differences
      let durationSeconds = Number(call.duration || call.durationSeconds || call.talkTime || 0);
      if (durationSeconds === 0 && answeredAt && endedAt) {
        const diff = Math.round((new Date(endedAt).getTime() - new Date(answeredAt).getTime()) / 1000);
        if (diff > 0) durationSeconds = diff;
      }
      if (durationSeconds === 0 && startedAt && endedAt && status === 'completed') {
        const diff = Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000);
        if (diff > 0) durationSeconds = diff;
      }

      // Determine outcome classification
      let outcomeType = 'CONVO';
      if (status === 'missed' || status === 'abandoned' || status === 'declined') {
        outcomeType = 'NO_ANSWER';
      } else if (durationSeconds === 0 && !answeredAt && status !== 'completed') {
        outcomeType = 'NO_ANSWER';
      } else if (durationSeconds > 0 && durationSeconds < 25) {
        outcomeType = 'VOICEMAIL';
      } else {
        outcomeType = 'CONVO'; // Answered conversation
      }

      // Extract name from Quo payload if provided
      const quoContactName = extractQuoContactName(call, eventData, body);

      // Look up matching lead in Supabase across all active leads
      const { data: allLeads } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      let matchedLead = (allLeads || []).find((l: any) => {
        if (cleanPhone(l.customer_phone) === cleanTarget) return true;
        if (l.notes) {
          try {
            if (l.notes.startsWith('{') && l.notes.endsWith('}')) {
              const intel = JSON.parse(l.notes);
              if (cleanPhone(intel.work_direct_phone) === cleanTarget) return true;
              if (cleanPhone(intel.mobile_phone) === cleanTarget) return true;
              if (cleanPhone(intel.corporate_phone) === cleanTarget) return true;
              if (cleanPhone(intel.other_phone) === cleanTarget) return true;
            }
          } catch {}
        }
        return false;
      });

      // If contact not found in leads, automatically create lead in CRM so it's fully tracked
      if (!matchedLead && cleanTarget) {
        const leadName = quoContactName || (direction === 'inbound' ? 'Inbound Quo Caller' : 'Outbound Quo Contact');
        const { data: newLead } = await supabase
          .from('leads')
          .insert({
            customer_name: leadName,
            customer_phone: rawTargetPhone,
            company_name: call.contact?.company || 'Commercial Prospect',
            source: 'quo_telephony',
            status: 'contacted',
            notes: `Auto-created from Quo ${direction.toUpperCase()} call`,
            service_type: 'post_construction_clean'
          })
          .select()
          .single();

        if (newLead) matchedLead = newLead;
      } else if (matchedLead && quoContactName && (!matchedLead.customer_name || matchedLead.customer_name.startsWith('Quo Contact') || matchedLead.customer_name.startsWith('Inbound'))) {
        await supabase
          .from('leads')
          .update({ customer_name: quoContactName, updated_at: endedAt })
          .eq('id', matchedLead.id);
        matchedLead.customer_name = quoContactName;
      }

      const eventId = crypto.randomUUID();
      const contactDisplayName = matchedLead?.customer_name || quoContactName || 'Quo Contact';
      const companyDisplayName = matchedLead?.company_name || call.contact?.company || 'Commercial Prospect';

      const callPayload = {
        event_id: eventId,
        source: 'quo_webhook',
        quo_call_id: call.id,
        direction,
        phone_number: rawTargetPhone,
        duration_seconds: durationSeconds,
        outcome_type: outcomeType,
        contact_id: matchedLead ? matchedLead.id : null,
        contact_name: contactDisplayName,
        company_name: companyDisplayName,
        notes: `[Auto-Logged from Quo] ${direction.toUpperCase()} call (${durationSeconds}s). Status: ${status}`,
        rep_name: 'Quo VoIP Sync',
        timestamp: endedAt,
      };

      // Record in public.events
      const { error: eventError } = await supabase.from('events').insert({
        event_id: eventId,
        rep_id: matchedLead?.rep_id || matchedLead?.assigned_to || null,
        type: 'PHONE_CALL',
        payload: callPayload,
        created_at: endedAt,
      });

      if (eventError) {
        console.error('[Quo Webhook] Event insert error:', eventError);
      }

      // If matched lead, auto-update lead status
      if (matchedLead) {
        const updatePayload: any = { updated_at: endedAt };
        if (matchedLead.status === 'new') {
          updatePayload.status = outcomeType === 'VOICEMAIL' ? 'voicemail' : (outcomeType === 'NO_ANSWER' ? 'no_answer' : 'contacted');
        }
        await supabase
          .from('leads')
          .update(updatePayload)
          .eq('id', matchedLead.id);
      }

      return NextResponse.json({
        success: true,
        matched: !!matchedLead,
        lead_id: matchedLead?.id || null,
        call: callPayload,
      }, { status: 200 });
    }

    // 2. Handle call.summary.completed, call.transcript.completed, and call.recording.completed
    if (
      eventType === 'call.summary.completed' || 
      eventType === 'call.transcript.completed' || 
      eventType === 'call.recording.completed'
    ) {
      const summaryRaw = eventData.summary || null;
      const summaryBullets = formatSummary(summaryRaw);
      const transcriptRaw = eventData.transcript || eventData.dialogue || eventData.text || null;
      const fullTranscript = formatTranscript(transcriptRaw);
      const recordingUrl = eventData.recordingUrl || eventData.url || null;
      const quoCallId = eventData.callId || eventData.id || body.data?.callId || body.callId;

      if (quoCallId && (summaryBullets.length > 0 || fullTranscript || recordingUrl)) {
        // Find existing event for this call ID
        const { data: existingEvents } = await supabase
          .from('events')
          .select('*')
          .eq('type', 'PHONE_CALL')
          .order('created_at', { ascending: false })
          .limit(30);

        const targetEvent = (existingEvents || []).find((e: any) => {
          const p = typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload;
          return p?.quo_call_id === quoCallId;
        });

        if (targetEvent) {
          const p = typeof targetEvent.payload === 'string' ? JSON.parse(targetEvent.payload) : targetEvent.payload;
          
          if (summaryBullets.length > 0) {
            p.ai_summary = summaryBullets;
          }
          if (fullTranscript) {
            p.transcript = fullTranscript;
          }
          if (recordingUrl) {
            p.recording_url = recordingUrl;
          }

          // If duration was 0, calculate or estimate talk time
          let duration = Number(eventData.duration || eventData.durationSeconds || p.duration_seconds || 0);
          if (duration === 0 && eventData.endedAt && eventData.startedAt) {
            const diff = Math.round((new Date(eventData.endedAt).getTime() - new Date(eventData.startedAt).getTime()) / 1000);
            if (diff > 0) duration = diff;
          }
          if (duration === 0 && (summaryBullets.length > 0 || fullTranscript)) {
            duration = 60; // Connected call default
          }
          p.duration_seconds = duration;
          p.outcome_type = 'CONVO'; // Conversation confirmed by AI summary/transcript

          // Format notes with clean summary bullets
          const summaryStr = summaryBullets.length > 0 ? summaryBullets.join('. ') : '';
          p.notes = `[Auto-Logged from Quo] ${p.direction?.toUpperCase() || 'COMPLETED'} call (${p.duration_seconds}s). Status: completed${summaryStr ? ` | AI Summary: ${summaryStr}` : ''}`;

          await supabase
            .from('events')
            .update({ payload: p })
            .eq('event_id', targetEvent.event_id);
        }
      }

      return NextResponse.json({ success: true, processed: true }, { status: 200 });
    }

    // 3. Handle message.received & message.delivered (SMS sync)
    if (eventType === 'message.received' || eventType === 'message.delivered') {
      const msg = eventData;
      const isIncoming = eventType === 'message.received' || (msg.direction || '').toLowerCase() === 'incoming';
      const rawTargetPhone = isIncoming ? msg.from : (Array.isArray(msg.to) ? msg.to[0] : msg.to);
      const cleanTarget = cleanPhone(rawTargetPhone);
      const messageBody = msg.body || msg.text || '';
      const createdAt = msg.createdAt || new Date().toISOString();

      const { data: allLeads } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      const matchedLead = (allLeads || []).find((l: any) => {
        if (cleanPhone(l.customer_phone) === cleanTarget) return true;
        if (l.notes) {
          try {
            if (l.notes.startsWith('{') && l.notes.endsWith('}')) {
              const intel = JSON.parse(l.notes);
              if (cleanPhone(intel.work_direct_phone) === cleanTarget) return true;
              if (cleanPhone(intel.mobile_phone) === cleanTarget) return true;
              if (cleanPhone(intel.corporate_phone) === cleanTarget) return true;
              if (cleanPhone(intel.other_phone) === cleanTarget) return true;
            }
          } catch {}
        }
        return false;
      });

      const eventId = crypto.randomUUID();
      const smsPayload = {
        event_id: eventId,
        source: 'quo_webhook',
        quo_message_id: msg.id,
        direction: isIncoming ? 'inbound' : 'outbound',
        phone_number: rawTargetPhone,
        outcome_type: isIncoming ? 'SMS_INBOUND' : 'SMS_OUTBOUND',
        duration_seconds: 0,
        contact_id: matchedLead ? matchedLead.id : null,
        contact_name: matchedLead ? matchedLead.customer_name : 'Quo Contact',
        company_name: matchedLead ? matchedLead.company_name : 'Commercial Prospect',
        notes: `[Quo SMS ${isIncoming ? 'Received' : 'Sent'}] "${messageBody}"`,
        rep_name: 'Quo SMS Sync',
        timestamp: createdAt,
      };

      await supabase.from('events').insert({
        event_id: eventId,
        rep_id: matchedLead?.rep_id || matchedLead?.assigned_to || null,
        type: 'PHONE_CALL',
        payload: smsPayload,
        created_at: createdAt,
      });

      if (matchedLead && matchedLead.status === 'new') {
        await supabase
          .from('leads')
          .update({ status: 'contacted', updated_at: createdAt })
          .eq('id', matchedLead.id);
      }

      return NextResponse.json({
        success: true,
        matched: !!matchedLead,
        lead_id: matchedLead?.id || null,
        sms: smsPayload
      }, { status: 200 });
    }

    // 4. Handle contact.updated & contact.created (Quo Contact Book Sync)
    if (eventType === 'contact.updated' || eventType === 'contact.created') {
      const contactObj = eventData;
      const contactName = (
        contactObj.name ||
        `${contactObj.firstName || ''} ${contactObj.lastName || ''}`.trim()
      );
      const companyName = contactObj.company || contactObj.organization || 'Commercial Prospect';
      const email = contactObj.email || (Array.isArray(contactObj.emails) ? contactObj.emails[0]?.value || contactObj.emails[0] : null);

      const phones: string[] = [];
      if (contactObj.phone) phones.push(contactObj.phone);
      if (contactObj.phoneNumber) phones.push(contactObj.phoneNumber);
      if (Array.isArray(contactObj.phoneNumbers)) {
        contactObj.phoneNumbers.forEach((p: any) => {
          if (typeof p === 'string') phones.push(p);
          else if (p?.value) phones.push(p.value);
        });
      }

      if (contactName && phones.length > 0) {
        const primaryPhone = phones[0];
        const cleanTarget = cleanPhone(primaryPhone);

        const { data: allLeads } = await supabase
          .from('leads')
          .select('*')
          .order('created_at', { ascending: false });

        const matchedLead = (allLeads || []).find((l: any) => cleanPhone(l.customer_phone) === cleanTarget);

        if (matchedLead) {
          await supabase
            .from('leads')
            .update({
              customer_name: contactName,
              company_name: companyName !== 'Commercial Prospect' ? companyName : matchedLead.company_name,
              customer_email: email || matchedLead.customer_email,
              updated_at: new Date().toISOString()
            })
            .eq('id', matchedLead.id);
        } else {
          await supabase
            .from('leads')
            .insert({
              customer_name: contactName,
              company_name: companyName,
              customer_phone: primaryPhone,
              customer_email: email,
              source: 'quo_telephony',
              status: 'new',
              service_type: 'post_construction_clean'
            });
        }
      }

      return NextResponse.json({ success: true, processed: true }, { status: 200 });
    }

    // 5. Handle call.ringing & status pings
    if (eventType === 'call.ringing') {
      return NextResponse.json({ success: true, ringing: true }, { status: 200 });
    }

    return NextResponse.json({ success: true, ignored: eventType }, { status: 200 });
  } catch (err: any) {
    console.error('[Quo Webhook] Exception:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
