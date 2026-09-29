import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServiceClient();
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all'; // all, hot, callbacks, past_customers, commercial

    // 1. Fetch leads from SOB leads table
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (leadsError) {
      console.error('[API /api/sales/leads] Leads query error:', leadsError);
    }

    // 2. Fetch past customers for renewal/winback queue
    const { data: customers, error: custError } = await supabase
      .from('customers')
      .select('id, full_name, phone, email, city, company_name, customer_type, created_at, customer_score')
      .order('created_at', { ascending: false })
      .limit(60);

    if (custError) {
      console.error('[API /api/sales/leads] Customers query error:', custError);
    }

    // Format leads into unified Sales OS tele-sales contacts
    const formattedLeads = (leads || []).map((l: any) => ({
      id: l.id,
      contact_id: `lead_${l.id}`,
      type: 'INBOUND_LEAD',
      name: l.customer_name || 'Prospect',
      company: l.company_name || null,
      phone: l.customer_phone || '',
      email: l.customer_email || '',
      city: l.city || 'Toronto',
      service_type: l.service_type || 'Trash Can Sanitizing / Deep Clean',
      estimated_value: l.quoted_price ? Number(l.quoted_price) : 220,
      status: l.status || 'new', // new, quoted, contacted, converted, lost
      notes: l.notes || '',
      created_at: l.created_at,
      priority: l.quoted_price ? 'HIGH' : 'MEDIUM',
    }));

    // Format customers into winback queue contacts
    const formattedCustomers = (customers || []).map((c: any) => ({
      id: c.id,
      contact_id: `cust_${c.id}`,
      type: c.customer_type === 'commercial' ? 'COMMERCIAL_WINBACK' : 'PAST_CUSTOMER_WINBACK',
      name: c.full_name || 'Customer',
      company: c.company_name || null,
      phone: c.phone || '',
      email: c.email || '',
      city: c.city || 'Toronto',
      service_type: c.customer_type === 'commercial' ? 'Commercial Maintenance Renewal' : 'Seasonal Can Cleaning & Power Wash',
      estimated_value: c.customer_type === 'commercial' ? 850 : 180,
      status: 'active_client',
      notes: `Past customer score: ${c.customer_score || 5}/5. Due for seasonal maintenance follow-up.`,
      created_at: c.created_at,
      priority: c.customer_type === 'commercial' ? 'HIGH' : 'NORMAL',
    }));

    // Combine queues
    let unifiedQueue = [...formattedLeads, ...formattedCustomers];

    if (filter === 'hot') {
      unifiedQueue = unifiedQueue.filter(c => c.type === 'INBOUND_LEAD' && (c.status === 'new' || c.status === 'quoted'));
    } else if (filter === 'past_customers') {
      unifiedQueue = unifiedQueue.filter(c => c.type === 'PAST_CUSTOMER_WINBACK');
    } else if (filter === 'commercial') {
      unifiedQueue = unifiedQueue.filter(c => c.type === 'COMMERCIAL_WINBACK' || (c.company && c.company.length > 0));
    }

    return NextResponse.json({
      success: true,
      contacts: unifiedQueue,
      total: unifiedQueue.length,
      metrics: {
        total_leads: (leads || []).length,
        hot_leads: (leads || []).filter((l: any) => l.status === 'new' || l.status === 'quoted').length,
        past_customers: (customers || []).length,
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
    const { lead_id, status, notes, callback_time } = body;

    if (!lead_id) {
      return NextResponse.json({ error: 'lead_id is required' }, { status: 400 });
    }

    // Strip prefix if any
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
  try {
    const supabase = await createServiceClient();
    const body = await request.json();

    const { data, error } = await supabase
      .from('leads')
      .insert({
        source: 'phone_sales_os',
        customer_name: body.customer_name || 'Phone Prospect',
        company_name: body.company_name || null,
        customer_phone: body.customer_phone || '',
        customer_email: body.customer_email || null,
        city: body.city || 'Toronto',
        service_type: body.service_type || 'standard_clean',
        quoted_price: body.quoted_price ? parseFloat(body.quoted_price) : 220,
        notes: body.notes || 'Created via Sales OS Phone Dialer',
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
