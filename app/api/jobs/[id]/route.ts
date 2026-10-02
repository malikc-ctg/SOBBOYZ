import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireRole(['admin', 'employee']);
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = await createServiceClient();
    const isAdmin = auth.role === 'admin';

    const { data, error } = await supabase
      .from('jobs')
      .select('*, customer:customers(*), employee:employees(*), zone:zones(*)')
      .eq('id', params.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    // Employees may only view jobs they are assigned to or have been offered
    if (!isAdmin) {
      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('profile_id', auth.id)
        .maybeSingle();

      let allowed = false;
      if (employee) {
        allowed =
          data.assigned_employee_id === employee.id ||
          (Array.isArray(data.assigned_employee_ids) && data.assigned_employee_ids.includes(employee.id));

        if (!allowed) {
          const { data: cleanerRow } = await supabase
            .from('job_cleaners')
            .select('id')
            .eq('job_id', params.id)
            .eq('employee_id', employee.id)
            .maybeSingle();
          allowed = !!cleanerRow;
        }

        if (!allowed) {
          const { data: offerRow } = await supabase
            .from('job_offers')
            .select('id')
            .eq('job_id', params.id)
            .eq('employee_id', employee.id)
            .limit(1)
            .maybeSingle();
          allowed = !!offerRow;
        }
      }

      if (!allowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Fetch photos attached to this job
    const { data: photos } = await supabase
      .from('job_photos')
      .select('*, employee:employees(id, full_name, phone)')
      .eq('job_id', params.id)
      .order('uploaded_at', { ascending: true });

    data.photos = photos || [];

    // Fetch checklists attached to this job
    const { data: checklists } = await supabase
      .from('job_checklists')
      .select('*, employee:employees(id, full_name)')
      .eq('job_id', params.id)
      .order('submitted_at', { ascending: false });

    data.checklists = checklists || [];

    if (data?.assigned_employee_ids && Array.isArray(data.assigned_employee_ids) && data.assigned_employee_ids.length > 0) {
      const { data: crew } = await supabase
        .from('employees')
        .select('*')
        .in('id', data.assigned_employee_ids);
      data.assigned_employees = crew || [];
    } else if (data?.employee) {
      data.assigned_employees = [data.employee];
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error(`Error fetching job ${params.id}:`, err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
  // Admin-only
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

    const supabase = await createServiceClient();
    const body = await request.json();
    const { customer, employee, zone, ...updateData } = body;

    const { data, error } = await supabase
      .from('jobs')
      .update({ ...updateData, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select()
      .single();

    if (error) throw error;

    // Cascade relevant updates to Customer
    if (data.customer_id) {
      const custUpdate: any = {};
      if (body.city !== undefined) custUpdate.city = body.city;
      // You can expand this if jobs start tracking customer name/phone directly
      
      if (Object.keys(custUpdate).length > 0) {
        await supabase.from('customers').update(custUpdate).eq('id', data.customer_id);
      }
    }

    // Refresh finance PnL if price or status might have changed
    try {
      await supabase.rpc('refresh_zone_monthly_pnl');
    } catch (pnlError) {
      console.error('Failed to refresh PnL view:', pnlError);
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error(`Error updating job ${params.id}:`, err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
