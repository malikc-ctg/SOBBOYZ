import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { logAudit } from '@/lib/audit';

export async function PATCH(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
  // Admin-only
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

    const supabase = await createServiceClient();
    const { id } = params;
    const body = await request.json();

    const { data, error } = await supabase
      .from('leads')
      .update({ ...body, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Cascade updates to Job and Customer if lead is already converted
    if (data.converted_job_id) {
      const { data: job } = await supabase
        .from('jobs')
        .select('id, customer_id')
        .eq('id', data.converted_job_id)
        .single();
        
      if (job) {
        // Update job
        const jobUpdate: any = {};
        if (body.service_type !== undefined) jobUpdate.service_type = body.service_type;
        if (body.quoted_price !== undefined) jobUpdate.quoted_price = body.quoted_price;
        if (body.home_bedrooms !== undefined) jobUpdate.home_bedrooms = body.home_bedrooms;
        if (body.home_bathrooms !== undefined) jobUpdate.home_bathrooms = body.home_bathrooms;
        if (body.home_size_sqft !== undefined) jobUpdate.home_size_sqft = body.home_size_sqft;
        if (body.has_pets !== undefined) jobUpdate.has_pets = body.has_pets;
        if (body.notes !== undefined) jobUpdate.scope_notes = body.notes;
        
        if (Object.keys(jobUpdate).length > 0) {
          await supabase.from('jobs').update(jobUpdate).eq('id', job.id);
        }

        // Update customer
        if (job.customer_id) {
          const custUpdate: any = {};
          if (body.customer_name !== undefined) custUpdate.full_name = body.customer_name;
          if (body.customer_phone !== undefined) custUpdate.phone = body.customer_phone;
          // Note: we don't safely overwrite email if it's already set to prevent login issues, but we can if requested
          if (body.customer_email) custUpdate.email = body.customer_email;
          if (body.city !== undefined) custUpdate.city = body.city;
          
          if (Object.keys(custUpdate).length > 0) {
            await supabase.from('customers').update(custUpdate).eq('id', job.customer_id);
          }
        }
      }
    }

    logAudit({
      actorId: auth.id,
      actorEmail: auth.email,
      actorRole: 'admin',
      action: 'lead.updated',
      entityType: 'lead',
      entityId: id,
      newValues: body,
      request,
    });

    return NextResponse.json(data);
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function GET(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
  // Admin-only
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

    const supabase = await createServiceClient();
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  try {
    const auth = await requireRole(['admin']);
    if (auth instanceof NextResponse) return auth;

    const supabase = await createServiceClient();
    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', params.id);

    if (error) throw error;

    logAudit({
      actorId: auth.id,
      actorEmail: auth.email,
      actorRole: 'admin',
      action: 'lead.deleted',
      entityType: 'lead',
      entityId: params.id,
      request,
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
