import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireRole } from '@/lib/api-auth';

function parseWage(employee: any): number {
  if (!employee) return 25;
  if (employee.hourly_wage && !isNaN(Number(employee.hourly_wage))) {
    return Number(employee.hourly_wage);
  }
  if (employee.notes) {
    try {
      const parsed = typeof employee.notes === 'string' ? JSON.parse(employee.notes) : employee.notes;
      if (parsed?.hourly_wage && !isNaN(Number(parsed.hourly_wage))) {
        return Number(parsed.hourly_wage);
      }
    } catch {
      // ignore json parse error
    }
  }
  return 25;
}

export async function GET(request: NextRequest) {
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = await createServiceClient();
    const { searchParams } = new URL(request.url);

    const employeeId = searchParams.get('employee_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const status = searchParams.get('status');

    let query = supabase
      .from('employee_timesheets')
      .select(`
        *,
        employee:employees(id, full_name, email, phone, notes, hourly_wage, status)
      `)
      .order('work_date', { ascending: false })
      .order('created_at', { ascending: false });

    if (employeeId && employeeId !== 'all') {
      query = query.eq('employee_id', employeeId);
    }
    if (startDate) {
      query = query.gte('work_date', startDate);
    }
    if (endDate) {
      query = query.lte('work_date', endDate);
    }
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: timesheetsRaw, error } = await query;
    if (error) {
      console.error('Error fetching admin timesheets:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const now = Date.now();
    let totalMinutes = 0;
    let totalWages = 0;
    let activeClockedInCount = 0;
    let pendingApprovalCount = 0;

    const timesheets = (timesheetsRaw || []).map((ts: any) => {
      const wage = parseWage(ts.employee);
      let calculatedMinutes = ts.total_minutes || 0;

      // If shift is currently open, calculate live elapsed minutes
      if (ts.status === 'open' && ts.clock_in_time) {
        activeClockedInCount++;
        const clockInMs = new Date(ts.clock_in_time).getTime();
        const elapsedRaw = Math.max(0, Math.floor((now - clockInMs) / 60000));
        
        // Subtract breaks if logged
        let breakMinutes = 0;
        const breaks = ts.location_data?.breaks || [];
        breaks.forEach((b: any) => {
          if (b.start && b.end) {
            breakMinutes += Math.max(0, Math.floor((new Date(b.end).getTime() - new Date(b.start).getTime()) / 60000));
          } else if (b.start) {
            breakMinutes += Math.max(0, Math.floor((now - new Date(b.start).getTime()) / 60000));
          }
        });
        calculatedMinutes = Math.max(0, elapsedRaw - breakMinutes);
      } else if (ts.status === 'completed') {
        pendingApprovalCount++;
      }

      totalMinutes += calculatedMinutes;
      const hours = calculatedMinutes / 60;
      const estPay = Math.round(hours * wage * 100) / 100;
      totalWages += estPay;

      return {
        ...ts,
        effective_minutes: calculatedMinutes,
        hourly_wage: wage,
        est_pay: estPay,
      };
    });

    return NextResponse.json({
      timesheets,
      summary: {
        total_hours: Math.round((totalMinutes / 60) * 10) / 10,
        total_minutes: totalMinutes,
        total_wages: Math.round(totalWages * 100) / 100,
        active_clocked_in: activeClockedInCount,
        pending_approval: pendingApprovalCount,
        total_entries: timesheets.length,
      },
    });
  } catch (error: any) {
    console.error('Error in timesheets GET:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = await createServiceClient();
    const body = await request.json();

    const { employee_id, work_date, clock_in_time, clock_out_time, total_minutes, status, notes } = body;

    if (!employee_id || !work_date) {
      return NextResponse.json({ error: 'Employee and work date are required' }, { status: 400 });
    }

    // Auto-calculate minutes if clock-in and clock-out provided and total_minutes not specified
    let calculatedMinutes = total_minutes;
    if ((calculatedMinutes === undefined || calculatedMinutes === null) && clock_in_time && clock_out_time) {
      const inMs = new Date(clock_in_time).getTime();
      const outMs = new Date(clock_out_time).getTime();
      if (!isNaN(inMs) && !isNaN(outMs) && outMs > inMs) {
        calculatedMinutes = Math.floor((outMs - inMs) / 60000);
      }
    }

    const { data, error } = await supabase
      .from('employee_timesheets')
      .insert({
        employee_id,
        work_date,
        clock_in_time: clock_in_time || null,
        clock_out_time: clock_out_time || null,
        total_minutes: calculatedMinutes !== undefined ? calculatedMinutes : null,
        status: status || 'approved',
        notes: notes || null,
        location_data: { manual_entry_by_admin: true },
      })
      .select(`
        *,
        employee:employees(id, full_name, email, phone, notes, hourly_wage)
      `)
      .single();

    if (error) {
      console.error('Error inserting timesheet:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error: any) {
    console.error('Error in timesheets POST:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
