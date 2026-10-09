import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/server';

function toE164(raw: string) {
  if (!raw) return '';
  const withoutExt = raw.split(/ext|\bx\b|#/i)[0];
  const digits = withoutExt.replace(/[^0-9]/g, '');
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  if (digits.length > 0) return '+' + digits;
  return '';
}

function cleanPhone(raw: string) {
  if (!raw) return '';
  const digits = raw.replace(/[^0-9]/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function formatDialogue(dialogue: any[]) {
  if (!dialogue || !Array.isArray(dialogue)) return '';
  return dialogue.map((turn: any) => {
    const speaker = turn.userId ? 'Sales Rep' : (turn.identifier || 'Prospect');
    const text = turn.content || turn.text || '';
    return `[${speaker}]: "${text}"`;
  }).join('\n');
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const apiKey = process.env.OPENPHONE_API_KEY || process.env.QUO_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'QUO_API_KEY / OPENPHONE_API_KEY is not configured' }, { status: 400 });
    }

    const supabase = await createServiceClient();

    // 1. Fetch phone line IDs from Quo
    const linesRes = await fetch('https://api.openphone.com/v1/phone-numbers', {
      headers: { 'Authorization': apiKey }
    });
    if (!linesRes.ok) {
      return NextResponse.json({ error: 'Failed to authenticate with Quo API' }, { status: 502 });
    }
    const linesData = await linesRes.json();
    const phoneNumbers = linesData.data || [];

    // 2. Fetch PHONE_CALL events
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .eq('type', 'PHONE_CALL')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const eventsByPhone = new Map<string, any[]>();
    const uniqueTargetPhones = new Set<string>();

    (events || []).forEach((e: any) => {
      let p = e.payload;
      if (typeof p === 'string') {
        try { p = JSON.parse(p); } catch { return; }
      }
      const cp = cleanPhone(p?.phone_number);
      if (cp) {
        if (!eventsByPhone.has(cp)) eventsByPhone.set(cp, []);
        eventsByPhone.get(cp)!.push({ event: e, payload: p });
        uniqueTargetPhones.add(p.phone_number);
      }
    });

    let updatedCount = 0;

    for (const rawPhone of Array.from(uniqueTargetPhones)) {
      const e164 = toE164(rawPhone);
      const cp = cleanPhone(rawPhone);
      if (!e164 || !cp) continue;

      const matchedEventsList = eventsByPhone.get(cp) || [];

      for (const line of phoneNumbers) {
        try {
          const callsRes = await fetch(`https://api.openphone.com/v1/calls?phoneNumberId=${line.id}&participants[]=${encodeURIComponent(e164)}`, {
            headers: { 'Authorization': apiKey }
          });
          if (!callsRes.ok) continue;

          const callsData = await callsRes.json();
          const calls = callsData.data || [];

          for (const call of calls) {
            let fullTranscript: string | null = null;
            try {
              const tRes = await fetch(`https://api.openphone.com/v1/call-transcripts/${call.id}`, {
                headers: { 'Authorization': apiKey }
              });
              if (tRes.ok) {
                const tData = await tRes.json();
                if (tData.data?.dialogue) {
                  fullTranscript = formatDialogue(tData.data.dialogue);
                } else if (typeof tData.data?.transcript === 'string') {
                  fullTranscript = tData.data.transcript;
                }
              }
            } catch (te) {}

            let summaryBullets: string[] | null = null;
            try {
              const sRes = await fetch(`https://api.openphone.com/v1/call-summaries/${call.id}`, {
                headers: { 'Authorization': apiKey }
              });
              if (sRes.ok) {
                const sData = await sRes.json();
                if (Array.isArray(sData.data?.summary)) {
                  summaryBullets = sData.data.summary;
                }
              }
            } catch (se) {}

            let recordingUrl: string | null = null;
            try {
              const rRes = await fetch(`https://api.openphone.com/v1/call-recordings/${call.id}`, {
                headers: { 'Authorization': apiKey }
              });
              if (rRes.ok) {
                const rData = await rRes.json();
                if (Array.isArray(rData.data) && rData.data[0]?.url) {
                  recordingUrl = rData.data[0].url;
                }
              }
            } catch (re) {}

            const callTime = new Date(call.createdAt || call.startedAt).getTime();
            const bestEventMatch = matchedEventsList.find((item) => {
              const evTime = new Date(item.event.created_at || item.payload.timestamp).getTime();
              return Math.abs(evTime - callTime) < 1800000;
            }) || matchedEventsList[0];

            if (bestEventMatch) {
              const p = bestEventMatch.payload;
              let modified = false;

              if (fullTranscript && p.transcript !== fullTranscript) {
                p.transcript = fullTranscript;
                modified = true;
              }
              if (summaryBullets && JSON.stringify(p.ai_summary) !== JSON.stringify(summaryBullets)) {
                p.ai_summary = summaryBullets;
                modified = true;
              }
              if (recordingUrl && p.recording_url !== recordingUrl) {
                p.recording_url = recordingUrl;
                modified = true;
              }
              if (call.id && p.quo_call_id !== call.id) {
                p.quo_call_id = call.id;
                p.source = 'quo_webhook';
                modified = true;
              }

              if (modified) {
                await supabase
                  .from('events')
                  .update({ payload: p })
                  .eq('event_id', bestEventMatch.event.event_id);
                updatedCount++;
              }
            }
          }
        } catch (err) {}
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully synchronized ${updatedCount} calls with Quo transcripts and Sona AI summaries.`,
      updatedCount
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
