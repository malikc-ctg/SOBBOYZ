import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron-auth';
import { generateMonthlyInvoices } from '@/lib/partner-invoicing';

export async function GET(request: NextRequest) {
  const unauthorized = verifyCronRequest(request);
  if (unauthorized) return unauthorized;

  try {
    const now = new Date();
    // Generate invoices for the previous month
    const year = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const month = now.getMonth() === 0 ? 12 : now.getMonth();

    const result = await generateMonthlyInvoices(year, month);
    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
