import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron-auth';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const unauthorized = verifyCronRequest(request);
  if (unauthorized) return unauthorized;

  try {
    const supabase = await createServiceClient();
    await supabase.rpc('refresh_zone_monthly_pnl');
    return NextResponse.json({ ok: true, refreshed_at: new Date().toISOString() });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
