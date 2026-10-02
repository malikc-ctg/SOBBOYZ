import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
  // Auth check
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

    const supabase = await createServiceClient();
    const { searchParams } = new URL(request.url);

    const date = searchParams.get('date');
    const window = searchParams.get('window');
    const zone_id = searchParams.get('zone_id');

    if (!date || !window) {
      return NextResponse.json({ error: 'date and window required' }, { status: 400 });
    }

    const dayOfWeek = new Date(date).toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

    // Get employees who are active
    const query = supabase
      .from('employees')
      .select('*, zone:zones!zone_id(*), employee_zones(zone_id)')
      .eq('status', 'active');

    const { data: employees, error } = await query;
    if (error) throw error;

    // Filter by zone in memory (simpler than complex RLS/Join OR logic in PostgREST)
    let filteredEmployees = employees || [];
    if (zone_id) {
      filteredEmployees = filteredEmployees.filter(c => 
        c.zone_id === zone_id || 
        (c.employee_zones && c.employee_zones.some((cz: any) => cz.zone_id === zone_id))
      );
    }


    // Get availability for each employee
    const available = [];
    for (const c of filteredEmployees) {

      // Check override first
      const { data: override } = await supabase
        .from('employee_availability_overrides')
        .select('is_available')
        .eq('employee_id', c.id)
        .eq('override_date', date)
        .eq('time_window', window)
        .single();

      if (override) {
        if (override.is_available) available.push(c);
        continue;
      }

      // Check regular availability
      const { data: avail } = await supabase
        .from('employee_availability')
        .select('is_available')
        .eq('employee_id', c.id)
        .eq('day_of_week', dayOfWeek)
        .eq('time_window', window)
        .single();

      if (avail?.is_available !== false) {
        // Check if already assigned a job in this window
        const { data: existingJobs } = await supabase
          .from('jobs')
          .select('id')
          .eq('assigned_employee_id', c.id)
          .eq('scheduled_date', date)
          .eq('scheduled_window', window)
          .not('status', 'in', '(cancelled,rescheduled)');

        if (!existingJobs || existingJobs.length < c.max_jobs_per_day) {
          available.push(c);
        }
      }
    }

    return NextResponse.json(available);
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
