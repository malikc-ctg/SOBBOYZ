import { requireRole } from '@/lib/api-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = await createServiceClient();
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all'; // all, hot, commercial, callbacks

    // Fetch ONLY B2B Commercial Phone leads (created specifically for B2B Phone Sales OS)
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('*')
      .eq('source', 'phone_sales_os')
      .order('created_at', { ascending: false });

    if (leadsError) {
      console.error('[API /api/sales/leads] B2B Leads query error:', leadsError);
    }

    // Format into B2B tele-sales contacts
    let b2bQueue = (leads || []).map((l: any) => ({
      id: l.id,
      contact_id: `lead_${l.id}`,
      type: 'B2B_LEAD',
      name: l.customer_name || 'Decision Maker',
      company: l.company_name || 'Commercial Account',
      phone: l.customer_phone || '',
      email: l.customer_email || '',
      city: l.city || 'GTA',
      service_type: l.service_type || 'Commercial Exterior / Dumpster Sanitization',
      estimated_value: l.quoted_price ? Number(l.quoted_price) : 500,
      status: l.status || 'new', // new, contacted, quoted, won, lost
      notes: l.notes || '',
      created_at: l.created_at,
      priority: 'HIGH',
    }));

    if (filter === 'hot') {
      b2bQueue = b2bQueue.filter((c: any) => c.status === 'new' || c.status === 'quoted');
    } else if (filter === 'callbacks') {
      b2bQueue = b2bQueue.filter((c: any) => c.status === 'contacted');
    }

    return NextResponse.json({
      success: true,
      contacts: b2bQueue,
      total: b2bQueue.length,
      metrics: {
        total_leads: b2bQueue.length,
        hot_leads: b2bQueue.filter((l: any) => l.status === 'new' || l.status === 'quoted').length,
      }
    });
  } catch (err: any) {
    console.error('[API /api/sales/leads] Exception:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = await createServiceClient();
    const body = await request.json();
    const { lead_id, status, notes, callback_time } = body;

    if (!lead_id) {
      return NextResponse.json({ error: 'lead_id is required' }, { status: 400 });
    }

    const rawId = lead_id.replace(/^lead_/, '');
    const updatePayload: any = { updated_at: new Date().toISOString() };
    if (status) updatePayload.status = status;
    if (notes) updatePayload.notes = notes;
    if (callback_time) updatePayload.preferred_date = callback_time;

    const { data, error } = await supabase
      .from('leads')
      .update(updatePayload)
      .eq('id', rawId)
      .select()
      .maybeSingle();

    if (error) {
      console.warn('[API /api/sales/leads PATCH] Update failed:', error);
    }

    return NextResponse.json({ success: true, updated: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(['admin']);
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = await createServiceClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from('leads')
      .insert({
        source: body.source || 'd2d',
        customer_name: body.customer_name || 'Decision Maker',
        company_name: body.company_name || 'Commercial Account',
        customer_phone: body.customer_phone || '',
        customer_email: body.customer_email || null,
        city: body.city || body.street_name || 'GTA',
        service_type: body.service_type || 'commercial_cleaning',
        preferred_date: body.preferred_date ? body.preferred_date.split('T')[0] : null,
        preferred_start_time: body.preferred_date && body.preferred_date.includes('T') ? body.preferred_date.split('T')[1].slice(0, 5) : (body.preferred_start_time || '09:00'),
        quoted_price: body.quoted_price ? parseFloat(body.quoted_price) : null,
        notes: body.notes || 'Created via KnockLog Commercial',
        status: body.status || 'new',
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, lead: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
