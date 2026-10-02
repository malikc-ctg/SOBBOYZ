import { requireRole } from '@/lib/api-auth';
import { NextResponse } from 'next/server';
import { getVendorExpenses } from '@/lib/quickbooks/reports';
import {
  detectCategory,
  matchPurchaseItems,
  ParsedPurchase,
} from '@/lib/supply-reconciliation';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const startDate = thirtyDaysAgo.toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];

    const purchases = await getVendorExpenses(startDate, endDate);

    // Filter for Home Depot, Amazon, and janitorial supply vendors
    const supplyVendors = ['home depot', 'amazon', 'uline', 'swish', 'canadian tire', 'costco'];
    const filtered = (purchases || []).filter((p: any) => {
      const vendorName = (p.EntityRef?.name || '').toLowerCase();
      return supplyVendors.some((v) => vendorName.includes(v));
    });

    const parsedBatches: ParsedPurchase[] = [];

    for (const p of filtered) {
      const vendorName = p.EntityRef?.name || 'Supply Vendor';
      const orderRef = p.DocNumber || `QBO-${p.Id}`;
      const purchaseDate = p.TxnDate || startDate;
      const totalAmount = parseFloat(p.TotalAmt) || 0;

      const lines = p.Line || [];
      const items = lines
        .filter((l: any) => l.DetailType === 'AccountBasedExpenseLineDetail' || l.DetailType === 'ItemBasedExpenseLineDetail')
        .map((l: any) => {
          const desc = l.Description || `${vendorName} Supply Expense`;
          const amount = parseFloat(l.Amount) || 0;
          return {
            rawIdentifier: l.ItemBasedExpenseLineDetail?.ItemRef?.name || '',
            rawDescription: desc,
            category: detectCategory(desc),
            quantity: parseFloat(l.ItemBasedExpenseLineDetail?.Qty) || 1,
            unitPrice: parseFloat(l.ItemBasedExpenseLineDetail?.UnitPrice) || amount,
            totalPrice: amount,
            confidence: 0,
          };
        });

      if (items.length > 0) {
        const matchedItems = await matchPurchaseItems(vendorName, items);
        parsedBatches.push({
          vendorName,
          source: 'quickbooks_sync',
          orderReference: orderRef,
          purchaseDate,
          totalAmount,
          items: matchedItems,
        });
      }
    }

    return NextResponse.json({
      count: parsedBatches.length,
      purchases: parsedBatches,
    });
  } catch (err: unknown) {
    console.error('Failed to sync supply expenses from QuickBooks:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
