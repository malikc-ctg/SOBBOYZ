import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
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

    const { data, error } = await supabase
      .from('leads')
      .insert({
        source: body.source ?? 'lsa',
        company_name: body.company_name || null,
        customer_name: body.customer_name,
        contact_title: body.contact_title || null,
        customer_phone: body.customer_phone,
        customer_email: body.customer_email,
        city: body.city,
        service_type: body.service_type,
        preferred_date: body.preferred_date,
        preferred_window: body.preferred_window,
        home_bedrooms: body.home_bedrooms,
        home_bathrooms: body.home_bathrooms,
        home_size_sqft: body.home_size_sqft,
        condition: body.condition,
        has_pets: body.has_pets ?? false,
        add_ons: body.add_ons ?? [],
        notes: body.notes,
        quoted_price: body.quoted_price,
        status: 'new',
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (err: unknown) {
    console.error('POST /api/leads error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
  // Admin-only
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

    const supabase = await createServiceClient();
    const { searchParams } = new URL(request.url);

    let query = supabase.from('leads').select('*').order('created_at', { ascending: false });

    // Exclude Quo imported contacts, contact imports, and phone sales OS leads from the Leads tab
    query = query
      .neq('source', 'quo_telephony')
      .not('source', 'ilike', '%quo%')
      .not('source', 'in', '(contact_import,phone_sales_os,apollo)');

    const status = searchParams.get('status');
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json(data);
  } catch (err: unknown) {
    console.error('GET /api/leads error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
