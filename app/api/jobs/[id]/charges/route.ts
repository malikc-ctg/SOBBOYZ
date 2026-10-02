import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/api-auth';
import { NextResponse } from 'next/server';

const MAX_CHARGE_AMOUNT = 10_000;
const MAX_DESCRIPTION_LENGTH = 200;

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = await createServiceClient();

    const { amount, description } = await request.json();
    if (!amount || !description) {
      return NextResponse.json({ error: 'Missing amount or description' }, { status: 400 });
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0 || parsedAmount > MAX_CHARGE_AMOUNT) {
      return NextResponse.json(
        { error: `Amount must be a positive number up to ${MAX_CHARGE_AMOUNT}` },
        { status: 400 }
      );
    }
    const chargeAmount = Math.round(parsedAmount * 100) / 100;

    const cleanDescription = String(description).trim().slice(0, MAX_DESCRIPTION_LENGTH);
    if (!cleanDescription) {
      return NextResponse.json({ error: 'Missing amount or description' }, { status: 400 });
    }

    // Get current job to increment price and append to addons
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select('quoted_price, add_ons, assigned_employee_id, assigned_employee_ids')
      .eq('id', params.id)
      .single();

    if (jobError || !job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Only admins or an employee assigned to this job can add charges
    if (auth.role !== 'admin') {
      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('profile_id', auth.id)
        .maybeSingle();

      let isAssigned =
        !!employee &&
        (job.assigned_employee_id === employee.id ||
          (Array.isArray(job.assigned_employee_ids) && job.assigned_employee_ids.includes(employee.id)));

      if (!isAssigned && employee) {
        const { data: cleanerRow } = await supabase
          .from('job_cleaners')
          .select('id')
          .eq('job_id', params.id)
          .eq('employee_id', employee.id)
          .maybeSingle();
        isAssigned = !!cleanerRow;
      }

      if (!isAssigned) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    const newAddOns = [...(job.add_ons || []), `Extra: ${cleanDescription} ($${chargeAmount})`];
    const newPrice = Number(job.quoted_price) + chargeAmount;

    const { error: updateError } = await supabase
      .from('jobs')
      .update({
        quoted_price: newPrice,
        add_ons: newAddOns,
      })
      .eq('id', params.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Refresh finance PnL because job price increased
    try {
      await supabase.rpc('refresh_zone_monthly_pnl');
    } catch (pnlError) {
      console.error('Failed to refresh PnL view:', pnlError);
    }

    return NextResponse.json({ success: true, newPrice, newAddOns });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
