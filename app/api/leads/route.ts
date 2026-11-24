import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { rateLimit } from '@/lib/rate-limit';
import { compareLeadsForDuplicate, buildMergedLeadUpdate } from '@/lib/sales/leadDeduplication';

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

    // Check for duplicate active inbound lead unless force_create is passed
    if (!body.force_create) {
      const { data: recentLeads } = await supabase
        .from('leads')
        .select('*')
        .not('source', 'in', '(contact_import,phone_sales_os,apollo,bid_tender,vendor_list)')
        .order('created_at', { ascending: false })
        .limit(500);

      const matchedExisting = (recentLeads || []).find((ex: any) =>
        compareLeadsForDuplicate(ex, body).isDuplicate
      );

      if (matchedExisting && !matchedExisting.converted_job_id) {
        const mergedPayload = buildMergedLeadUpdate(matchedExisting, body);
        const { data: updated, error: updateErr } = await supabase
          .from('leads')
          .update({
            ...mergedPayload,
            service_type: body.service_type || matchedExisting.service_type,
            preferred_date: body.preferred_date || matchedExisting.preferred_date,
            preferred_window: body.preferred_window || matchedExisting.preferred_window,
            home_bedrooms: body.home_bedrooms ?? matchedExisting.home_bedrooms,
            home_bathrooms: body.home_bathrooms ?? matchedExisting.home_bathrooms,
            home_size_sqft: body.home_size_sqft ?? matchedExisting.home_size_sqft,
            quoted_price: body.quoted_price ?? matchedExisting.quoted_price,
          })
          .eq('id', matchedExisting.id)
          .select()
          .single();

        if (!updateErr && updated) {
          return NextResponse.json({ ...updated, merged_duplicate: true }, { status: 200 });
        }
      }
    }

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

    // Exclude Quo imported contacts, contact imports, phone sales OS leads, and commercial tenders/vendor lists from Standard Leads tab
    query = query
      .neq('source', 'quo_telephony')
      .neq('status', 'vendor_list')
      .not('source', 'ilike', '%quo%')
      .not('source', 'in', '(contact_import,phone_sales_os,apollo,bid_tender,vendor_list)');

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
