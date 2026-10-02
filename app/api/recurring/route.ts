import { requireRole } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { calculateMonthlyMRR, calculateNextRunDate } from '@/lib/recurring-utils';

export async function GET(request: NextRequest) {
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = await createServiceClient();
    const customerId = request.nextUrl.searchParams.get('customer_id');

    let query = supabase
      .from('recurring_bookings')
      .select('*, customer:customers(*), employee:employees(*)')
      .order('created_at', { ascending: false });

    if (customerId) {
      query = query.eq('customer_id', customerId);
    }

    const { data, error } = await query;

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (err: unknown) {
    console.error('GET /api/recurring error:', err);
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
      customer_id,
      service_type,
      frequency,
      days_of_week = [],
      preferred_day_of_week = null,
      preferred_start_time = '09:00',
      estimated_duration_minutes = 180,
      preferred_employee_id = null,
      preferred_team_id = null,
      address_line1,
      city,
      postal_code,
      quoted_price,
      zone_id = null,
      notes = null,
      scope_of_work = null,
      start_date = new Date().toISOString().split('T')[0],
    } = body;

    const finalCity = (city || '').trim() || 'Toronto';
    const finalPostalCode = (postal_code || '').trim() || 'M5V 2T6';

    if (!service_type || !frequency || !address_line1 || quoted_price === undefined) {
      return NextResponse.json({ error: 'Missing required fields for recurring contract' }, { status: 400 });
    }

    // Calculate initial next run date
    const next_job_date = calculateNextRunDate(
      start_date,
      frequency,
      days_of_week,
      preferred_day_of_week
    );

    // Calculate MRR
    const monthly_amount = calculateMonthlyMRR(
      Number(quoted_price),
      frequency,
      days_of_week
    );

    const { data, error } = await supabase
      .from('recurring_bookings')
      .insert({
        customer_id: customer_id || null,
        service_type,
        frequency,
        days_of_week: days_of_week || [],
        preferred_day_of_week: preferred_day_of_week || null,
        preferred_start_time: preferred_start_time || '09:00',
        estimated_duration_minutes: Number(estimated_duration_minutes) || 180,
        preferred_employee_id: preferred_employee_id || null,
        preferred_team_id: preferred_team_id || null,
        address_line1,
        city: finalCity,
        postal_code: finalPostalCode,
        quoted_price: Number(quoted_price),
        monthly_amount,
        billing_type: 'per_visit',
        contract_start_date: start_date,
        scope_of_work,
        notes,
        zone_id: zone_id || null,
        is_active: true,
        next_job_date,
      })
      .select('*, customer:customers(*), employee:employees(*)')
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (err: unknown) {
    console.error('POST /api/recurring error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
