import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRole(['admin']);
    if (auth instanceof NextResponse) return auth;

    const supabase = await createServiceClient();
    const body = await request.json();

    const {
      full_name,
      email,
      phone,
      company_name,
      customer_type = 'residential',
      commercial_facility_type,
      address_line1,
      address_line2,
      city,
      province = 'ON',
      postal_code,
      zone_id,
      notes,
      square_footage,
      accounts_payable_name,
      accounts_payable_email,
      accounts_payable_phone,
      billing_terms = 'due_on_receipt',
      tax_id,
      tax_exempt = false,
      access_code,
      alarm_instructions,
      parking_instructions,
      pet_details,
      home_bedrooms,
      home_bathrooms,
      special_instructions,
    } = body;

    if (!full_name || !email || !phone) {
      return NextResponse.json({ error: 'Name, email, and phone are required' }, { status: 400 });
    }

    const effectiveType = company_name ? 'commercial' : customer_type;

    const { data, error } = await supabase
      .from('customers')
      .insert({
        full_name,
        email,
        phone,
        company_name: company_name || null,
        customer_type: effectiveType,
        commercial_facility_type: commercial_facility_type || null,
        address_line1: address_line1 || null,
        address_line2: address_line2 || null,
        city: city || null,
        province,
        postal_code: postal_code || null,
        zone_id: zone_id || null,
        notes: notes || null,
        square_footage: square_footage ? Number(square_footage) : null,
        accounts_payable_name: accounts_payable_name || null,
        accounts_payable_email: accounts_payable_email || null,
        accounts_payable_phone: accounts_payable_phone || null,
        billing_terms,
        tax_id: tax_id || null,
        tax_exempt: Boolean(tax_exempt),
        access_code: access_code || null,
        alarm_instructions: alarm_instructions || null,
        parking_instructions: parking_instructions || null,
        pet_details: pet_details || null,
        home_bedrooms: home_bedrooms ? Number(home_bedrooms) : null,
        home_bathrooms: home_bathrooms ? Number(home_bathrooms) : null,
        special_instructions: special_instructions || null,
      })
      .select('*, zone:zones(*)')
      .single();

    if (error) throw error;
    return NextResponse.json(data, { status: 201 });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = await createServiceClient();
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'residential' | 'commercial'

    let query = supabase
      .from('customers')
      .select(`
        *,
        zone:zones(*),
        jobs:jobs(id, status, quoted_price, scheduled_date),
        recurring:recurring_bookings(id, is_active, monthly_amount, quoted_price, frequency)
      `)
      .eq('is_active', true)
      .order('full_name');

    if (type === 'residential' || type === 'commercial') {
      query = query.eq('customer_type', type);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Enrich customers with computed fields
    const enriched = (data || []).map((c: any) => {
      const jobList = c.jobs || [];
      const recList = c.recurring || [];

      const completedJobs = jobList.filter((j: any) => j.status === 'completed' || j.status === 'paid_out');
      const lifetimeSpend = completedJobs.reduce((sum: number, j: any) => sum + (Number(j.quoted_price) || 0), 0);
      
      const sortedJobs = [...jobList].sort((a: any, b: any) => 
        new Date(b.scheduled_date).getTime() - new Date(a.scheduled_date).getTime()
      );
      const lastClean = sortedJobs.find((j: any) => j.status === 'completed' || j.status === 'paid_out')?.scheduled_date ?? null;

      const activeRecurring = recList.filter((r: any) => r.is_active);
      const mrr = activeRecurring.reduce((sum: number, r: any) => 
        sum + (Number(r.monthly_amount) || (Number(r.quoted_price) * 2.16)), 0
      );

      // Clean up raw arrays to keep payload snappy
      const { jobs: _j, recurring: _r, ...customerData } = c;

      return {
        ...customerData,
        jobs_count: jobList.length,
        lifetime_spend: Math.round(lifetimeSpend * 100) / 100,
        last_clean_date: lastClean,
        has_recurring: activeRecurring.length > 0,
        mrr_amount: Math.round(mrr * 100) / 100,
        // Guarantee customer_type fallback
        customer_type: c.customer_type || (c.company_name ? 'commercial' : 'residential'),
      };
    });

    return NextResponse.json(enriched);
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
