import { requireRole } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { calculateMonthlyMRR } from '@/lib/recurring-utils';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = await createServiceClient();
    const body = await request.json();

    const updates: Record<string, any> = { ...body, updated_at: new Date().toISOString() };

    // Recompute MRR if quoted_price or days_of_week or frequency changed
    if (body.quoted_price !== undefined || body.frequency !== undefined || body.days_of_week !== undefined) {
      const { data: current } = await supabase
        .from('recurring_bookings')
        .select('*')
        .eq('id', params.id)
        .single();

      if (current) {
        const price = body.quoted_price !== undefined ? Number(body.quoted_price) : current.quoted_price;
        const freq = body.frequency || current.frequency;
        const days = body.days_of_week || current.days_of_week || [];
        updates.monthly_amount = calculateMonthlyMRR(price, freq, days);
      }
    }

    const { data, error } = await supabase
      .from('recurring_bookings')
      .update(updates)
      .eq('id', params.id)
      .select('*, customer:customers(*), employee:employees(*)')
      .single();

    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error('PATCH /api/recurring/[id] error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = await createServiceClient();
    const { error } = await supabase
      .from('recurring_bookings')
      .delete()
      .eq('id', params.id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('DELETE /api/recurring/[id] error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
