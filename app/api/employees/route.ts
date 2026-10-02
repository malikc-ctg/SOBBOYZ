import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  try {
  // Admin-only
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

    const supabase = await createServiceClient();
    const body = await request.json();

    const { full_name, email, phone, zone_id, tier, payout_rate,
            brings_own_supplies, has_vehicle, max_jobs_per_day } = body;

    if (!full_name || !email || !phone) {
      return NextResponse.json({ error: 'name, email, phone required' }, { status: 400 });
    }

    // Create auth user (employee uses email+password)
    const tempPassword = Math.random().toString(36).slice(-12) + 'A1!';
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { role: 'employee', full_name },
    });

    if (authError) throw authError;

    // Create profile
    await supabase.from('profiles').insert({
      id: authUser.user.id,
      role: 'employee',
      full_name,
      email,
      phone,
    });

    // Create employee record
    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .insert({
        profile_id: authUser.user.id,
        full_name, email, phone, zone_id,
        tier: tier ?? 'basic',
        payout_rate: payout_rate ?? 0.700,
        brings_own_supplies: brings_own_supplies ?? false,
        has_vehicle: has_vehicle ?? true,
        max_jobs_per_day: max_jobs_per_day ?? 2,
      })
      .select()
      .single();

    if (employeeError) throw employeeError;

    return NextResponse.json(employee, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function GET() {
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from('employees')
      .select('*, zone:zones!contractors_zone_id_fkey(*), employee_zones:contractor_zones(zone:zones(*))')
      .neq('status', 'deleted')
      .order('full_name');


    if (error) throw error;
    return NextResponse.json(data);
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
