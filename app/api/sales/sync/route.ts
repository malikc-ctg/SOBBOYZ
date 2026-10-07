import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/api-auth';
import { NextRequest, NextResponse } from 'next/server';
import { nextLeadStatus } from '@/lib/sales/followups/leadStatus';
import { runEngineForEvent } from '@/lib/sales/followups/executor';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const supabase = await createServiceClient();
    const body = await request.json();
    const events = Array.isArray(body) ? body : body.events;

    if (!events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ success: true, synced: 0 });
    }

    const authenticatedRepId = auth.id;

    const payload = events.map((e: any) => {
      const p = typeof e.payload === 'string' ? JSON.parse(e.payload) : (e.payload || {});
      const repId = e.rep_id || p.rep_id || authenticatedRepId;
      return {
        event_id: e.event_id || crypto.randomUUID(),
        rep_id: repId,
        type: e.type,
        payload: {
          ...p,
          rep_id: repId,
          mode: (p.mode || 'residential').toLowerCase(),
        },
        created_at: e.created_at || new Date().toISOString(),
      };
    });

    const { data, error } = await supabase
      .from('events')
      .upsert(payload, { onConflict: 'event_id' })
      .select();

    if (error) {
      console.error('[API /api/sales/sync] Upsert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Process lead status updates and follow-up engine for synced phone calls
    for (const e of payload) {
      if (e.type === 'PHONE_CALL') {
        const p = e.payload || {};
        const contactId = p.contact_id;
        if (contactId) {
          const rawLeadId = String(contactId).replace(/^lead_/, '');
          try {
            const { data: currentLead } = await supabase
              .from('leads')
              .select('id, status, updated_at')
              .eq('id', rawLeadId)
              .maybeSingle();

            if (currentLead) {
              const eventTime = new Date(e.created_at).getTime();
              const leadUpdatedTime = currentLead.updated_at ? new Date(currentLead.updated_at).getTime() : 0;

              if (eventTime > leadUpdatedTime) {
                const nextStatus = nextLeadStatus(currentLead.status, p.outcome_type, p.lead_status);
                if (nextStatus) {
                  await supabase
                    .from('leads')
                    .update({ status: nextStatus, updated_at: e.created_at })
                    .eq('id', rawLeadId);
                }
              }

              // Run follow-up engine (deduplicated by event_id in sales_followup_processed_events)
              const summary = await runEngineForEvent(e, { sessionUserId: e.rep_id });
              if (summary?.statusOverride) {
                await supabase
                  .from('leads')
                  .update({ status: summary.statusOverride, updated_at: e.created_at })
                  .eq('id', rawLeadId);
              }
            }
          } catch (itemErr) {
            console.warn('[API /api/sales/sync] Error processing event for lead:', rawLeadId, itemErr);
          }
        }
      }
    }

    return NextResponse.json({ success: true, synced: data?.length || payload.length });
  } catch (err: any) {
    console.error('[API /api/sales/sync] Exception:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
