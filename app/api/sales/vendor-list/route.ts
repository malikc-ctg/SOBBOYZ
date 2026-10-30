import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/api-auth';
import { NextRequest, NextResponse } from 'next/server';
import { companyKey } from '@/lib/sales/followups/company';
import { resolveCanonicalSector, toValidServiceType } from '@/lib/sales/sectorUtils';

export interface VendorProfileMeta {
  approval_status: 'pending_submission' | 'submitted' | 'approved';
  procurement_mode: 'vendor_list' | 'bid_tender' | 'both';
  checklist: string[];
  completed_items: string[];
  portal_url: string;
  procurement_email: string;
  next_tender_date: string | null;
  notes: string;
  primary_contact_id: string;
  primary_contact_name: string;
  logged_by: string;
  logged_at: string;
}

function parseNotesJson(rawNotes: any): Record<string, any> {
  if (!rawNotes) return {};
  if (typeof rawNotes === 'object') return { ...rawNotes };
  if (typeof rawNotes === 'string') {
    const trimmed = rawNotes.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        return JSON.parse(trimmed);
      } catch {
        return { notes: rawNotes, rep_notes: rawNotes };
      }
    }
    return { notes: rawNotes, rep_notes: rawNotes };
  }
  return {};
}

function getSeniorityScore(seniority = '', title = ''): number {
  const combined = `${seniority} ${title}`.toLowerCase();
  if (/\b(ceo|coo|cfo|owner|founder|president|principal|partner)\b/.test(combined)) return 5;
  if (/\b(vp|vice president|director|general manager|head of)\b/.test(combined)) return 4;
  if (combined.includes('senior') || combined.includes('sr.') || combined.includes('estimator')) return 3.5;
  if (combined.includes('manager') || combined.includes('superintendent')) return 3;
  return 2;
}

/**
 * GET /api/sales/vendor-list
 * Returns:
 * 1. Rolled-up Company Vendor / Bid List accounts (with all colleagues bundled under each company)
 * 2. Active Commercial Bids & Tenders (source = 'bid_tender')
 */
export async function GET() {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const supabase = await createServiceClient();

    // 1. Fetch all leads that are either on the vendor_list OR are commercial B2B leads OR bid_tender
    const { data: allLeads, error } = await supabase
      .from('leads')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    // Identify all company keys that have been rolled into Vendor Lists & Tenders
    const vendorCompanyKeys = new Set<string>();
    const standaloneVendorLeadIds = new Set<string>();

    for (const l of allLeads || []) {
      const intel = parseNotesJson(l.notes);
      if (l.status === 'vendor_list' || l.source === 'vendor_list' || intel.vendor_profile) {
        const cKey = companyKey(l.company_name);
        if (cKey) {
          vendorCompanyKeys.add(cKey);
        } else {
          standaloneVendorLeadIds.add(String(l.id));
        }
      }
    }

    // Separate active Project Bids/Tenders (source === 'bid_tender')
    const tenderRows = (allLeads || []).filter((l: any) => l.source === 'bid_tender');

    // Collect all colleagues belonging to any rolled-up Vendor List company
    const companyGroups = new Map<string, any[]>();
    for (const l of allLeads || []) {
      if (l.source === 'bid_tender') continue;
      const cKey = companyKey(l.company_name);
      const isVendorLead =
        (cKey && vendorCompanyKeys.has(cKey)) ||
        standaloneVendorLeadIds.has(String(l.id)) ||
        l.status === 'vendor_list' ||
        l.source === 'vendor_list';

      if (!isVendorLead) continue;

      const groupKey = cKey || `lead_${l.id}`;
      const list = companyGroups.get(groupKey) || [];
      list.push(l);
      companyGroups.set(groupKey, list);
    }

    // Build unified Company Vendor Account objects
    const companies: any[] = [];
    for (const [groupKey, members] of Array.from(companyGroups.entries())) {
      // Find the member with the newest vendor_profile metadata
      let latestVendorProfile: Partial<VendorProfileMeta> = {};
      let primaryLead = members[0];

      for (const m of members) {
        const mIntel = parseNotesJson(m.notes);
        if (mIntel.vendor_profile) {
          if (
            !latestVendorProfile.logged_at ||
            new Date(mIntel.vendor_profile.logged_at || 0) >= new Date(latestVendorProfile.logged_at || 0)
          ) {
            latestVendorProfile = mIntel.vendor_profile;
          }
          if (mIntel.vendor_profile.primary_contact_id && String(m.id) === String(mIntel.vendor_profile.primary_contact_id)) {
            primaryLead = m;
          }
        }
      }

      const firstIntel = parseNotesJson(primaryLead.notes);
      const rawSector = firstIntel.sector || firstIntel.industry || primaryLead.service_type || 'post_construction';
      const sector = resolveCanonicalSector(rawSector);

      const formattedContacts = members
        .map((m: any) => {
          const intel = parseNotesJson(m.notes);
          return {
            id: m.id,
            name: m.customer_name || 'Decision Maker',
            position: m.contact_title || intel.position || 'Project Lead',
            seniority: intel.seniority || 'Manager',
            phone: m.customer_phone || intel.work_direct_phone || intel.mobile_phone || '',
            work_direct_phone: intel.work_direct_phone || '',
            mobile_phone: intel.mobile_phone || intel.other_phone || '',
            corporate_phone: intel.corporate_phone || '',
            extension: intel.extension || intel.ext || null,
            email: m.customer_email || intel.email || '',
            city: m.city || 'GTA',
            linkedin: intel.linkedin || '',
            notes: typeof intel.notes === 'string' ? intel.notes : '',
            is_primary: String(m.id) === String(latestVendorProfile.primary_contact_id || primaryLead.id),
            updated_at: m.updated_at,
          };
        })
        .sort((a: any, b: any) => {
          if (a.is_primary && !b.is_primary) return -1;
          if (!a.is_primary && b.is_primary) return 1;
          return getSeniorityScore(b.seniority, b.position) - getSeniorityScore(a.seniority, a.position);
        });

      const companyTenders = tenderRows.filter((t: any) => {
        const tKey = companyKey(t.company_name);
        return tKey && tKey === groupKey;
      });

      companies.push({
        company_key: groupKey,
        company_name: primaryLead.company_name || 'Commercial Account',
        sector,
        service_type: primaryLead.service_type || 'post_construction_clean',
        city: primaryLead.city || 'GTA',
        website: firstIntel.website || '',
        address: firstIntel.address || '',
        employees: firstIntel.employees || '',
        annual_revenue: firstIntel.annual_revenue || '',
        approval_status: latestVendorProfile.approval_status || 'pending_submission',
        procurement_mode: latestVendorProfile.procurement_mode || 'vendor_list',
        checklist: latestVendorProfile.checklist || ['coi', 'wsib', 'profile'],
        completed_items: latestVendorProfile.completed_items || [],
        portal_url: latestVendorProfile.portal_url || '',
        procurement_email:
          latestVendorProfile.procurement_email ||
          primaryLead.customer_email ||
          formattedContacts.find((c: any) => c.email)?.email ||
          '',
        next_tender_date: latestVendorProfile.next_tender_date || primaryLead.preferred_date || null,
        vendor_notes: latestVendorProfile.notes || '',
        logged_by: latestVendorProfile.logged_by || 'Sales Rep',
        logged_at: latestVendorProfile.logged_at || primaryLead.updated_at,
        primary_contact: formattedContacts[0] || null,
        contacts: formattedContacts,
        contacts_count: formattedContacts.length,
        tenders_count: companyTenders.length,
      });
    }

    // Format active Project Bids & Tenders
    const tenders = tenderRows.map((t: any) => {
      const intel = parseNotesJson(t.notes);
      const tenderMeta = intel.tender_meta || {};
      return {
        id: t.id,
        company_name: t.company_name || 'Commercial Client',
        company_key: companyKey(t.company_name) || null,
        customer_name: t.customer_name || '',
        contact_title: t.contact_title || '',
        customer_phone: t.customer_phone || '',
        customer_email: t.customer_email || '',
        city: t.city || 'GTA',
        service_type: t.service_type || 'post_construction_clean',
        project_name: tenderMeta.project_name || t.condition || 'Commercial Tender Package',
        bid_due_date: tenderMeta.bid_due_date || t.preferred_date || null,
        bid_status: tenderMeta.bid_status || (t.status === 'converted' ? 'awarded' : t.status === 'lost' ? 'not_awarded' : t.status === 'quoted' ? 'bid_submitted' : 'itb_received'),
        portal_url: tenderMeta.portal_url || '',
        scope_summary: tenderMeta.scope_summary || (typeof intel.notes === 'string' ? intel.notes : ''),
        sqft: t.home_size_sqft || tenderMeta.sqft || null,
        quoted_price: t.quoted_price ? Number(t.quoted_price) : null,
        status: t.status || 'new',
        created_at: t.created_at,
        updated_at: t.updated_at,
      };
    });

    return NextResponse.json({
      success: true,
      companies,
      tenders,
    });
  } catch (err: any) {
    console.error('[API /api/sales/vendor-list GET] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/sales/vendor-list
 * 1. action === 'roll_up_company': Rolls up the target lead AND all colleagues from the same company
 *    out of the Outbound B2B cold-call board into Inbound CRM -> Vendor Lists & Tenders.
 *    Also cancels open no_answer_drip sequences across all colleagues of that company.
 * 2. action === 'create_tender': Creates a new commercial project Bid / Tender in Inbound CRM.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const supabase = await createServiceClient();
    const body = await request.json();
    const action = body.action || 'roll_up_company';
    const nowIso = new Date().toISOString();

    if (action === 'create_tender') {
      const {
        company_name,
        customer_name,
        contact_title,
        customer_phone,
        customer_email,
        city,
        service_type,
        project_name,
        bid_due_date,
        bid_status = 'itb_received',
        portal_url = '',
        scope_summary = '',
        sqft = null,
        quoted_price = null,
        parent_lead_id = null,
      } = body;

      const mappedLeadStatus =
        bid_status === 'awarded'
          ? 'converted'
          : bid_status === 'not_awarded'
          ? 'lost'
          : bid_status === 'bid_submitted'
          ? 'quoted'
          : 'new';

      const notesPayload = {
        notes: scope_summary,
        tender_meta: {
          project_name: project_name || 'Commercial Tender',
          bid_due_date: bid_due_date || null,
          bid_status,
          portal_url,
          scope_summary,
          sqft: sqft ? Number(sqft) : null,
          parent_lead_id,
          created_by: auth.full_name || auth.email || 'Sales Rep',
          created_at: nowIso,
        },
      };

      const { data: createdTender, error: tenderErr } = await supabase
        .from('leads')
        .insert({
          source: 'bid_tender',
          company_name: company_name || 'Commercial Client',
          customer_name: customer_name || 'Estimator',
          contact_title: contact_title || 'Estimator / PM',
          customer_phone: customer_phone || '',
          customer_email: customer_email || '',
          city: city || 'GTA',
          service_type: toValidServiceType(service_type || 'post_construction_clean'),
          preferred_date: bid_due_date ? String(bid_due_date).split('T')[0] : null,
          home_size_sqft: sqft ? parseInt(String(sqft), 10) : null,
          condition: project_name || null,
          quoted_price: quoted_price ? parseFloat(String(quoted_price)) : null,
          notes: JSON.stringify(notesPayload),
          status: mappedLeadStatus,
        })
        .select()
        .single();

      if (tenderErr) throw tenderErr;

      return NextResponse.json({ success: true, tender: createdTender }, { status: 201 });
    }

    // Default Action: 'roll_up_company'
    const {
      lead_id,
      company_name,
      procurement_mode = 'vendor_list',
      checklist = ['coi', 'wsib', 'profile'],
      completed_items = [],
      portal_url = '',
      procurement_email = '',
      approval_status = 'pending_submission',
      next_tender_date = null,
      notes = '',
      rep_id,
      rep_name,
      create_initial_tender = false,
      project_name = '',
      bid_due_date = null,
      quoted_price = null,
    } = body;

    if (!lead_id) {
      return NextResponse.json({ error: 'lead_id is required' }, { status: 400 });
    }

    const rawLeadId = String(lead_id).replace(/^lead_/, '');
    const finalRepId = rep_id || auth.id;
    const finalRepName = rep_name || auth.full_name || auth.email?.split('@')[0] || 'Sales Rep';

    // Fetch primary lead
    const { data: targetLead, error: leadErr } = await supabase
      .from('leads')
      .select('*')
      .eq('id', rawLeadId)
      .maybeSingle();

    if (leadErr || !targetLead) {
      return NextResponse.json({ error: 'Target lead not found' }, { status: 404 });
    }

    const effectiveCompanyName = company_name || targetLead.company_name || 'Commercial Prospect';
    const cKey = companyKey(effectiveCompanyName);

    // Find all leads belonging to this company
    let companyLeads: any[] = [targetLead];
    if (cKey) {
      const { data: allB2BLeads } = await supabase
        .from('leads')
        .select('*')
        .neq('source', 'bid_tender');

      if (allB2BLeads && allB2BLeads.length > 0) {
        companyLeads = allB2BLeads.filter((l: any) => companyKey(l.company_name) === cKey);
      }
    }

    const vendorProfile: VendorProfileMeta = {
      approval_status,
      procurement_mode,
      checklist,
      completed_items,
      portal_url: portal_url.trim(),
      procurement_email: (procurement_email || targetLead.customer_email || '').trim(),
      next_tender_date: next_tender_date || null,
      notes: notes.trim(),
      primary_contact_id: rawLeadId,
      primary_contact_name: targetLead.customer_name || 'Primary Contact',
      logged_by: finalRepName,
      logged_at: nowIso,
    };

    const rolledUpLeadIds: string[] = [];

    // Update every colleague at this company to status = 'vendor_list' and attach vendor_profile metadata
    for (const member of companyLeads) {
      const memberIntel = parseNotesJson(member.notes);
      memberIntel.vendor_profile = vendorProfile;
      memberIntel.active_lock = null;

      if (String(member.id) === rawLeadId && notes.trim()) {
        memberIntel.notes = notes.trim();
        memberIntel.rep_notes = notes.trim();
      }

      const updateFields: Record<string, any> = {
        status: 'vendor_list',
        notes: JSON.stringify(memberIntel),
        updated_at: nowIso,
      };

      if (String(member.id) === rawLeadId) {
        if (procurement_email && procurement_email.includes('@')) {
          updateFields.customer_email = procurement_email.trim();
        }
        if (next_tender_date) {
          updateFields.preferred_date = String(next_tender_date).split('T')[0];
        }
      }

      await supabase.from('leads').update(updateFields).eq('id', member.id);
      rolledUpLeadIds.push(String(member.id));
    }

    // Cancel any open no_answer_drip sequences across ALL colleagues at this company
    if (rolledUpLeadIds.length > 0) {
      const { data: openEnrs } = await supabase
        .from('sales_followup_enrollments')
        .select('id, sequence_key')
        .in('lead_id', rolledUpLeadIds)
        .in('status', ['active', 'held', 'paused']);

      if (openEnrs && openEnrs.length > 0) {
        const enrIds = openEnrs.map((e: any) => e.id);
        await supabase
          .from('sales_followup_enrollments')
          .update({
            status: 'cancelled',
            ended_at: nowIso,
            end_reason: 'company_on_vendor_list',
            updated_at: nowIso,
          })
          .in('id', enrIds);

        await supabase
          .from('sales_followup_tasks')
          .update({
            status: 'cancelled',
            cancel_reason: 'company_on_vendor_list',
            updated_at: nowIso,
          })
          .in('enrollment_id', enrIds)
          .eq('status', 'pending');
      }
    }

    // Log the PHONE_CALL event so the rep gets +1 Dial and +1 Connected credit
    const eventId = crypto.randomUUID();
    const callPayload = {
      event_id: eventId,
      contact_id: rawLeadId,
      contact_name: targetLead.customer_name || 'Decision Maker',
      company_name: effectiveCompanyName,
      phone_number: targetLead.customer_phone || '',
      city: targetLead.city || 'GTA',
      call_type: 'OUTBOUND',
      outcome_type: 'VENDOR_LIST',
      duration_seconds: 60,
      notes:
        notes.trim() ||
        `Moved ${effectiveCompanyName} (${rolledUpLeadIds.length} contacts) to Inbound CRM Vendor Lists & Tenders`,
      rep_id: finalRepId,
      rep_name: finalRepName,
      lead_status: 'vendor_list',
      timestamp: nowIso,
    };

    await supabase.from('events').insert({
      event_id: eventId,
      rep_id: finalRepId,
      type: 'PHONE_CALL',
      payload: callPayload,
      created_at: nowIso,
    });

    // Optionally create an initial active tender if the prospect also invited us to price a specific job right now
    let createdTender = null;
    if (create_initial_tender || procurement_mode === 'bid_tender' || procurement_mode === 'both') {
      if (project_name || bid_due_date || procurement_mode === 'bid_tender') {
        const tenderNotes = {
          notes: notes.trim(),
          tender_meta: {
            project_name: project_name || `${effectiveCompanyName} — Initial Tender`,
            bid_due_date: bid_due_date || next_tender_date || null,
            bid_status: 'itb_received',
            portal_url: portal_url.trim(),
            scope_summary: notes.trim(),
            parent_lead_id: rawLeadId,
            created_by: finalRepName,
            created_at: nowIso,
          },
        };

        const { data: tData } = await supabase
          .from('leads')
          .insert({
            source: 'bid_tender',
            company_name: effectiveCompanyName,
            customer_name: targetLead.customer_name || 'Estimator',
            contact_title: targetLead.contact_title || 'Estimator / PM',
            customer_phone: targetLead.customer_phone || '',
            customer_email: (procurement_email || targetLead.customer_email || '').trim(),
            city: targetLead.city || 'GTA',
            service_type: toValidServiceType(targetLead.service_type || 'post_construction_clean'),
            preferred_date: (bid_due_date || next_tender_date)
              ? String(bid_due_date || next_tender_date).split('T')[0]
              : null,
            condition: project_name || `${effectiveCompanyName} — Initial Tender`,
            quoted_price: quoted_price ? parseFloat(String(quoted_price)) : null,
            notes: JSON.stringify(tenderNotes),
            status: 'new',
          })
          .select()
          .maybeSingle();

        createdTender = tData;
      }
    }

    return NextResponse.json({
      success: true,
      company_name: effectiveCompanyName,
      company_key: cKey,
      rolled_up_lead_ids: rolledUpLeadIds,
      rolled_up_count: rolledUpLeadIds.length,
      tender: createdTender,
      event_id: eventId,
    });
  } catch (err: any) {
    console.error('[API /api/sales/vendor-list POST] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * PATCH /api/sales/vendor-list
 * Updates either:
 * 1. A company's vendor_profile (approval_status, completed_items checklist, portal_url, procurement_email, notes)
 * 2. An active tender row (bid_status, quoted_price, bid_due_date, project_name)
 * 3. Restores a company back to the Outbound B2B Phone Sales OS board (action === 'restore_to_outbound')
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const supabase = await createServiceClient();
    const body = await request.json();
    const nowIso = new Date().toISOString();

    // Case 1: Restore company back to Outbound B2B Phone Board
    if (body.action === 'restore_to_outbound' && body.company_key) {
      const { data: allLeads } = await supabase
        .from('leads')
        .select('id, company_name, status, notes')
        .eq('status', 'vendor_list');

      const matching = (allLeads || []).filter(
        (l: any) => (companyKey(l.company_name) || `lead_${l.id}`) === body.company_key
      );

      for (const m of matching) {
        const intel = parseNotesJson(m.notes);
        delete intel.vendor_profile;
        await supabase
          .from('leads')
          .update({
            status: 'contacted',
            notes: JSON.stringify(intel),
            updated_at: nowIso,
          })
          .eq('id', m.id);
      }

      return NextResponse.json({
        success: true,
        restored_count: matching.length,
      });
    }

    // Case 2: Update a specific Tender (source === 'bid_tender')
    if (body.tender_id) {
      const { data: existingTender } = await supabase
        .from('leads')
        .select('*')
        .eq('id', body.tender_id)
        .maybeSingle();

      if (!existingTender) {
        return NextResponse.json({ error: 'Tender not found' }, { status: 404 });
      }

      const intel = parseNotesJson(existingTender.notes);
      const tenderMeta = intel.tender_meta || {};

      if (body.project_name !== undefined) tenderMeta.project_name = body.project_name;
      if (body.bid_due_date !== undefined) tenderMeta.bid_due_date = body.bid_due_date;
      if (body.bid_status !== undefined) tenderMeta.bid_status = body.bid_status;
      if (body.portal_url !== undefined) tenderMeta.portal_url = body.portal_url;
      if (body.scope_summary !== undefined) {
        tenderMeta.scope_summary = body.scope_summary;
        intel.notes = body.scope_summary;
      }
      intel.tender_meta = tenderMeta;

      const updateFields: Record<string, any> = {
        notes: JSON.stringify(intel),
        updated_at: nowIso,
      };

      if (body.project_name !== undefined) updateFields.condition = body.project_name;
      if (body.bid_due_date !== undefined) {
        updateFields.preferred_date = body.bid_due_date ? String(body.bid_due_date).split('T')[0] : null;
      }
      if (body.quoted_price !== undefined) {
        updateFields.quoted_price = body.quoted_price !== null && body.quoted_price !== '' ? parseFloat(String(body.quoted_price)) : null;
      }
      if (body.bid_status !== undefined) {
        updateFields.status =
          body.bid_status === 'awarded'
            ? 'converted'
            : body.bid_status === 'not_awarded'
            ? 'lost'
            : body.bid_status === 'bid_submitted'
            ? 'quoted'
            : 'new';
      }

      const { data: updatedTender, error } = await supabase
        .from('leads')
        .update(updateFields)
        .eq('id', body.tender_id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, tender: updatedTender });
    }

    // Case 3: Update Company Vendor Profile across all leads sharing company_key
    const targetKey = body.company_key;
    if (!targetKey) {
      return NextResponse.json({ error: 'company_key or tender_id is required' }, { status: 400 });
    }

    const { data: allVendorLeads } = await supabase
      .from('leads')
      .select('*')
      .neq('source', 'bid_tender');

    const matchingLeads = (allVendorLeads || []).filter(
      (l: any) => (companyKey(l.company_name) || `lead_${l.id}`) === targetKey
    );

    for (const m of matchingLeads) {
      const intel = parseNotesJson(m.notes);
      const vp: Partial<VendorProfileMeta> = intel.vendor_profile || {};

      if (body.approval_status !== undefined) vp.approval_status = body.approval_status;
      if (body.procurement_mode !== undefined) vp.procurement_mode = body.procurement_mode;
      if (body.checklist !== undefined) vp.checklist = body.checklist;
      if (body.completed_items !== undefined) vp.completed_items = body.completed_items;
      if (body.portal_url !== undefined) vp.portal_url = body.portal_url;
      if (body.procurement_email !== undefined) vp.procurement_email = body.procurement_email;
      if (body.next_tender_date !== undefined) vp.next_tender_date = body.next_tender_date;
      if (body.vendor_notes !== undefined) vp.notes = body.vendor_notes;

      intel.vendor_profile = vp;

      await supabase
        .from('leads')
        .update({
          status: 'vendor_list',
          notes: JSON.stringify(intel),
          updated_at: nowIso,
        })
        .eq('id', m.id);
    }

    return NextResponse.json({
      success: true,
      updated_contacts: matchingLeads.length,
    });
  } catch (err: any) {
    console.error('[API /api/sales/vendor-list PATCH] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
