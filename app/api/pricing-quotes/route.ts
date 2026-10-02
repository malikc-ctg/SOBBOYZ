import { requireRole } from '@/lib/api-auth';
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { z } from 'zod';

const schema = z.object({
  // Contact info
  customer_name: z.string().min(1, 'Customer / contact name is required'),
  company_name: z.string().optional().nullable(),
  contact_title: z.string().optional().nullable(),
  customer_phone: z.string().optional().nullable(),
  customer_email: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  source: z.string().optional().default('inbound_call'),

  // Service identity
  service_type: z.string().optional(),
  package_name: z.string(),
  frequency: z.string().optional().default('one_time'),
  selected_add_ons: z.array(z.string()).optional().default([]),
  add_on_quantities: z.record(z.string(), z.number()).optional().default({}),
  custom_add_on_prices: z.record(z.string(), z.number()).optional().default({}),

  // Property details (optional / defaults for commercial & specialty services)
  property_type: z.enum(['condo', 'basement', 'house']).optional().nullable(),
  bedrooms: z.number().min(0).optional().nullable().default(0),
  bathrooms: z.number().min(0).optional().nullable().default(0),
  half_bathrooms: z.number().min(0).optional().nullable().default(0),
  sqft: z.number().min(0).optional().nullable().default(0),

  // Quote result (calculated client-side, stored for audit)
  calculated_price: z.number(),
  price_min: z.number().nullable().optional(),
  price_max: z.number().nullable().optional(),
  is_range: z.boolean().optional().default(false),
  is_custom_quote: z.boolean().optional().default(false),
  vacancy_confirmed: z.boolean().optional().nullable(),
  breakdown: z.any().optional().default({}),
  estimated_hours: z.number().optional().nullable(),
  scope_of_work_text: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),

  // Legacy fields (kept for backward compat, optional)
  selected_tasks: z.array(z.string()).optional().default([]),
  conditions: z.array(z.string()).optional().default([]),
  modifiers: z.object({
    sameDay: z.boolean().optional(),
    afterHours: z.boolean().optional(),
  }).optional().default({}),
  add_ons: z.array(z.string()).optional().default([]),
});

export async function POST(req: Request) {
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const data = schema.parse(body);

    const supabase = await createServiceClient();

    const serviceType = data.service_type || data.package_name;
    const defaultNotes = `Quote: ${data.package_name}${data.company_name ? ` — Company: ${data.company_name}` : ''}${data.property_type ? ` — ${data.property_type}` : ''}${data.sqft ? ` ${data.sqft} sqft` : ''}${data.bedrooms ? `, ${data.bedrooms} Bed` : ''}${data.bathrooms ? ` / ${data.bathrooms} Bath` : ''}.${data.selected_add_ons && data.selected_add_ons.length > 0 ? ` Add-ons: ${data.selected_add_ons.join(', ')}` : ''}`;
    const leadNotes = data.notes || data.scope_of_work_text || defaultNotes;

    // 1. Create Lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .insert({
        company_name: data.company_name || null,
        customer_name: data.customer_name,
        contact_title: data.contact_title || null,
        customer_phone: data.customer_phone || null,
        customer_email: data.customer_email || null,
        city: data.address || null,
        service_type: serviceType,
        quoted_price: data.calculated_price,
        status: 'new',
        source: data.source,
        home_bedrooms: data.bedrooms && data.bedrooms > 0 ? data.bedrooms : null,
        home_bathrooms: (data.bathrooms || 0) + (data.half_bathrooms || 0) > 0 ? (data.bathrooms || 0) + (data.half_bathrooms || 0) : null,
        home_size_sqft: data.sqft && data.sqft > 0 ? data.sqft : null,
        notes: leadNotes,
      })
      .select()
      .single();

    if (leadError) throw leadError;

    // 2. Create Pricing Quote record linked to Lead
    const { data: quote, error: quoteError } = await supabase
      .from('pricing_quotes')
      .insert({
        lead_id: lead.id,
        package_name: data.package_name,
        property_type: data.property_type || null,
        frequency: data.frequency || 'one_time',
        selected_tasks: data.selected_add_ons || [],
        bedrooms: data.bedrooms || 0,
        bathrooms: data.bathrooms || 0,
        half_bathrooms: data.half_bathrooms || 0,
        sqft: data.sqft || 0,
        conditions: data.conditions || [],
        modifiers: data.modifiers || {},
        add_ons: data.add_ons || [],
        calculated_price: data.calculated_price,
        price_min: data.price_min || null,
        price_max: data.price_max || null,
        is_range: data.is_range || false,
        is_custom_quote: data.is_custom_quote || false,
        vacancy_confirmed: data.vacancy_confirmed ?? null,
        breakdown: data.breakdown || {},
        estimated_hours: data.estimated_hours || null,
        scope_of_work_text: data.scope_of_work_text || leadNotes || null,
      })
      .select()
      .single();

    if (quoteError) {
      console.error('Quote Error:', quoteError);
      throw quoteError;
    }

    return NextResponse.json({ success: true, lead, quote });
  } catch (err: any) {
    console.error('Error generating pricing quote:', err);
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
