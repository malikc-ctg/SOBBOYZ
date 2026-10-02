import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { resolveOrCreateZone } from '@/lib/zone-matcher';
import { requireRole } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  // Rate limit: 10 requests per minute per IP
  const limited = await rateLimit(request, { maxRequests: 10, windowMs: 60_000 });
  if (limited) return limited;

  try {
  // Admin-only
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

    const supabase = await createServiceClient();
    const body = await request.json();

    const {
      customer_id, zone_id, service_type, scheduled_date,
      scheduled_window, scheduled_start_time, address_line1, address_line2, city,
      postal_code, quoted_price, access_instructions,
      home_bedrooms, home_bathrooms, home_size_sqft,
      has_pets, add_ons, scope_notes, lead_id,
      estimated_duration_minutes, deposit_amount,
    } = body;

    const finalCity = (city || '').trim() || 'Toronto';
    const finalPostalCode = (postal_code || '').trim() || 'M5V 2T6';

    // Intelligent Zone resolution & Geocoding
    const resolved = await resolveOrCreateZone({
      address_line1,
      city: finalCity,
      postal_code: finalPostalCode,
    });

    const finalZoneId = zone_id || resolved.zoneId;
    const finalLat = resolved.latitude;
    const finalLon = resolved.longitude;
    const resolvedCity = resolved.cleanCity || finalCity;
    const resolvedPostal = resolved.cleanPostalCode || finalPostalCode;

    if (!customer_id || !finalZoneId || !service_type || !scheduled_date ||
        !address_line1 || quoted_price === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('jobs')
      .insert({
        customer_id,
        zone_id: finalZoneId,
        service_type,
        scheduled_date,
        scheduled_window: scheduled_window || 'afternoon',
        scheduled_start_time: scheduled_start_time || '15:00',
        address_line1,
        address_line2,
        city: resolvedCity,
        postal_code: resolvedPostal,
        latitude: finalLat,
        longitude: finalLon,
        quoted_price,
        access_instructions,
        home_bedrooms,
        home_bathrooms,
        home_size_sqft,
        has_pets: has_pets ?? false,
        add_ons: add_ons ?? [],
        scope_notes,
        lead_id,
        estimated_duration_minutes: estimated_duration_minutes ?? 360,
        deposit_amount: deposit_amount ?? Math.round(quoted_price * 0.3 * 100) / 100,
        status: 'lead_received',
      })
      .select()
      .single();

    if (error) throw error;

    // Auto-dispatch: create job_offers for all active employees across company (non-blocking)
    supabase
      .from('employees')
      .select('id')
      .eq('status', 'active')
      .then(async ({ data: employees }) => {
        if (!employees || employees.length === 0) return;
        const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(); // 4 hours
        const offers = employees.map((c: { id: string }) => ({
          job_id: data.id,
          employee_id: c.id,
          status: 'pending',
          offered_at: new Date().toISOString(),
          expires_at: expiresAt,
        }));
        const { error: offersError } = await supabase.from('job_offers').insert(offers);
        if (offersError) console.error('Failed to dispatch offers:', offersError);
        else {
          // Update job status to 'offered'
          await supabase.from('jobs').update({ status: 'offered' }).eq('id', data.id);
        }
      })
      .then(undefined, (err: unknown) => console.error('Auto-dispatch failed:', err));

    return NextResponse.json(data, { status: 201 });
  } catch (err: unknown) {
    console.error('POST /api/jobs error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireRole(['admin', 'employee']);
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = await createServiceClient();
    const isAdmin = auth.role === 'admin';

    // Employees may only list jobs they are assigned to
    let ownEmployeeId: string | null = null;
    if (!isAdmin) {
      const { data: employee } = await supabase
        .from('employees')
        .select('id')
        .eq('profile_id', auth.id)
        .maybeSingle();
      if (!employee) {
        return NextResponse.json({ error: 'Employee profile not found' }, { status: 404 });
      }
      ownEmployeeId = employee.id as string;
    }

    const { searchParams } = new URL(request.url);

    let query = supabase
      .from('jobs')
      .select('*, customer:customers(*), employee:employees(*), zone:zones(*)')
      .order('scheduled_date', { ascending: false });

    const status = searchParams.get('status');
    if (status) query = query.eq('status', status);

    const date = searchParams.get('date');
    if (date) query = query.eq('scheduled_date', date);

    const start_date = searchParams.get('start_date');
    if (start_date) query = query.gte('scheduled_date', start_date);

    const end_date = searchParams.get('end_date');
    if (end_date) query = query.lte('scheduled_date', end_date);

    const zone_id = searchParams.get('zone_id');
    if (zone_id) query = query.eq('zone_id', zone_id);

    if (ownEmployeeId) {
      query = query.or(`assigned_employee_id.eq.${ownEmployeeId},assigned_employee_ids.cs.{${ownEmployeeId}}`);
    } else {
      const employee_id = searchParams.get('employee_id');
      if (employee_id) query = query.eq('assigned_employee_id', employee_id);

      const customer_id = searchParams.get('customer_id');
      if (customer_id) query = query.eq('customer_id', customer_id);
    }

    const limit = searchParams.get('limit');
    if (limit) query = query.limit(parseInt(limit));

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error('GET /api/jobs error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
