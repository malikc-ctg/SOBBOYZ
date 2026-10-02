import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { linkEmployeeByVerifiedEmail } from '@/lib/employee-link';

export async function POST(request: Request) {
  // Toggle or start/end break
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

    // Find the active open timesheet
    const { data: openSheet } = await serviceClient
      .from('employee_timesheets')
      .select('*')
      .eq('employee_id', employee.id)
      .eq('status', 'open')
      .order('clock_in_time', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!openSheet) {
      return NextResponse.json({ error: 'No active shift to take a break from' }, { status: 400 });
    }

    // Parse location_data to read/write breaks safely
    const metadata = openSheet.location_data && typeof openSheet.location_data === 'object'
      ? { ...openSheet.location_data }
      : {};

    const breaks = Array.isArray(metadata.breaks) ? [...metadata.breaks] : [];
    const now = new Date().toISOString();

    // Check if there is an ongoing break
    const activeBreakIndex = breaks.findIndex((b: any) => !b.end);

    if (activeBreakIndex >= 0) {
      // End the current break
      breaks[activeBreakIndex].end = now;
      const startMs = new Date(breaks[activeBreakIndex].start).getTime();
      const endMs = new Date(now).getTime();
      breaks[activeBreakIndex].duration_minutes = Math.max(0, Math.floor((endMs - startMs) / 60000));
    } else {
      // Start a new break
      breaks.push({
        start: now,
        end: null,
      });
    }

    metadata.breaks = breaks;

    const { data, error } = await serviceClient
      .from('employee_timesheets')
      .update({
        location_data: metadata,
      })
      .eq('id', openSheet.id)
      .select('*')
      .single();

    if (error) throw error;

    const isOnBreak = breaks.some((b: any) => !b.end);

    return NextResponse.json({
      timesheet: data,
      isOnBreak,
      breaks,
    });
  } catch (err: any) {
    console.error('Break toggle error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
