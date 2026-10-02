import { requireRole } from '@/lib/api-auth';
import { NextRequest, NextResponse } from 'next/server';
import { updateEquipmentCustody } from '@/lib/equipment-management';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { action, contractorId, condition, notes } = body;

    if (!action || !['checkout', 'checkin', 'maintenance'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be checkout, checkin, or maintenance' },
        { status: 400 }
      );
    }

    const updated = await updateEquipmentCustody({
      assetId: params.id,
      action,
      contractorId,
      condition: condition || 'good',
      notes,
    });

    return NextResponse.json({ success: true, asset: updated });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
