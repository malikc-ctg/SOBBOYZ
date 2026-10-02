import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServiceClient();
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all'; // all, hot, construction, callbacks, walkthroughs, missing_info

    // Fetch B2B Commercial Phone & Apollo leads
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('*')
      .or('source.in.(phone_sales_os,apollo,cold_call),company_name.not.is.null')
      .order('created_at', { ascending: false });

    if (leadsError) {
      console.error('[API /api/sales/leads] B2B Leads query error:', leadsError);
    }

    // Format into B2B tele-sales contacts
    let b2bQueue = (leads || []).map((l: any) => ({
      id: l.id,
      contact_id: `lead_${l.id}`,
      type: 'B2B_LEAD',
      source: l.source || 'apollo',
      name: l.customer_name || '',
      company: l.company_name || '',
      position: l.contact_title || '',
      phone: l.customer_phone || '',
      email: l.customer_email || '',
      city: l.city || 'GTA',
      service_type: l.service_type || 'post_construction',
      estimated_value: l.quoted_price ? Number(l.quoted_price) : 750,
      status: l.status || 'new', // new, contacted, walkthrough_booked, quoted, won, lost
      notes: l.notes || '',
      preferred_date: l.preferred_date || null,
      created_at: l.created_at,
      priority: 'HIGH',
    }));

    if (filter === 'hot') {
      b2bQueue = b2bQueue.filter((c: any) => c.status === 'new' || c.status === 'quoted');
    } else if (filter === 'construction') {
      b2bQueue = b2bQueue.filter((c: any) => 
        c.service_type === 'post_construction' || 
        (c.notes || '').toLowerCase().includes('construction') ||
        (c.company || '').toLowerCase().includes('builder') ||
        (c.company || '').toLowerCase().includes('construct') ||
        (c.position || '').toLowerCase().includes('project manager') ||
        (c.position || '').toLowerCase().includes('superintendent')
      );
    } else if (filter === 'callbacks') {
      b2bQueue = b2bQueue.filter((c: any) => c.status === 'contacted');
    } else if (filter === 'walkthroughs') {
      b2bQueue = b2bQueue.filter((c: any) => c.status === 'walkthrough_booked');
    } else if (filter === 'missing_info') {
      b2bQueue = b2bQueue.filter((c: any) => !c.name || !c.position || !c.email || !c.phone);
    }

    return NextResponse.json({
      success: true,
      contacts: b2bQueue,
      total: b2bQueue.length,
      metrics: {
        total_leads: b2bQueue.length,
        hot_leads: b2bQueue.filter((l: any) => l.status === 'new' || l.status === 'quoted').length,
        walkthroughs: b2bQueue.filter((l: any) => l.status === 'walkthrough_booked').length,
        construction_leads: b2bQueue.filter((l: any) => l.service_type === 'post_construction').length,
      }
    });
  } catch (err: any) {
    console.error('[API /api/sales/leads] Exception:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createServiceClient();
    const body = await request.json();
    const { 
      lead_id, status, notes, callback_time,
      customer_name, company_name, contact_title, 
      customer_phone, customer_email, city, service_type, quoted_price, address
    } = body;

    if (!lead_id) {
      return NextResponse.json({ error: 'lead_id is required' }, { status: 400 });
    }

    const rawId = String(lead_id).replace(/^lead_/, '');
    const updatePayload: any = { updated_at: new Date().toISOString() };
    
    if (status !== undefined) updatePayload.status = status;
    if (notes !== undefined) updatePayload.notes = notes;
    if (callback_time !== undefined) updatePayload.preferred_date = callback_time;
    if (customer_name !== undefined) updatePayload.customer_name = customer_name;
    if (company_name !== undefined) updatePayload.company_name = company_name;
    if (contact_title !== undefined) updatePayload.contact_title = contact_title;
    if (customer_phone !== undefined) updatePayload.customer_phone = customer_phone;
    if (customer_email !== undefined) updatePayload.customer_email = customer_email;
    if (city !== undefined) updatePayload.city = city;
    if (service_type !== undefined) updatePayload.service_type = service_type;
    if (quoted_price !== undefined) updatePayload.quoted_price = quoted_price ? parseFloat(quoted_price) : null;
    if (address !== undefined) updatePayload.address = address;

    const { data, error } = await supabase
      .from('leads')
      .update(updatePayload)
      .eq('id', rawId)
      .select()
      .maybeSingle();

    if (error) {
      console.warn('[API /api/sales/leads PATCH] Update failed:', error);
      throw error;
    }

    return NextResponse.json({ success: true, updated: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServiceClient();
    const body = await request.json();

    // Support batch import from Apollo CSV
    if (Array.isArray(body.leads)) {
      const rows = body.leads.map((item: any) => ({
        source: item.source || 'apollo',
        customer_name: item.customer_name || item.name || null,
        company_name: item.company_name || item.company || 'Commercial Prospect',
        contact_title: item.contact_title || item.position || item.title || null,
        customer_phone: item.customer_phone || item.phone || '',
        customer_email: item.customer_email || item.email || null,
        city: item.city || 'GTA',
        service_type: item.service_type || 'post_construction',
        quoted_price: item.quoted_price ? parseFloat(item.quoted_price) : 750,
        notes: item.notes || 'Imported via Apollo.io B2B Importer',
        status: item.status || 'new',
      }));

      const { data, error } = await supabase
        .from('leads')
        .insert(rows)
        .select();

      if (error) throw error;
      return NextResponse.json({ success: true, count: data?.length || rows.length, leads: data }, { status: 201 });
    }

    // Single lead creation
    const { data, error } = await supabase
      .from('leads')
      .insert({
        source: body.source || 'apollo',
        customer_name: body.customer_name || body.name || null,
        company_name: body.company_name || body.company || 'Commercial Prospect',
        contact_title: body.contact_title || body.position || body.title || null,
        customer_phone: body.customer_phone || body.phone || '',
        customer_email: body.customer_email || body.email || null,
        city: body.city || body.street_name || 'GTA',
        service_type: body.service_type || 'post_construction',
        preferred_date: body.preferred_date ? body.preferred_date.split('T')[0] : null,
        preferred_start_time: body.preferred_date && body.preferred_date.includes('T') ? body.preferred_date.split('T')[1].slice(0, 5) : (body.preferred_start_time || '09:00'),
        quoted_price: body.quoted_price ? parseFloat(body.quoted_price) : 750,
        notes: body.notes || 'Created via Phone Sales OS',
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
