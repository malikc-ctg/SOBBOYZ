import { NextRequest, NextResponse } from 'next/server';
import { verifyCronRequest } from '@/lib/cron-auth';
import { getLowStockAlerts } from '@/lib/supply-management';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const unauthorized = verifyCronRequest(request);
  if (unauthorized) return unauthorized;

  try {
    const alerts = await getLowStockAlerts();

    if (alerts.length > 0) {
      const supabase = await createServiceClient();
      // Create admin notifications for each low-stock item
      for (const alert of alerts) {
        const item = alert.item as { name: string; reorder_threshold: number } | null;
        const zone = alert.zone as { name: string } | null;
        await supabase.from('notifications').insert({
          notification_type: 'low_stock_alert',
          channel: 'internal',
          message: `Low stock: ${item?.name ?? 'Unknown item'} in ${zone?.name ?? 'all zones'} — ${alert.quantity_on_hand} remaining (threshold: ${item?.reorder_threshold ?? 20})`,
          sent_at: new Date().toISOString(),
          delivered: true,
        });
      }
    }

    return NextResponse.json({ ok: true, alerts_count: alerts.length });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
