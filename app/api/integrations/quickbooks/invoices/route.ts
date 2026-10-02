import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { getInvoiceById } from '@/lib/quickbooks/reports';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRole(['admin']);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const idsParam = searchParams.get('ids');
    if (!idsParam) {
      return NextResponse.json({ error: 'Missing ids parameter' }, { status: 400 });
    }

    const ids = idsParam.split(',').filter(Boolean);
    const results = await Promise.all(
      ids.map(async (id) => {
        const inv = await getInvoiceById(id.trim());
        return {
          Id: id.trim(),
          id: id.trim(),
          status: inv ? 'Found' : 'Not Found',
          Balance: Number(inv?.Balance || 0),
          TotalAmt: Number(inv?.TotalAmt || 0),
          DueDate: inv?.DueDate || null,
          DocNumber: inv?.DocNumber || null,
        };
      })
    );

    return NextResponse.json({ invoices: results, data: results });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
