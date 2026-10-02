import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { getVendorExpenses } from '@/lib/quickbooks/reports';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(['admin']);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('start_date') || '';
    const endDate = searchParams.get('end_date') || '';

    const expenses = await getVendorExpenses(startDate, endDate);

    return NextResponse.json({ data: expenses });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
