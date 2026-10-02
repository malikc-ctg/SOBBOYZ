import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/api-auth';

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

  const params = await props.params;
  try {
    const { id } = params;
    const body = await request.json();
    const supabase = await createServiceClient();

    const updatePayload: Record<string, any> = {};

    if (body.status !== undefined) {
      updatePayload.status = body.status;
    }
    if (body.clock_in_time !== undefined) {
      updatePayload.clock_in_time = body.clock_in_time;
    }
    if (body.clock_out_time !== undefined) {
      updatePayload.clock_out_time = body.clock_out_time;
    }
    if (body.work_date !== undefined) {
      updatePayload.work_date = body.work_date;
    }
    if (body.notes !== undefined) {
      updatePayload.notes = body.notes;
    }

    // If total_minutes explicitly passed
    if (body.total_minutes !== undefined) {
      updatePayload.total_minutes = body.total_minutes;
    } else if (body.clock_in_time && body.clock_out_time) {
      const inMs = new Date(body.clock_in_time).getTime();
      const outMs = new Date(body.clock_out_time).getTime();
      if (!isNaN(inMs) && !isNaN(outMs) && outMs > inMs) {
        updatePayload.total_minutes = Math.floor((outMs - inMs) / 60000);
      }
    }

    // Force clock out handler:
    if (body.force_clock_out) {
      const outTime = new Date().toISOString();
      updatePayload.clock_out_time = outTime;
      updatePayload.status = body.status || 'completed';

      // Fetch existing record to calculate total_minutes
      const { data: current } = await supabase
        .from('employee_timesheets')
        .select('clock_in_time')
        .eq('id', id)
        .single();

      if (current?.clock_in_time) {
        const inMs = new Date(current.clock_in_time).getTime();
        const outMs = new Date(outTime).getTime();
        updatePayload.total_minutes = Math.max(0, Math.floor((outMs - inMs) / 60000));
      }
    }

    const { data, error } = await supabase
      .from('employee_timesheets')
      .update(updatePayload)
      .eq('id', id)
      .select(`
        *,
        employee:employees(id, full_name, email, phone, notes, hourly_wage)
      `)
      .single();

    if (error) {
      console.error('Error updating timesheet:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in timesheets PATCH:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

  const params = await props.params;
  try {
    const { id } = params;
    const supabase = await createServiceClient();

    const { error } = await supabase
      .from('employee_timesheets')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting timesheet:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in timesheets DELETE:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
