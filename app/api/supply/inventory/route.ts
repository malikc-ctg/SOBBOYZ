import { requireRole } from '@/lib/api-auth';
import { NextRequest, NextResponse } from 'next/server';
import { getInventoryWithAlerts } from '@/lib/supply-management';

export async function GET(request: NextRequest) {
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const zone_id = searchParams.get('zone_id') ?? undefined;
    const inventory = await getInventoryWithAlerts(zone_id);
    return NextResponse.json(inventory);
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
