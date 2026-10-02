import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

export async function GET() {
  try {
  // Auth check
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get employee ID using service client to avoid RLS hurdles
    const { createServiceClient } = await import('@/lib/supabase/server');
    const { linkEmployeeByVerifiedEmail } = await import('@/lib/employee-link');
    const serviceClient = await createServiceClient();
    
    let { data: employee } = await serviceClient
      .from('employees')
      .select('id, hourly_wage, notes')
      .eq('profile_id', user.id)
      .maybeSingle();

    if (!employee) {
      const linkedId = await linkEmployeeByVerifiedEmail(serviceClient, user);
      if (linkedId) {
        const { data: linkedEmp } = await serviceClient
          .from('employees')
          .select('id, hourly_wage, notes')
          .eq('id', linkedId)
          .single();
        employee = linkedEmp;
      }
    }

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found in database' }, { status: 404 });
    }

    let hourlyWage = 25.0;
    if (employee.hourly_wage) hourlyWage = Number(employee.hourly_wage);
    else if (employee.notes) {
      try {
        const n = typeof employee.notes === 'string' ? JSON.parse(employee.notes) : employee.notes;
        if (n.hourly_wage) hourlyWage = Number(n.hourly_wage);
      } catch {}
    }

    // Get pending offers using service client
    const { data: offers, error } = await serviceClient
      .from('job_offers')
      .select('*, job:jobs(*, customer:customers(full_name, phone))')
      .eq('employee_id', employee.id)
      .eq('status', 'pending')
      .order('offered_at', { ascending: false });

    if (error) throw error;

    const now = new Date();
    // Filter out offers where job is no longer offered or offer has expired
    const validOffers = (offers || [])
      .filter(o => {
        if (!o.job || o.job.status !== 'offered') return false;
        if (o.expires_at && new Date(o.expires_at) < now) return false;
        return true;
      })
      .map(o => {
        const durationHours = o.job.estimated_duration_minutes ? o.job.estimated_duration_minutes / 60 : 3.0;
        const estimatedPay = Math.round(durationHours * hourlyWage * 100) / 100;
        return {
          ...o,
          cleaner_hourly_wage: hourlyWage,
          estimated_duration_hours: durationHours,
          estimated_pay: estimatedPay,
        };
      });

    return NextResponse.json(validOffers);
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
