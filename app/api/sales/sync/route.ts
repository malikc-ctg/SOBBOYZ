import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServiceClient();
    const body = await request.json();
    const events = Array.isArray(body) ? body : body.events;

    if (!events || !Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ success: true, synced: 0 });
    }

    let defaultRepId: string | null = null;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) defaultRepId = user.id;
    } catch {}

    const payload = events.map((e: any) => {
      const p = typeof e.payload === 'string' ? JSON.parse(e.payload) : (e.payload || {});
      const repId = e.rep_id || p.rep_id || defaultRepId || 'd616b5ed-d3a0-425d-b0c2-5f47a9320fc5';
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
