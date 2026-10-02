import { requireRole } from '@/lib/api-auth';
import { NextRequest, NextResponse } from 'next/server';
import { calculateSupplyDemand } from '@/lib/supply-demand-forecasting';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const zoneId = searchParams.get('zone_id') || undefined;

    const forecast = await calculateSupplyDemand(zoneId);
    return NextResponse.json(forecast);
  } catch (err: unknown) {
    console.error('Failed to calculate supply demand:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
