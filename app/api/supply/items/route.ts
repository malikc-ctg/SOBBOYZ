import { requireRole } from '@/lib/api-auth';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export async function GET() {
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from('supply_items')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = await createServiceClient();
    const body = await request.json();

    const {
      name,
      sku,
      unit,
      reorder_threshold,
      cost_per_unit,
      initial_quantity,
      zone_id,
      supplier_url,
      category,
      home_depot_sku,
      amazon_asin,
      preferred_store,
      dilution_ratio,
    } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Item name is required' }, { status: 400 });
    }

    const insertPayload: Record<string, any> = {
      name: name.trim(),
      sku: sku?.trim() || null,
      unit: unit?.trim() || 'units',
      reorder_threshold: typeof reorder_threshold === 'number' ? reorder_threshold : parseInt(reorder_threshold || '10', 10),
      cost_per_unit: cost_per_unit != null && cost_per_unit !== '' ? parseFloat(cost_per_unit) : null,
      supplier_url: supplier_url?.trim() || null,
      is_active: true,
    };

    if (category) insertPayload.category = category;
    if (home_depot_sku) insertPayload.home_depot_sku = home_depot_sku.trim();
    if (amazon_asin) insertPayload.amazon_asin = amazon_asin.trim();
    if (preferred_store) insertPayload.preferred_store = preferred_store;
    if (dilution_ratio) insertPayload.dilution_ratio = dilution_ratio;

    const { data: item, error: itemError } = await supabase
      .from('supply_items')
      .insert(insertPayload)
      .select()
      .single();

    if (itemError) throw itemError;

    const initialQty = typeof initial_quantity === 'number' ? initial_quantity : parseInt(initial_quantity || '0', 10);
    const targetZoneId = zone_id && zone_id !== 'all' ? zone_id : null;

    const { data: inv, error: invError } = await supabase
      .from('supply_inventory')
      .insert({
        item_id: item.id,
        zone_id: targetZoneId,
        quantity_on_hand: Math.max(0, initialQty),
        last_restocked_at: initialQty > 0 ? new Date().toISOString() : null,
        last_updated: new Date().toISOString(),
      })
      .select('*, item:supply_items(*), zone:zones(name)')
      .single();

    if (invError) throw invError;

    return NextResponse.json(
      {
        ...inv,
        is_low_stock: inv.quantity_on_hand <= (item.reorder_threshold ?? 10),
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error('Error creating supply item:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
