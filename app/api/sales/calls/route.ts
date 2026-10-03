import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Normalizes company names for fuzzy grouping across calls
 */
function normalizeCompanyName(name: string) {
  if (!name) return '';
  return name
    .toLowerCase()
    .replace(/\b(inc|incorporated|ltd|limited|corp|corporation|group|llc|gsc|co)\b/gi, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * GET /api/sales/calls
 * Fetches phone call history logs with optional contact or company filtering
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServiceClient();
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contact_id');
    const company = searchParams.get('company');

    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .eq('type', 'PHONE_CALL')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[API /api/sales/calls] GET error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    let calls = (events || []).map((e: any) => {
      let payload = e.payload;
      if (typeof payload === 'string') {
        try {
          payload = JSON.parse(payload);
        } catch {
          payload = {};
        }
      }
      return {
        event_id: e.event_id || e.id,
        created_at: e.created_at || payload.timestamp,
        rep_id: e.rep_id || payload.rep_id,
        rep_name: payload.rep_name || 'Malik',
        contact_id: payload.contact_id,
        contact_name: payload.contact_name,
        company_name: payload.company_name,
        phone_number: payload.phone_number,
        city: payload.city,
        call_type: payload.call_type || 'OUTBOUND',
        outcome_type: payload.outcome_type,
        duration_seconds: payload.duration_seconds || 0,
        notes: payload.notes || '',
        source: payload.source || 'manual',
        ai_summary: payload.ai_summary || null,
        recording_url: payload.recording_url || null,
        quo_call_id: payload.quo_call_id || null,
        timestamp: payload.timestamp || e.created_at,
        callback_time: payload.callback_time,
        sale_details: payload.sale_details,
      };
    });

    if (contactId) {
      const rawContactId = String(contactId).replace(/^lead_/, '');
      calls = calls.filter((c: any) => 
        String(c.contact_id).replace(/^lead_/, '') === rawContactId
      );
    } else if (company) {
      const normCompany = normalizeCompanyName(company);
      calls = calls.filter((c: any) => 
        normalizeCompanyName(c.company_name || '') === normCompany
      );
    }

    return NextResponse.json({
      success: true,
      total: calls.length,
      calls
    });
  } catch (err: any) {
    console.error('[API /api/sales/calls] Exception:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/sales/calls
 * Logs a phone call event with server service client (guaranteed permissions),
 * and updates the lead status in CRM table
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServiceClient();
    const body = await request.json();

    const {
      contact_id,
      contact_name,
      company_name,
      phone_number,
      city,
      call_type = 'OUTBOUND',
      outcome_type,
      duration_seconds = 0,
      notes = '',
      callback_time = null,
      sale_details = null,
      rep_id = '07853cdf-ed2c-4f3b-b713-cde7c40e20a1',
      rep_name = 'Malik',
    } = body;

    const eventId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    const payload = {
      event_id: eventId,
      contact_id,
      contact_name,
      company_name,
      phone_number,
      city: city || 'GTA',
      call_type,
      outcome_type,
      duration_seconds,
      notes,
      callback_time,
      sale_details,
      rep_id,
      rep_name,
      timestamp,
    };

    // 1. Insert into events table
    const { error: eventError } = await supabase.from('events').insert({
      event_id: eventId,
      rep_id,
      type: 'PHONE_CALL',
      payload: payload,
      created_at: timestamp,
    });

    if (eventError) {
      console.warn('[API /api/sales/calls] Events insert error:', eventError);
    }

    // 2. Update lead status in CRM leads table
    if (contact_id) {
      const rawLeadId = String(contact_id).replace(/^lead_/, '');
      let dbStatus = outcome_type.toLowerCase();
      if (outcome_type === 'WALKTHROUGH') dbStatus = 'walkthrough_booked';
      if (outcome_type === 'SEND_QUOTE') dbStatus = 'quoted';
      if (outcome_type === 'CALLBACK') dbStatus = 'contacted';
      if (outcome_type === 'SALE') dbStatus = 'won';
      if (outcome_type === 'NOT_INTERESTED') dbStatus = 'lost';

      const updatePayload: any = {
        status: dbStatus,
        updated_at: timestamp
      };
      if (notes) {
        updatePayload.notes = notes;
      }
      if (callback_time) {
        updatePayload.preferred_date = callback_time;
      }

      await supabase
        .from('leads')
        .update(updatePayload)
        .eq('id', rawLeadId);
    }

    return NextResponse.json({
      success: true,
      event_id: eventId,
      call: payload
    }, { status: 201 });
  } catch (err: any) {
    console.error('[API /api/sales/calls] POST Exception:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
