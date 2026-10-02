import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

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
 * POST /api/sales/webhooks/quo
 * Real-time Webhook Receiver for Quo (formerly OpenPhone)
 * Automatically syncs completed calls, durations, outcomes, and AI call summaries directly into Sea of Blue
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServiceClient();
    const body = await request.json();

    const eventType = body.type;
    const eventData = body.data?.object || body.data || {};

    // 1. Handle call.completed
    if (eventType === 'call.completed' || body.object === 'call') {
      const call = eventData;
      const direction = (call.direction || 'outbound').toLowerCase();
      // If outbound, we dialed 'to'. If inbound, prospect called 'from'.
      const rawTargetPhone = direction === 'outbound' ? (call.to || call.destination) : (call.from || call.source);
      const cleanTarget = cleanPhone(rawTargetPhone);
      const durationSeconds = Number(call.duration || 0);
      const status = call.status || 'completed';
      const startedAt = call.startedAt || call.created_at || new Date().toISOString();
      const endedAt = call.endedAt || new Date().toISOString();

      // Determine initial outcome classification based on telephony status and talk time
      let outcomeType = 'CONVO';
      if (status === 'missed' || status === 'abandoned' || durationSeconds === 0) {
        outcomeType = 'NO_ANSWER';
      } else if (durationSeconds < 35) {
        outcomeType = 'VOICEMAIL';
      } else if (durationSeconds >= 120) {
        outcomeType = 'CONVO'; // Highly engaged decision maker call
      }

      // Look up matching lead in Supabase across all active leads
      const { data: allLeads } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false });

      // Fuzzy match against phone numbers (customer_phone, direct desk, mobile, HQ)
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
      const callPayload = {
        event_id: eventId,
        source: 'quo_webhook',
        quo_call_id: call.id,
        direction,
        phone_number: rawTargetPhone,
        duration_seconds: durationSeconds,
        outcome_type: outcomeType,
        contact_id: matchedLead ? matchedLead.id : null,
        contact_name: matchedLead ? matchedLead.customer_name : 'Quo Contact',
        company_name: matchedLead ? matchedLead.company_name : 'Unknown Firm',
        notes: `[Auto-Logged from Quo] ${direction.toUpperCase()} call (${durationSeconds}s). Status: ${status}`,
        rep_name: 'Quo VoIP Sync',
        timestamp: endedAt,
      };

      // Record in public.events
      const { error: eventError } = await supabase.from('events').insert({
        event_id: eventId,
        rep_id: '07853cdf-ed2c-4f3b-b713-cde7c40e20a1',
        type: 'PHONE_CALL',
        payload: callPayload,
        created_at: endedAt,
      });

      if (eventError) {
        console.error('[Quo Webhook] Event insert error:', eventError);
      }

      // If matched lead, auto-update lead status to contacted
      if (matchedLead) {
        const updatePayload: any = { updated_at: endedAt };
        if (matchedLead.status === 'new') {
          updatePayload.status = 'contacted';
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

    // 2. Handle call.summary.completed (Sona AI Call Summary)
    if (eventType === 'call.summary.completed' || eventType === 'call.recording.completed') {
      const summaryText = eventData.summary || eventData.transcript || '';
      const recordingUrl = eventData.recordingUrl || eventData.url || '';
      const quoCallId = eventData.callId || eventData.id;

      if (quoCallId && (summaryText || recordingUrl)) {
        // Find the event logged for this call
        const { data: existingEvents } = await supabase
          .from('events')
          .select('*')
          .eq('type', 'PHONE_CALL')
          .limit(20);

        const targetEvent = (existingEvents || []).find((e: any) => {
          const p = typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload;
          return p?.quo_call_id === quoCallId;
        });

        if (targetEvent) {
          const p = typeof targetEvent.payload === 'string' ? JSON.parse(targetEvent.payload) : targetEvent.payload;
          if (summaryText) p.ai_summary = summaryText;
          if (recordingUrl) p.recording_url = recordingUrl;
          p.notes = `${p.notes} | AI Summary: ${summaryText}`;

          await supabase
            .from('events')
            .update({ payload: p })
            .eq('event_id', targetEvent.event_id);
        }
      }

      return NextResponse.json({ success: true, processed: true }, { status: 200 });
    }

    return NextResponse.json({ success: true, ignored: eventType }, { status: 200 });
  } catch (err: any) {
    console.error('[Quo Webhook] Exception:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
