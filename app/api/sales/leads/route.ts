import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/api-auth';
import { NextRequest, NextResponse } from 'next/server';
import { toValidServiceType, resolveCanonicalSector } from '@/lib/sales/sectorUtils';


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

      const resolvedMobilePhone = intel.mobile_phone || intel.other_phone || '';
      const rawExt = String(intel.extension || intel.ext || '').trim();
      let primaryPhone = l.customer_phone || '';
      // If customer_phone lacks extension but work_direct_phone has one, prioritize work_direct_phone
      if (intel.work_direct_phone && !/\b(?:ext\.?|extension|x|#)\s*[0-9]{1,6}\b/i.test(primaryPhone) && /\b(?:ext\.?|extension|x|#)\s*[0-9]{1,6}\b/i.test(intel.work_direct_phone)) {
        primaryPhone = intel.work_direct_phone;
      }
      if (!primaryPhone) {
        primaryPhone = intel.work_direct_phone || resolvedMobilePhone || intel.corporate_phone || '';
      }
      const extMatch = primaryPhone.match(/\b(?:ext\.?|extension|x|#)\s*([0-9]{1,6})\b/i);
      const leadExtension = rawExt || (extMatch ? extMatch[1] : '');
      if (leadExtension && !extMatch && primaryPhone) {
        primaryPhone = `${primaryPhone} ext ${leadExtension}`;
      }

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

      // Resolve canonical sector (prioritizing explicit sector in notes JSON over DB service_type)
      const rawSector = intel.sector || intel.industry || l.service_type || '';
      const sector = resolveCanonicalSector(rawSector);

      let cleanNotes = '';
      if (typeof intel === 'object' && Object.keys(intel).length > 0) {
        cleanNotes = intel.notes || intel.rep_notes || '';
      } else if (typeof l.notes === 'string') {
        cleanNotes = l.notes;
      }

      // Check for active non-expired dial/view lock (5-min TTL)
      let activeLock = null;
      if (intel?.active_lock && intel.active_lock.expires_at) {
        const exp = new Date(intel.active_lock.expires_at).getTime();
        if (Number.isFinite(exp) && exp > Date.now()) {
          activeLock = intel.active_lock;
        }
      }

      // Resolve status: if a lead was previously stored as 'quoted' when logging INFO_SENT,
      // surface it under the dedicated 'info_sent' stage unless a quote was explicitly sent.
      let resolvedStatus = l.status || 'new';
      if (resolvedStatus === 'quoted' && directCalls[0]?.outcome_type === 'INFO_SENT') {
        resolvedStatus = 'info_sent';
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
        extension: leadExtension || null,
        email: l.customer_email || '',
        city: l.city || 'GTA',
        service_type: toValidServiceType(l.service_type || sector),
        sector: sector,
        estimated_value: l.quoted_price ? Number(l.quoted_price) : 2500,
        status: resolvedStatus, // new, contacted, no_answer, voicemail, info_sent, walkthrough_booked, quoted, won, lost
        notes: cleanNotes || '',
        active_lock: activeLock,
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
        mobile_phone: resolvedMobilePhone,
        other_phone: intel.other_phone || resolvedMobilePhone,
        corporate_phone: intel.corporate_phone || '',
        employees: intel.employees || '',
        annual_revenue: intel.annual_revenue || '',
        industry: intel.industry || 'construction',
        address: intel.address || '',
        linkedin: intel.linkedin || '',
        website: intel.website || '',
        technologies: intel.technologies || '',
        ai_recon: intel.ai_recon || null,
        last_autopilot: intel.last_autopilot || null,
      };
    });

    // Exclude companies that have been rolled up into Inbound CRM -> Vendor Lists & Tenders
    const vendorCompanyNorms = new Set<string>();
    for (const c of b2bQueue) {
      if (c.status === 'vendor_list') {
        const norm = normalizeComp(c.company || '');
        if (norm && norm !== 'commercialprospect') {
          vendorCompanyNorms.add(norm);
        }
      }
    }

    if (filter !== 'vendor_list') {
      b2bQueue = b2bQueue.filter((c: any) => {
        if (c.status === 'vendor_list') return false;
        const norm = normalizeComp(c.company || '');
        if (norm && vendorCompanyNorms.has(norm)) return false;
        return true;
      });
    }

    if (filter === 'hot') {
      b2bQueue = b2bQueue.filter((c: any) => c.status === 'new' || c.status === 'info_sent' || c.status === 'quoted');
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
      customer_email, email, city, service_type, sector, quoted_price,
      active_lock
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

    if (active_lock !== undefined && (!isJsonNotes || !parsedNotes)) {
      parsedNotes = { notes: existingLead?.notes || '', rep_notes: existingLead?.notes || '' };
      isJsonNotes = true;
    }

    if (isJsonNotes && parsedNotes) {
      if (notes !== undefined) {
        parsedNotes.notes = notes;
        parsedNotes.rep_notes = notes;
      }
      if (active_lock !== undefined) {
        parsedNotes.active_lock = active_lock;
      } else if (status !== undefined) {
        parsedNotes.active_lock = null;
      }
      if (work_direct_phone !== undefined) {
        parsedNotes.work_direct_phone = work_direct_phone;
      }
      if (mobile_phone !== undefined) {
        parsedNotes.mobile_phone = mobile_phone;
        if (parsedNotes.other_phone !== undefined) {
          parsedNotes.other_phone = mobile_phone;
        }
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

    // Safely handle sector & service_type without breaking Postgres service_type enum
    if (sector !== undefined) {
      const canonicalSector = resolveCanonicalSector(sector);
      if (!isJsonNotes || !parsedNotes) {
        parsedNotes = { notes: existingLead?.notes || '', rep_notes: existingLead?.notes || '' };
        isJsonNotes = true;
      }
      parsedNotes.sector = canonicalSector;
      parsedNotes.industry = canonicalSector;
      updatePayload.notes = JSON.stringify(parsedNotes);
      updatePayload.service_type = toValidServiceType(service_type || canonicalSector);
    } else if (service_type !== undefined) {
      updatePayload.service_type = toValidServiceType(service_type);
    }

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
      const rows = body.leads.map((item: any) => {
        const itemSector = resolveCanonicalSector(item.sector || item.industry || item.service_type || 'post_construction');
        const itemServiceType = toValidServiceType(item.service_type || itemSector);

        let itemIntel: any = {};
        if (typeof item.notes === 'string') {
          try {
            if (item.notes.startsWith('{') && item.notes.endsWith('}')) {
              itemIntel = JSON.parse(item.notes);
            } else {
              itemIntel = { notes: item.notes, rep_notes: item.notes };
            }
          } catch {
            itemIntel = { notes: item.notes, rep_notes: item.notes };
          }
        } else if (typeof item.notes === 'object' && item.notes !== null) {
          itemIntel = { ...item.notes };
        }
        itemIntel.sector = itemSector;
        itemIntel.industry = itemSector;
        const resolvedItemMobile = itemIntel.mobile_phone || itemIntel.other_phone || item.mobile_phone || item.other_phone || '';
        if (resolvedItemMobile) {
          itemIntel.mobile_phone = resolvedItemMobile;
        }

        return {
          source: item.source || 'contact_import',
          customer_name: item.customer_name || item.name || null,
          company_name: item.company_name || item.company || 'Commercial Prospect',
          contact_title: item.contact_title || item.position || item.title || null,
          customer_phone: item.customer_phone || item.phone || '',
          customer_email: item.customer_email || item.email || null,
          city: item.city || 'GTA',
          service_type: itemServiceType,
          quoted_price: item.quoted_price ? parseFloat(item.quoted_price) : (itemSector === 'post_construction' ? 2500 : 950),
          notes: JSON.stringify(itemIntel),
          status: item.status || 'new',
        };
      });

      const { data, error } = await supabase
        .from('leads')
        .insert(rows)
        .select();

      if (error) throw error;
      return NextResponse.json({ success: true, count: data?.length || rows.length, leads: data }, { status: 201 });
    }

    // Single lead creation
    const leadSector = resolveCanonicalSector(body.sector || body.industry || body.service_type || 'post_construction');
    const dbServiceType = toValidServiceType(body.service_type || leadSector);

    let singleIntel: any = {};
    if (typeof body.notes === 'string') {
      try {
        if (body.notes.startsWith('{') && body.notes.endsWith('}')) {
          singleIntel = JSON.parse(body.notes);
        } else {
          singleIntel = { notes: body.notes, rep_notes: body.notes };
        }
      } catch {
        singleIntel = { notes: body.notes, rep_notes: body.notes };
      }
    } else if (typeof body.notes === 'object' && body.notes !== null) {
      singleIntel = { ...body.notes };
    }
    singleIntel.sector = leadSector;
    singleIntel.industry = leadSector;
    const resolvedSingleMobile = singleIntel.mobile_phone || singleIntel.other_phone || body.mobile_phone || body.other_phone || '';
    if (resolvedSingleMobile) {
      singleIntel.mobile_phone = resolvedSingleMobile;
    }

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
        service_type: dbServiceType,
        preferred_date: body.preferred_date ? body.preferred_date.split('T')[0] : null,
        preferred_start_time: body.preferred_start_time || '09:00',
        quoted_price: body.quoted_price ? parseFloat(body.quoted_price) : (leadSector === 'post_construction' ? 2500 : 950),
        notes: JSON.stringify(singleIntel),
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
