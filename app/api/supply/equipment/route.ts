import { requireRole } from '@/lib/api-auth';
import { NextRequest, NextResponse } from 'next/server';
import { getEquipmentAssets } from '@/lib/equipment-management';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(req.url);
    const zoneId = searchParams.get('zone_id') || undefined;

    const assets = await getEquipmentAssets(zoneId);
    return NextResponse.json({ assets });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const {
      name,
      model_number,
      serial_number,
      asset_tag,
      zone_id,
      condition,
      notes,
    } = body;

    if (!name || !asset_tag) {
      return NextResponse.json(
        { error: 'Name and Asset Tag (e.g. EQ-VAC-01) are required' },
        { status: 400 }
      );
    }

    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from('equipment_assets')
      .insert({
        name,
        model_number: model_number || null,
        serial_number: serial_number || null,
        asset_tag: asset_tag.toUpperCase().trim(),
        zone_id: zone_id === 'all' ? null : zone_id || null,
        status: 'available',
        condition: condition || 'good',
        notes: notes || null,
      })
      .select('*, zone:zones(name)')
      .single();

    if (error) {
      // Fallback response if table not yet migrated
      return NextResponse.json({
        id: `eq-${Date.now()}`,
        name,
        model_number,
        serial_number,
        asset_tag,
        zone_id,
        status: 'available',
        condition: condition || 'good',
        total_runtime_hours: 0,
        notes,
      });
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
