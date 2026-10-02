import { requireRole } from '@/lib/api-auth';
import { NextRequest, NextResponse } from 'next/server';
import { createRestockOrder } from '@/lib/supply-management';
import { createServiceClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = await createServiceClient();
    const body = await request.json();
    const { item_id, zone_id, quantity_ordered, notes, auto_receive } = body;

    if (!item_id || !quantity_ordered) {
      return NextResponse.json({ error: 'item_id and quantity_ordered required' }, { status: 400 });
    }

    const qty = parseInt(quantity_ordered, 10);
    const targetZoneId = zone_id && zone_id !== 'all' ? zone_id : null;

    if (auto_receive) {
      // Direct restock: update or insert inventory quantity
      let query = supabase.from('supply_inventory').select('id, quantity_on_hand').eq('item_id', item_id);
      if (targetZoneId) {
        query = query.eq('zone_id', targetZoneId);
      } else {
        query = query.is('zone_id', null);
      }

      const { data: existing } = await query.maybeSingle();

      if (existing) {
        await supabase
          .from('supply_inventory')
          .update({
            quantity_on_hand: existing.quantity_on_hand + qty,
            last_restocked_at: new Date().toISOString(),
            last_updated: new Date().toISOString(),
          })
          .eq('id', existing.id);
      } else {
        await supabase.from('supply_inventory').insert({
          item_id,
          zone_id: targetZoneId,
          quantity_on_hand: qty,
          last_restocked_at: new Date().toISOString(),
          last_updated: new Date().toISOString(),
        });
      }
    } else {
      await createRestockOrder({ item_id, zone_id: targetZoneId, quantity_ordered: qty, notes });
    }

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err: unknown) {
    console.error('Error in /api/supply/restock:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
