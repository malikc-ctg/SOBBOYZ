const { WebSocket } = require('ws');
global.WebSocket = WebSocket;
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apiKey = process.env.OPENPHONE_API_KEY || process.env.QUO_API_KEY || '9505d07dcbf15efa05a2ef945844930c90dec2bc1755bc295d3de6442d57c309';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
  realtime: { transport: WebSocket }
});

function toE164(raw) {
  if (!raw) return '';
  const withoutExt = raw.split(/ext|\bx\b|#/i)[0];
  const digits = withoutExt.replace(/[^0-9]/g, '');
  if (digits.length === 10) return '+1' + digits;
  if (digits.length === 11 && digits.startsWith('1')) return '+' + digits;
  if (digits.length > 0) return '+' + digits;
  return '';
}

function cleanPhone(raw) {
  if (!raw) return '';
  const digits = raw.replace(/[^0-9]/g, '');
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

function formatDialogue(dialogue) {
  if (!dialogue || !Array.isArray(dialogue)) return '';
  return dialogue.map(turn => {
    const speaker = turn.userId ? 'Sales Rep' : (turn.identifier || 'Prospect');
    const text = turn.content || turn.text || '';
    return `[${speaker}]: "${text}"`;
  }).join('\n');
}

async function run() {
  console.log('========================================================================');
  console.log('Quo (OpenPhone) Transcripts & AI Summaries Sync Engine');
  console.log('========================================================================\n');

  // 1. Fetch phone line IDs from Quo
  const linesRes = await fetch('https://api.openphone.com/v1/phone-numbers', {
    headers: { 'Authorization': apiKey }
  });
  if (!linesRes.ok) {
    console.error('Failed to fetch Quo phone numbers:', await linesRes.text());
    process.exit(1);
  }
  const linesData = await linesRes.json();
  const phoneNumbers = linesData.data || [];
  console.log(`Found ${phoneNumbers.length} Quo phone lines:`);
  phoneNumbers.forEach(l => console.log(` - ${l.name}: ${l.formattedNumber} (${l.id})`));

  // 2. Fetch all PHONE_CALL events in Sea of Blue
  const { data: events, error } = await supabase
    .from('events')
    .select('*')
    .eq('type', 'PHONE_CALL')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Database query error:', error);
    process.exit(1);
  }

  console.log(`\nFound ${events.length} PHONE_CALL events in Sea of Blue.`);

  // Group events by clean phone number
  const eventsByPhone = new Map();
  const uniqueTargetPhones = new Set();

  events.forEach(e => {
    let p = e.payload;
    if (typeof p === 'string') {
      try { p = JSON.parse(p); } catch { return; }
    }
    const cp = cleanPhone(p?.phone_number);
    if (cp) {
      if (!eventsByPhone.has(cp)) eventsByPhone.set(cp, []);
      eventsByPhone.get(cp).push({ event: e, payload: p });
      uniqueTargetPhones.add(p.phone_number);
    }
  });

  console.log(`Targeting ${uniqueTargetPhones.size} unique customer phone numbers...\n`);

  let matchedCallsCount = 0;
  let updatedEventsCount = 0;

  for (const rawPhone of uniqueTargetPhones) {
    const e164 = toE164(rawPhone);
    const cp = cleanPhone(rawPhone);
    if (!e164 || !cp) continue;

    const matchedEventsList = eventsByPhone.get(cp) || [];

    // Search across all 4 phone lines for calls with this participant
    for (const line of phoneNumbers) {
      try {
        const callsRes = await fetch(`https://api.openphone.com/v1/calls?phoneNumberId=${line.id}&participants[]=${encodeURIComponent(e164)}`, {
          headers: { 'Authorization': apiKey }
        });

        if (!callsRes.ok) continue;

        const callsData = await callsRes.json();
        const calls = callsData.data || [];

        for (const call of calls) {
          matchedCallsCount++;

          // Fetch transcript
          let fullTranscript = null;
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

          // Fetch Sona AI summary
          let summaryBullets = null;
          try {
            const sRes = await fetch(`https://api.openphone.com/v1/call-summaries/${call.id}`, {
              headers: { 'Authorization': apiKey }
            });
            if (sRes.ok) {
              const sData = await sRes.json();
              const sRaw = sData.data?.summary;
              if (Array.isArray(sRaw) && sRaw.length > 0) {
                summaryBullets = sRaw;
              }
            }
          } catch (se) {}

          // Fetch recording
          let recordingUrl = null;
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

          // Match with local event (best match by closest timestamp or first without transcript)
          const callTime = new Date(call.createdAt || call.startedAt).getTime();
          let bestEventMatch = matchedEventsList.find(item => {
            const evTime = new Date(item.event.created_at || item.payload.timestamp).getTime();
            return Math.abs(evTime - callTime) < 1800000; // within 30 mins
          });

          if (!bestEventMatch) {
            bestEventMatch = matchedEventsList[0];
          }

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
            if (call.duration && (!p.duration_seconds || p.duration_seconds === 0)) {
              p.duration_seconds = call.duration;
              modified = true;
            }

            if (summaryBullets && summaryBullets.length > 0) {
              const summaryStr = summaryBullets.join('. ');
              p.notes = `[Auto-Logged from Quo] ${p.direction?.toUpperCase() || 'COMPLETED'} call (${p.duration_seconds || call.duration || 0}s). Status: completed | AI Summary: ${summaryStr}`;
              modified = true;
            }

            if (modified) {
              await supabase
                .from('events')
                .update({ payload: p })
                .eq('event_id', bestEventMatch.event.event_id);

              updatedEventsCount++;
              console.log(`✓ Updated call log for ${p.contact_name || rawPhone} (${rawPhone}) [Call ID: ${call.id}]`);
              if (summaryBullets) {
                console.log(`   ↳ Sona AI Summary: ${summaryBullets[0].slice(0, 80)}...`);
              }
              if (fullTranscript) {
                console.log(`   ↳ Transcript: ${fullTranscript.split('\n').length} dialogue lines captured`);
              }
            }
          }
        }
      } catch (err) {
        // Continue loop
      }
    }
  }

  console.log('\n========================================================================');
  console.log(`Sync Complete!`);
  console.log(`- Total Quo calls inspected: ${matchedCallsCount}`);
  console.log(`- Sales OS call records updated with transcripts & AI summaries: ${updatedEventsCount}`);
  console.log('========================================================================\n');
}

run().catch(console.error);
