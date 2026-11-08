import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { logAudit } from '@/lib/audit';
import { resolveOrCreateZone } from '@/lib/zone-matcher';
import { toValidServiceType } from '@/lib/sales/sectorUtils';


export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
  // Admin-only
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

    const supabase = await createServiceClient();
    const { id } = params;
    const body = await request.json();

    // Get lead
    const { data: lead, error: leadError } = await supabase
      .from('leads')
      .select('*')
      .eq('id', id)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    // Check if this lead was already converted to an existing job
    if (lead.converted_job_id) {
      const { data: existingJob } = await supabase
        .from('jobs')
        .select('id, job_number')
        .eq('id', lead.converted_job_id)
        .maybeSingle();

      if (existingJob) {
        return NextResponse.json(
          {
            error: `This lead/tender has already been converted to Job #${existingJob.job_number || existingJob.id}`,
            job: existingJob,
          },
          { status: 400 }
        );
      }
    }

    let tenderMeta: any = null;
    if (typeof lead.notes === 'string' && lead.notes.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(lead.notes.trim());
        tenderMeta = parsed.tender_meta || parsed;
      } catch {
        tenderMeta = null;
      }
    } else if (typeof lead.notes === 'object' && lead.notes) {
      tenderMeta = (lead.notes as any).tender_meta || lead.notes;
    }

    if (!lead.service_type && !body.service_type) {
      return NextResponse.json({ error: 'Service type is missing from the lead.' }, { status: 400 });
    }

    const rawAddress =
      body.address_line1 ||
      tenderMeta?.jobsite_address ||
      tenderMeta?.address ||
      lead.address ||
      lead.address_line1 ||
      'TBD';
    const rawCity = body.city || tenderMeta?.city || lead.city || 'Toronto';
    const rawPostal = body.postal_code || tenderMeta?.postal_code || lead.postal_code || '';

    // Automatically resolve or dynamically create zone coverage & geocode
    const resolved = await resolveOrCreateZone({
      address_line1: rawAddress,
      city: rawCity,
      postal_code: rawPostal,
    });

    const finalZoneId = body.zone_id || resolved?.zoneId;
    if (!finalZoneId) {
      return NextResponse.json({ error: 'A zone must be selected to convert a lead.' }, { status: 400 });
    }

    // Find or create customer (check email first, then phone)
    let customerId: string | undefined;
    
    if (lead.customer_email) {
      const { data: existingCustomer, error: findError } = await supabase
        .from('customers')
        .select('id')
        .eq('email', lead.customer_email)
        .maybeSingle();

      if (findError) {
        console.error('Error finding customer by email:', findError);
        throw findError;
      }
      
      if (existingCustomer) {
        customerId = existingCustomer.id;
      }
    }

    if (!customerId && lead.customer_phone && lead.customer_phone.trim() !== '—') {
      const cleanPhone = lead.customer_phone.replace(/\D/g, '');
      if (cleanPhone.length >= 10) {
        const { data: phoneCandidates } = await supabase
          .from('customers')
          .select('id, phone')
          .eq('is_active', true);

        const phoneMatch = phoneCandidates?.find(c => {
          const cDigits = (c.phone || '').replace(/\D/g, '');
          return cDigits.endsWith(cleanPhone.slice(-10));
        });

        if (phoneMatch) {
          customerId = phoneMatch.id;
        }
      }
    }

    if (!customerId) {
      // If no email exists, generate a placeholder so the DB NOT NULL UNIQUE constraint passes
      const targetEmail = lead.customer_email || `no-email-${Date.now()}@seaofblue.local`;

      const { data: newCustomer, error: custError } = await supabase
        .from('customers')
        .insert({
          full_name: lead.customer_name ?? 'Unnamed Customer',
          company_name: lead.company_name || null,
          email: targetEmail,
          phone: lead.customer_phone ?? '—',
          city: rawCity,
          zone_id: finalZoneId,
        })
        .select()
        .single();

      if (custError) {
        console.error('Error creating customer:', custError);
        throw custError;
      }
      customerId = newCustomer.id;
    }

    const startTime = body.scheduled_start_time || lead.preferred_start_time || '15:00';
    const duration = body.estimated_duration_minutes ? parseInt(body.estimated_duration_minutes, 10) : 360;

    const finalCity = resolved?.cleanCity || rawCity;
    const finalPostal = resolved?.cleanPostalCode || rawPostal;
    const finalLat = resolved?.latitude;
    const finalLon = resolved?.longitude;

    let finalScopeNotes = body.scope_notes;
    if (!finalScopeNotes) {
      if (tenderMeta) {
        const pName = tenderMeta.project_name || lead.condition || '';
        const sSummary = tenderMeta.scope_summary || '';
        finalScopeNotes = [pName ? `Project: ${pName}` : '', sSummary].filter(Boolean).join('\n\n') || lead.notes;
      } else {
        finalScopeNotes = lead.notes;
      }
    }

    const homeSqft = body.home_size_sqft ?? lead.home_size_sqft ?? tenderMeta?.sqft ?? null;

    // Create job from lead with accurate geocoding and zone coverage
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        lead_id: id,
        customer_id: customerId,
        zone_id: finalZoneId,
        service_type: toValidServiceType(body.service_type ?? lead.service_type),
        scheduled_date: body.scheduled_date ?? lead.preferred_date,
        scheduled_window: body.scheduled_window ?? lead.preferred_window ?? 'afternoon',
        scheduled_start_time: startTime,
        estimated_duration_minutes: duration,
        address_line1: rawAddress,
        city: finalCity,
        postal_code: finalPostal,
        latitude: finalLat,
        longitude: finalLon,
        quoted_price: body.quoted_price ?? lead.quoted_price ?? 0,
        home_bedrooms: lead.home_bedrooms,
        home_bathrooms: lead.home_bathrooms,
        home_size_sqft: homeSqft,
        has_pets: lead.has_pets ?? false,
        add_ons: lead.add_ons ?? [],
        scope_notes: finalScopeNotes,
        status: 'lead_received',
        deposit_amount: body.deposit_amount ?? 0,
      })
      .select()
      .single();

    if (jobError) {
      console.error('Error creating job from lead:', jobError);
      throw jobError;
    }

    // Update lead status and tender_meta if tender
    let updatedNotes = lead.notes;
    if (tenderMeta) {
      try {
        const parsed = typeof lead.notes === 'string' ? JSON.parse(lead.notes) : { ...lead.notes };
        if (!parsed.tender_meta) parsed.tender_meta = {};
        parsed.tender_meta.bid_status = 'awarded';
        parsed.tender_meta.converted_job_id = job.id;
        updatedNotes = JSON.stringify(parsed);
      } catch {
        // ignore
      }
    }

    // Update lead status
    const { error: updateError } = await supabase
      .from('leads')
      .update({
        status: 'converted',
        converted_job_id: job.id,
        notes: updatedNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('Error updating lead status:', updateError);
    }

    logAudit({
      actorId: auth.id,
      actorEmail: auth.email,
      actorRole: 'admin',
      action: 'lead.converted',
      entityType: 'lead',
      entityId: params.id,
      newValues: { job_id: job.id, status: 'converted' },
      request,
      metadata: { customer_name: lead.customer_name },
    });

    return NextResponse.json(job, { status: 201 });
  } catch (err: unknown) {
    console.error('Conversion process failed:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
