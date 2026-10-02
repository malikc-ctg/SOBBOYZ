import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';

export async function POST(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
  // Admin-only
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

    const supabase = await createServiceClient();
    const { id } = params;
    const { payout_reference } = await request.json();

    if (!payout_reference) {
      return NextResponse.json({ error: 'payout_reference required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('employee_payouts')
      .update({
        status: 'completed',
        payout_reference,
        paid_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, job:jobs(*), employee:employees(*)')
      .single();

    if (error) throw error;

    // Update job status to paid_out if currently reviewed
    if (data.job?.status === 'reviewed') {
      await supabase
        .from('jobs')
        .update({ status: 'paid_out', updated_at: new Date().toISOString() })
        .eq('id', data.job_id);
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
