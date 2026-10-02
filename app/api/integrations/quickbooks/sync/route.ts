import { requireRole } from '@/lib/api-auth';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import {
  syncPartnerInvoiceToQBO,
  syncJobToQBO,
  testQuickBooksConnection,
} from '@/lib/quickbooks/sync';

export async function POST(request: NextRequest) {
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json().catch(() => ({}));
    const action = body.action || 'test';

    if (action === 'test') {
      const result = await testQuickBooksConnection();
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }
      return NextResponse.json({ success: true, companyName: result.companyName });
    }

    if (action === 'sync_partner_invoice') {
      if (!body.partnerInvoiceId) {
        return NextResponse.json({ error: 'partnerInvoiceId is required' }, { status: 400 });
      }
      const result = await syncPartnerInvoiceToQBO(body.partnerInvoiceId);
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }
      return NextResponse.json(result);
    }

    if (action === 'sync_job') {
      if (!body.jobId) {
        return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
      }
      const result = await syncJobToQBO(body.jobId);
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 400 });
      }
      return NextResponse.json(result);
    }

    if (action === 'sync_pending_invoices') {
      const supabase = await createServiceClient();
      // Fetch up to 10 partner invoices without QBO ID
      const { data: unlinkedInvoices, error: fetchError } = await supabase
        .from('partner_invoices')
        .select('id, invoice_number')
        .is('qbo_invoice_id', null)
        .order('created_at', { ascending: false })
        .limit(10);

      if (fetchError) {
        return NextResponse.json({ error: fetchError.message }, { status: 500 });
      }

      if (!unlinkedInvoices || unlinkedInvoices.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'All partner invoices are already synced to QuickBooks.',
          syncedCount: 0,
        });
      }

      const results = [];
      for (const inv of unlinkedInvoices) {
        const syncRes = await syncPartnerInvoiceToQBO(inv.id);
        results.push({ invoiceNumber: inv.invoice_number, ...syncRes });
      }

      return NextResponse.json({
        success: true,
        syncedCount: results.filter((r) => r.success).length,
        total: unlinkedInvoices.length,
        details: results,
      });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
