import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/api-auth';
import { NextRequest, NextResponse } from 'next/server';

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

    return NextResponse.json({ success: true, synced: data?.length || payload.length });
  } catch (err: any) {
    console.error('[API /api/sales/sync] Exception:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
