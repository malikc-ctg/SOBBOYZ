import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { linkEmployeeByVerifiedEmail } from '@/lib/employee-link';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const serviceClient = await createServiceClient();

    // Fetch the employee record
    let { data: employee } = await serviceClient
      .from('employees')
      .select('id, profile_id')
      .eq('profile_id', user.id)
      .maybeSingle();

    if (!employee) {
      const linkedId = await linkEmployeeByVerifiedEmail(serviceClient, user);
      if (linkedId) employee = { id: linkedId, profile_id: user.id };
    }

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Always check for an active open timesheet
    const { data: openTimesheet } = await serviceClient
      .from('employee_timesheets')
      .select('*')
      .eq('employee_id', employee.id)
      .eq('status', 'open')
      .order('clock_in_time', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Get URL params
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date'); // optional date filter
    
    let query = serviceClient
      .from('employee_timesheets')
      .select('*')
      .eq('employee_id', employee.id)
      .order('work_date', { ascending: false });

    if (date) {
      query = query.eq('work_date', date);
    }

    const { data, error } = await query;
    if (error) throw error;

    let results = data || [];
    // If there is an open timesheet and it's not already in results, prepend it
    if (openTimesheet && !results.some((t: any) => t.id === openTimesheet.id)) {
      results = [openTimesheet, ...results];
    }

    return NextResponse.json(results);
  } catch (err: any) {
    console.error('GET /api/employees/time error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // Clock In
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const serviceClient = await createServiceClient();

    let { data: employee } = await serviceClient
      .from('employees')
      .select('id, profile_id')
      .eq('profile_id', user.id)
      .maybeSingle();

    if (!employee) {
      const linkedId = await linkEmployeeByVerifiedEmail(serviceClient, user);
      if (linkedId) employee = { id: linkedId, profile_id: user.id };
    }

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Check if there is already an open timesheet
    const { data: existing } = await serviceClient
      .from('employee_timesheets')
      .select('*')
      .eq('employee_id', employee.id)
      .eq('status', 'open')
      .order('clock_in_time', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      // Return the existing open timesheet gracefully
      return NextResponse.json(existing, { status: 200 });
    }

    const body = await request.json().catch(() => ({}));

    const { data, error } = await serviceClient
      .from('employee_timesheets')
      .insert({
        employee_id: employee.id,
        work_date: new Date().toISOString().split('T')[0],
        clock_in_time: new Date().toISOString(),
        location_data: body.location_data || null,
        status: 'open',
      })
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('POST /api/employees/time error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
