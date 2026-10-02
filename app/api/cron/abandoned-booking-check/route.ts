import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron-auth';
import { processAbandonedBookings } from '@/lib/marketing-automation';

export async function GET(request: NextRequest) {
  const unauthorized = verifyCronRequest(request);
  if (unauthorized) return unauthorized;

  try {
    await processAbandonedBookings();
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
