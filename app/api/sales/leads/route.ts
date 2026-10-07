import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/api-auth';
import { NextRequest, NextResponse } from 'next/server';

function cleanRepName(name: string | null | undefined): string {
  if (!name) return 'Sales Rep';
  const clean = String(name).trim();
  const lower = clean.toLowerCase();
  if (lower === 'malik' || lower === 'malik campbell') return 'Malik Campbell';
  if (lower === 'ryan' || lower === 'raahim' || lower === 'raahim ahmed') return 'Raahim Ahmed';
  if (lower === 'ayaan' || lower === 'ayaan baig') return 'Ayaan Baig';
  return clean;
}

const normalizeComp = (name: string) => {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\b(inc|incorporated|ltd|limited|corp|corporation|group|llc|gsc|co)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
};

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const supabase = await createServiceClient();
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get('filter') || 'all'; // all, hot, construction, callbacks, walkthroughs, missing_info

    // 1. Fetch B2B Commercial Phone & Imported leads
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('*')
      .or('source.in.(phone_sales_os,contact_import,apollo),company_name.ilike.%Apex Edge%')
      .order('created_at', { ascending: false });

    if (leadsError) {
      console.error('[API /api/sales/leads] B2B Leads query error:', leadsError);
    }

    // 2. Fetch outreach tasks indexed on lead_id to preserve callback time of day
    const { data: tasks } = await supabase
      .from('outreach_tasks')
      .select('id, lead_id, rep_id, due_at, task_type, status, notes')
      .eq('status', 'pending')
      .order('due_at', { ascending: true });

    const tasksByLeadId = new Map<string, any[]>();
    for (const t of (tasks || [])) {
      const lId = String(t.lead_id);
      const list = tasksByLeadId.get(lId) || [];
      list.push(t);
      tasksByLeadId.set(lId, list);
    }

    // 3. Scalable Call Event Fetch:
    // Only select necessary fields and limit to recent calls to avoid OOM / slow JSON parsing
    const { data: callEvents, error: callsError } = await supabase
      .from('events')
      .select('event_id, rep_id, created_at, payload')
      .eq('type', 'PHONE_CALL')
      .order('created_at', { ascending: false })
      .limit(5000);

    if (callsError) {
      console.error('[API /api/sales/leads] Calls query error:', callsError);
    }

    // 4. Pre-index calls into O(1) Maps by contact_id, phone, and company
    const callsByContactId = new Map<string, any[]>();
    const callsByPhone = new Map<string, any[]>();
    const callsByCompany = new Map<string, any[]>();

    for (const e of (callEvents || [])) {
      let p = e.payload;
      if (typeof p === 'string') {
        try { p = JSON.parse(p); } catch { p = {}; }
      }

      const contactId = p.contact_id ? String(p.contact_id).replace(/^lead_/, '') : null;
      const rawPhone = p.phone_number || '';
      const cleanPhone = rawPhone.replace(/[^0-9]/g, '');
      const rawCompany = p.company_name || '';
      const normCompany = normalizeComp(rawCompany);

      const callSummary = {
        event_id: e.event_id || p.event_id,
        created_at: e.created_at || p.timestamp,
        contact_id: contactId,
        contact_name: p.contact_name,
        company_name: p.company_name,
        phone_number: p.phone_number,
        outcome_type: p.outcome_type,
        duration_seconds: p.duration_seconds || 0,
        notes: p.notes || '',
        rep_name: cleanRepName(p.rep_name),
        callback_time: p.callback_time,
        source: p.source || 'manual',
      };

      if (contactId) {
        const arr = callsByContactId.get(contactId) || [];
        arr.push(callSummary);
        callsByContactId.set(contactId, arr);
      }
      if (cleanPhone) {
        const arr = callsByPhone.get(cleanPhone) || [];
        arr.push(callSummary);
        callsByPhone.set(cleanPhone, arr);
      }
      if (normCompany) {
        const arr = callsByCompany.get(normCompany) || [];
        arr.push(callSummary);
        callsByCompany.set(normCompany, arr);
      }
    }

    // 5. Format into B2B tele-sales contacts with O(1) hash map lookups
    let b2bQueue = (leads || []).map((l: any) => {
      let intel: any = {};
      if (l.notes) {
        try {
          if (l.notes.startsWith('{') && l.notes.endsWith('}')) {
            intel = JSON.parse(l.notes);
          }
        } catch {}
      }

      const primaryPhone = l.customer_phone || intel.work_direct_phone || intel.mobile_phone || intel.corporate_phone || '';
      const cleanLeadPhone = primaryPhone.replace(/[^0-9]/g, '');
      const leadCompany = l.company_name || 'Commercial Prospect';
      const normCompany = normalizeComp(leadCompany);
      const leadIdStr = String(l.id);

      // Direct calls made to this specific contact (O(1) lookup)
      const directCalls = callsByContactId.get(leadIdStr) || 
                          (cleanLeadPhone ? callsByPhone.get(cleanLeadPhone) : null) || 
                          [];

      // Company-wide touchpoints (O(1) lookup)
      const companyCalls = normCompany ? (callsByCompany.get(normCompany) || []) : [];

      // Pending outreach task / callback with preserved time of day
      const leadTasks = tasksByLeadId.get(leadIdStr) || [];
      const pendingTask = leadTasks[0] || null;
      const callbackDueAt = pendingTask?.due_at || null;

      const rawSector = (l.service_type || intel.industry || intel.sector || '').toLowerCase();
      let sector = 'post_construction';
      if (rawSector.includes('franchise') || rawSector.includes('franchisee') || rawSector.includes('owner-operator')) {
        sector = 'franchise_owners';
      } else if (rawSector.includes('office') || rawSector.includes('corporate') || rawSector.includes('financial')) {
        sector = 'commercial_office';
      } else if (rawSector.includes('property') || rawSector.includes('real estate') || rawSector.includes('residential') || rawSector.includes('hoa') || rawSector.includes('landlord')) {
        sector = 'property_management';
      } else if (rawSector.includes('industrial') || rawSector.includes('warehouse') || rawSector.includes('logistics') || rawSector.includes('plant') || rawSector.includes('manufacturing')) {
        sector = 'industrial_warehouse';
      } else if (rawSector.includes('medical') || rawSector.includes('health') || rawSector.includes('clinic') || rawSector.includes('dental')) {
        sector = 'medical_healthcare';
      } else if (rawSector.includes('retail') || rawSector.includes('hospitality') || rawSector.includes('restaurant') || rawSector.includes('hotel')) {
        sector = 'retail_hospitality';
      } else {
        sector = 'post_construction';
      }

      let cleanNotes = '';
      if (typeof intel === 'object' && Object.keys(intel).length > 0) {
        cleanNotes = intel.notes || intel.rep_notes || '';
      } else if (typeof l.notes === 'string') {
        cleanNotes = l.notes;
      }

      return {
        id: l.id,
        contact_id: `lead_${l.id}`,
        type: 'B2B_LEAD',
        source: l.source || 'contact_import',
        name: l.customer_name || '',
        company: leadCompany,
        position: l.contact_title || '',
        phone: primaryPhone,
        email: l.customer_email || '',
        city: l.city || 'GTA',
        service_type: l.service_type || 'post_construction_clean',
        sector: sector,
        estimated_value: l.quoted_price ? Number(l.quoted_price) : 2500,
        status: l.status || 'new', // new, contacted, no_answer, voicemail, walkthrough_booked, quoted, won, lost
        notes: cleanNotes || '',
        transcript: intel.transcript || null,
        ai_summary: intel.ai_summary || null,
        preferred_date: l.preferred_date || null,
        callback_due_at: callbackDueAt, // Preserves exact time of day
        created_at: l.created_at,
        priority: 'HIGH',
        // Outreach & Call History Intelligence
        times_contacted: directCalls.length,
        last_contacted_at: directCalls[0]?.created_at || null,
        last_outcome: directCalls[0]?.outcome_type || null,
        last_notes: directCalls[0]?.notes || null,
        last_rep_name: directCalls[0]?.rep_name ? cleanRepName(directCalls[0].rep_name) : null,
        call_logs: directCalls.slice(0, 10), // Limit payload size for scale
        company_times_contacted: companyCalls.length,
        company_last_contacted_at: companyCalls[0]?.created_at || null,
        company_last_contacted_name: companyCalls[0]?.contact_name || null,
        company_last_outcome: companyCalls[0]?.outcome_type || null,
        // Rich intelligence fields
        seniority: intel.seniority || 'Manager',
        departments: intel.departments || '',
        sub_departments: intel.sub_departments || '',
        work_direct_phone: intel.work_direct_phone || '',
        mobile_phone: intel.mobile_phone || '',
        corporate_phone: intel.corporate_phone || '',
        employees: intel.employees || '',
        annual_revenue: intel.annual_revenue || '',
        industry: intel.industry || 'construction',
        address: intel.address || '',
        linkedin: intel.linkedin || '',
        website: intel.website || '',
        technologies: intel.technologies || '',
      };
    });

    if (filter === 'hot') {
      b2bQueue = b2bQueue.filter((c: any) => c.status === 'new' || c.status === 'quoted');
    } else if (filter === 'construction') {
      b2bQueue = b2bQueue.filter((c: any) => 
        c.service_type === 'post_construction_clean' || 
        (c.company || '').toLowerCase().includes('builder') ||
        (c.company || '').toLowerCase().includes('construct') ||
        (c.company || '').toLowerCase().includes('design') ||
        (c.position || '').toLowerCase().includes('project manager') ||
        (c.position || '').toLowerCase().includes('superintendent') ||
        (c.position || '').toLowerCase().includes('coordinator') ||
        (c.company || '').toLowerCase().includes('apex edge')
      );
    } else if (filter === 'callbacks') {
      b2bQueue = b2bQueue.filter((c: any) => c.status === 'contacted' || Boolean(c.callback_due_at));
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
        construction_leads: b2bQueue.filter((l: any) => l.service_type === 'post_construction_clean').length,
      }
    });
  } catch (err: any) {
    console.error('[API /api/sales/leads] Exception:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const supabase = await createServiceClient();
    const body = await request.json();
    const { 
      lead_id, status, notes, callback_time,
      customer_name, company_name, contact_title, 
      customer_phone, phone, work_direct_phone, mobile_phone, corporate_phone,
      customer_email, email, city, service_type, sector, quoted_price
    } = body;

    if (!lead_id) {
      return NextResponse.json({ error: 'lead_id is required' }, { status: 400 });
    }

    const rawId = String(lead_id).replace(/^lead_/, '');
    const updatePayload: any = { updated_at: new Date().toISOString() };
    
    // Resolve primary phone
    const effectivePhone = customer_phone !== undefined ? customer_phone : phone;
    if (effectivePhone !== undefined) {
      updatePayload.customer_phone = effectivePhone;
    }

    // Fetch existing lead to sync intel metadata in notes JSON
    const { data: existingLead } = await supabase.from('leads').select('notes, customer_phone').eq('id', rawId).maybeSingle();
    let parsedNotes: any = null;
    let isJsonNotes = false;

    if (existingLead?.notes && existingLead.notes.startsWith('{') && existingLead.notes.endsWith('}')) {
      try {
        parsedNotes = JSON.parse(existingLead.notes);
        isJsonNotes = true;
      } catch {
        parsedNotes = null;
      }
    }

    if (isJsonNotes && parsedNotes) {
      if (notes !== undefined) {
        parsedNotes.notes = notes;
        parsedNotes.rep_notes = notes;
      }
      if (work_direct_phone !== undefined) {
        parsedNotes.work_direct_phone = work_direct_phone;
      }
      if (mobile_phone !== undefined) {
        parsedNotes.mobile_phone = mobile_phone;
      }
      if (corporate_phone !== undefined) {
        parsedNotes.corporate_phone = corporate_phone;
      }
      if (effectivePhone !== undefined) {
        if (work_direct_phone === undefined && (!parsedNotes.work_direct_phone || parsedNotes.work_direct_phone === existingLead?.customer_phone)) {
          parsedNotes.work_direct_phone = effectivePhone;
        }
      }
      if (updatePayload.customer_phone === undefined && (parsedNotes.work_direct_phone || parsedNotes.mobile_phone)) {
        updatePayload.customer_phone = parsedNotes.work_direct_phone || parsedNotes.mobile_phone;
      }
      if (customer_name !== undefined) parsedNotes.full_name = customer_name;
      if (customer_email !== undefined || email !== undefined) parsedNotes.email = customer_email || email;

      updatePayload.notes = JSON.stringify(parsedNotes);
    } else {
      if (notes !== undefined) updatePayload.notes = notes;
      if (updatePayload.customer_phone === undefined && (work_direct_phone || mobile_phone)) {
        updatePayload.customer_phone = work_direct_phone || mobile_phone;
      }
    }

    if (status !== undefined) updatePayload.status = status;
    
    if (callback_time !== undefined) {
      updatePayload.preferred_date = callback_time ? callback_time.split('T')[0] : null;

      // Persist full callback timestamp into outreach_tasks
      if (callback_time) {
        try {
          await supabase.from('outreach_tasks').insert({
            lead_id: rawId,
            rep_id: auth.id,
            task_type: 'callback',
            status: 'pending',
            due_at: new Date(callback_time).toISOString(),
            notes: notes ? `Callback: ${notes}` : 'Scheduled callback',
          });
        } catch (taskErr) {
          console.warn('[API /api/sales/leads PATCH] outreach_task creation error:', taskErr);
        }
      }
    }

    if (customer_name !== undefined) updatePayload.customer_name = customer_name;
    if (company_name !== undefined) updatePayload.company_name = company_name;
    if (contact_title !== undefined) updatePayload.contact_title = contact_title;
    if (customer_email !== undefined) updatePayload.customer_email = customer_email;
    else if (email !== undefined) updatePayload.customer_email = email;
    if (city !== undefined) updatePayload.city = city;
    if (sector !== undefined) updatePayload.service_type = sector;
    if (service_type !== undefined) updatePayload.service_type = service_type;
    if (quoted_price !== undefined) updatePayload.quoted_price = quoted_price ? parseFloat(quoted_price) : null;

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
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const supabase = await createServiceClient();
    const body = await request.json();

    // Support batch import from spreadsheets/CSV
    if (Array.isArray(body.leads)) {
      const rows = body.leads.map((item: any) => ({
        source: item.source || 'contact_import',
        customer_name: item.customer_name || item.name || null,
        company_name: item.company_name || item.company || 'Commercial Prospect',
        contact_title: item.contact_title || item.position || item.title || null,
        customer_phone: item.customer_phone || item.phone || '',
        customer_email: item.customer_email || item.email || null,
        city: item.city || 'GTA',
        service_type: item.service_type || 'post_construction_clean',
        quoted_price: item.quoted_price ? parseFloat(item.quoted_price) : 2500,
        notes: typeof item.notes === 'string' ? item.notes : JSON.stringify(item.notes || {}),
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
        source: body.source || 'phone_sales_os',
        customer_name: body.customer_name || body.name || null,
        company_name: body.company_name || body.company || 'Commercial Prospect',
        contact_title: body.contact_title || body.position || body.title || null,
        customer_phone: body.customer_phone || body.phone || '',
        customer_email: body.customer_email || body.email || null,
        city: body.city || 'GTA',
        service_type: body.service_type || 'post_construction_clean',
        preferred_date: body.preferred_date ? body.preferred_date.split('T')[0] : null,
        preferred_start_time: body.preferred_start_time || '09:00',
        quoted_price: body.quoted_price ? parseFloat(body.quoted_price) : 2500,
        notes: typeof body.notes === 'string' ? body.notes : JSON.stringify(body.notes || {}),
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

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const supabase = await createServiceClient();
    const { searchParams } = new URL(request.url);
    const clearAll = searchParams.get('all') === 'true' || searchParams.get('clear_all') === 'true';
    let leadId = searchParams.get('lead_id') || searchParams.get('id');

    if (!leadId && !clearAll) {
      try {
        const body = await request.json();
        leadId = body.lead_id || body.id;
      } catch {}
    }

    if (clearAll) {
      const { data, error } = await supabase
        .from('leads')
        .delete()
        .or('source.in.(phone_sales_os,contact_import,apollo),company_name.ilike.%Apex Edge%')
        .select();

      if (error) throw error;
      return NextResponse.json({ success: true, message: 'All B2B phone leads deleted', count: data?.length || 0 });
    }

    if (!leadId) {
      return NextResponse.json({ error: 'lead_id is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('leads')
      .delete()
      .eq('id', leadId)
      .select();

    if (error) throw error;
    return NextResponse.json({ success: true, message: `Lead ${leadId} permanently deleted`, lead: data?.[0] });
  } catch (err: any) {
    console.error('[API /api/sales/leads DELETE] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
