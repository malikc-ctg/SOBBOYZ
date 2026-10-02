import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import {
  getProfitAndLoss,
  getAgedReceivables,
  getTaxSummary,
  getAccountBalances,
  getRecentInvoices,
} from '@/lib/quickbooks/reports';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(['admin']);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type');
    const startDate = searchParams.get('start_date') || '';
    const endDate = searchParams.get('end_date') || '';

    let data;
    switch (type) {
      case 'pnl':
        data = await getProfitAndLoss(startDate, endDate);
        break;
      case 'aged_receivables':
        data = await getAgedReceivables();
        break;
      case 'tax_summary':
        data = await getTaxSummary(startDate, endDate);
        break;
      case 'accounts':
        data = await getAccountBalances();
        break;
      case 'invoices':
        data = await getRecentInvoices(25);
        break;
      default:
        return NextResponse.json({ error: 'Invalid report type' }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
