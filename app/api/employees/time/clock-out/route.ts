import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { linkEmployeeByVerifiedEmail } from '@/lib/employee-link';

export async function POST(request: Request) {
  // Clock Out
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

    // Find the open timesheet (latest open shift)
    const { data: openSheet } = await serviceClient
      .from('employee_timesheets')
      .select('*')
      .eq('employee_id', employee.id)
      .eq('status', 'open')
      .order('clock_in_time', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!openSheet) {
      return NextResponse.json({ error: 'No active timesheet found to clock out of' }, { status: 400 });
    }

    const clockOutTime = new Date();
    const clockInTime = new Date(openSheet.clock_in_time);
    
    // Calculate total elapsed minutes
    const diffMs = clockOutTime.getTime() - clockInTime.getTime();
    let totalMinutes = Math.floor(diffMs / (1000 * 60));

    // Deduct any break minutes recorded
    const metadata = openSheet.location_data && typeof openSheet.location_data === 'object'
      ? { ...openSheet.location_data }
      : {};
    if (Array.isArray(metadata.breaks)) {
      // If there was an open break, close it now
      metadata.breaks = metadata.breaks.map((b: any) => {
        if (!b.end) {
          const endStr = clockOutTime.toISOString();
          const startMs = new Date(b.start).getTime();
          const endMs = clockOutTime.getTime();
          return {
            ...b,
            end: endStr,
            duration_minutes: Math.max(0, Math.floor((endMs - startMs) / 60000)),
          };
        }
        return b;
      });

      const totalBreakMinutes = metadata.breaks.reduce((sum: number, b: any) => sum + (b.duration_minutes || 0), 0);
      totalMinutes = Math.max(0, totalMinutes - totalBreakMinutes);
    }

    const { data, error } = await serviceClient
      .from('employee_timesheets')
      .update({
        clock_out_time: clockOutTime.toISOString(),
        total_minutes: totalMinutes,
        location_data: metadata,
        status: 'completed'
      })
      .eq('id', openSheet.id)
      .select('*')
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Clock out error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
