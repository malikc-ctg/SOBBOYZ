import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await requireRole(['admin']);
    if (auth instanceof NextResponse) return auth;

    const { id } = params;
    const supabase = await createServiceClient();

    // Fetch customer profile
    const { data: customer, error: custError } = await supabase
      .from('customers')
      .select('*, zone:zones(*)')
      .eq('id', id)
      .single();

    if (custError || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Fetch jobs
    const { data: jobs } = await supabase
      .from('jobs')
      .select('*, employee:contractors(id, full_name, phone)')
      .eq('customer_id', id)
      .order('scheduled_date', { ascending: false });

    // Fetch recurring agreements
    const { data: recurring } = await supabase
      .from('recurring_bookings')
      .select('*, employee:contractors(id, full_name, phone)')
      .eq('customer_id', id)
      .order('created_at', { ascending: false });

    const jobList = jobs || [];
    const recurringList = recurring || [];

    // Calculate aggregated metrics
    const completedJobs = jobList.filter(j => j.status === 'completed' || j.status === 'paid_out');
    const lifetimeSpend = completedJobs.reduce((acc, j) => acc + (Number(j.quoted_price) || 0), 0);
    const lastClean = completedJobs.length > 0 ? completedJobs[0].scheduled_date : null;

    const upcomingJobs = jobList.filter(
      j => (j.status === 'confirmed' || j.status === 'assigned' || j.status === 'quoted') &&
           new Date(j.scheduled_date) >= new Date(new Date().toDateString())
    ).sort((a, b) => new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime());
    const nextClean = upcomingJobs.length > 0 ? upcomingJobs[0] : null;

    const activeRecurring = recurringList.filter(r => r.is_active);
    const mrrAmount = activeRecurring.reduce((acc, r) => acc + (Number(r.monthly_amount) || (Number(r.quoted_price) * 2.16)), 0);

    return NextResponse.json({
      customer,
      jobs: jobList,
      recurring: recurringList,
      metrics: {
        total_jobs: jobList.length,
        completed_jobs_count: completedJobs.length,
        lifetime_spend: lifetimeSpend,
        last_clean_date: lastClean,
        next_clean: nextClean,
        has_recurring: activeRecurring.length > 0,
        mrr_amount: Math.round(mrrAmount * 100) / 100,
      }
    });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await requireRole(['admin']);
    if (auth instanceof NextResponse) return auth;

    const { id } = params;
    const body = await request.json();
    const supabase = await createServiceClient();

    // Whitelist allowed fields for update
    const allowedFields = [
      'full_name',
      'company_name',
      'customer_type',
      'commercial_facility_type',
      'email',
      'phone',
      'address_line1',
      'address_line2',
      'city',
      'province',
      'postal_code',
      'zone_id',
      'notes',
      'square_footage',
      'accounts_payable_name',
      'accounts_payable_email',
      'accounts_payable_phone',
      'billing_terms',
      'tax_id',
      'tax_exempt',
      'access_code',
      'alarm_instructions',
      'parking_instructions',
      'pet_details',
      'home_bedrooms',
      'home_bathrooms',
      'special_instructions',
      'credit_balance',
      'customer_score',
      'is_active',
    ];

    const updatePayload: Record<string, any> = {};
    for (const key of allowedFields) {
      if (key in body) {
        updatePayload[key] = body[key];
      }
    }

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided for update' }, { status: 400 });
    }

    // Auto-align customer_type if company_name is specified
    if (updatePayload.company_name && !updatePayload.customer_type) {
      updatePayload.customer_type = 'commercial';
    }

    updatePayload.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('customers')
      .update(updatePayload)
      .eq('id', id)
      .select('*, zone:zones(*)')
      .single();

    if (error) {
      console.error('Error updating customer:', error);
      throw error;
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
