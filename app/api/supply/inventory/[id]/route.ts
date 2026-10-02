import { requireRole } from '@/lib/api-auth';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = await createServiceClient();
    const body = await request.json();
    const { quantity_on_hand, delta } = body;

    let newQty: number;

    if (typeof quantity_on_hand === 'number') {
      newQty = Math.max(0, quantity_on_hand);
    } else if (typeof delta === 'number') {
      const { data: current, error: curErr } = await supabase
        .from('supply_inventory')
        .select('quantity_on_hand')
        .eq('id', params.id)
        .single();
      if (curErr) throw curErr;
      newQty = Math.max(0, (current?.quantity_on_hand ?? 0) + delta);
    } else {
      return NextResponse.json({ error: 'quantity_on_hand or delta required' }, { status: 400 });
    }

    const { data: updated, error: updateErr } = await supabase
      .from('supply_inventory')
      .update({
        quantity_on_hand: newQty,
        last_updated: new Date().toISOString(),
        ...(typeof delta === 'number' && delta > 0 ? { last_restocked_at: new Date().toISOString() } : {}),
      })
      .eq('id', params.id)
      .select('*, item:supply_items(*), zone:zones(name)')
      .single();

    if (updateErr) throw updateErr;

    const category = (updated.item?.category || '').toLowerCase();
    const isDurable = category === 'tool' || category === 'equipment';
    const threshold = updated.item?.reorder_threshold ?? 2;

    return NextResponse.json({
      ...updated,
      is_low_stock: !isDurable && updated.quantity_on_hand <= threshold,
    });
  } catch (err: unknown) {
    console.error('Error updating inventory:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = await createServiceClient();
    
    // Find item_id first
    const { data: inv } = await supabase
      .from('supply_inventory')
      .select('item_id')
      .eq('id', params.id)
      .single();

    // Delete inventory row
    const { error: delInvErr } = await supabase
      .from('supply_inventory')
      .delete()
      .eq('id', params.id);

    if (delInvErr) throw delInvErr;

    // Also deactivate the supply_item if no other inventory rows exist
    if (inv?.item_id) {
      await supabase
        .from('supply_items')
        .update({ is_active: false })
        .eq('id', inv.item_id);
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('Error deleting inventory item:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
