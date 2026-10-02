import { requireRole } from '@/lib/api-auth';
import { NextRequest, NextResponse } from 'next/server';
import { reconcilePurchaseToZone } from '@/lib/supply-reconciliation';

export async function POST(req: NextRequest) {
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const {
      vendorName,
      source,
      orderReference,
      purchaseDate,
      totalAmount,
      zoneId,
      items,
    } = body;

    if (!vendorName || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'vendorName and items array are required' },
        { status: 400 }
      );
    }

    const result = await reconcilePurchaseToZone({
      vendorName,
      source: source || 'home_depot_pro_xtra',
      orderReference: orderReference || `REC-${Date.now().toString().slice(-6)}`,
      purchaseDate: purchaseDate || new Date().toISOString().split('T')[0],
      totalAmount: parseFloat(totalAmount) || 0,
      zoneId: zoneId === 'all' ? null : zoneId || null,
      items,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully reconciled ${result.reconciledCount} items into zone stock!`,
      ...result,
    });
  } catch (err: unknown) {
    console.error('Failed to commit purchase reconciliation:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
