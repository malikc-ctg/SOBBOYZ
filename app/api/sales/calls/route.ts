import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/api-auth';
import { NextRequest, NextResponse } from 'next/server';
import { nextLeadStatus } from '@/lib/sales/followups/leadStatus';
import { parseTorontoLocal, TORONTO_TZ } from '@/lib/sales/followups/tz';
import { runEngineForEvent } from '@/lib/sales/followups/executor';
import { autoLogWonSale } from '@/lib/sales/autoJobLogging';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TORONTO_DATE_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: TORONTO_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

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
 * Formats rep name cleanly without hardcoding defaults
 */
function cleanRepName(name: string | null | undefined): string {
  if (!name) return 'Sales Rep';
  const clean = String(name).trim();
  const lower = clean.toLowerCase();
  if (lower === 'malik' || lower === 'malik campbell') return 'Malik Campbell';
  if (lower === 'ryan' || lower === 'raahim' || lower === 'raahim ahmed') return 'Raahim Ahmed';
  if (lower === 'ayaan' || lower === 'ayaan baig') return 'Ayaan Baig';
  return clean;
}

/**
 * GET /api/sales/calls
 * Fetches phone call history logs with authenticated session check
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const supabase = await createServiceClient();
    const { searchParams } = new URL(request.url);
    const contactId = searchParams.get('contact_id');
    const company = searchParams.get('company');

    let query = supabase
      .from('events')
      .select('*')
      .eq('type', 'PHONE_CALL')
      .order('created_at', { ascending: false });

    if (contactId) {
      const rawContactId = String(contactId).replace(/^lead_/, '');
      query = query.filter('payload->>contact_id', 'eq', rawContactId);
    }

    const { data: events, error } = await query;

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
        rep_name: cleanRepName(payload.rep_name),
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
        transcript: payload.transcript || null,
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
 * Logs a phone call event under the authenticated user's session,
 * persists full due_at callback time to outreach_tasks, and updates lead status in CRM.
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

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
      rep_id,
      rep_name,
      lead_status = null,
      followup = null,
    } = body;

    // Attribute dynamically from auth session
    const finalRepId = rep_id || auth.id;
    const finalRepName = rep_name || auth.full_name || auth.email?.split('@')[0] || 'Sales Rep';

    // Accept the client's event id when it is a valid UUID so offline retries stay idempotent.
    const eventId =
      typeof body.event_id === 'string' && UUID_RE.test(body.event_id)
        ? body.event_id
        : crypto.randomUUID();
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
      rep_id: finalRepId,
      rep_name: finalRepName,
      lead_status,
      followup,
      timestamp,
    };

    // 1. Insert into events table. A unique violation means this event was already processed.
    const { error: eventError } = await supabase.from('events').insert({
      event_id: eventId,
      rep_id: finalRepId,
      type: 'PHONE_CALL',
      payload: payload,
      created_at: timestamp,
    });

    if (eventError) {
      if ((eventError as any).code === '23505') {
        return NextResponse.json({ success: true, duplicate: true, event_id: eventId }, { status: 200 });
      }
      console.warn('[API /api/sales/calls] Events insert error:', eventError);
    }

    // 2. Update lead status in CRM leads table and record outreach_tasks
    let engineSummary: any = null;
    let autoSaleResult: any = null;
    if (contact_id) {
      const rawLeadId = String(contact_id).replace(/^lead_/, '');

      const { data: currentLead } = await supabase
        .from('leads')
        .select('status')
        .eq('id', rawLeadId)
        .maybeSingle();

      const newStatus = nextLeadStatus(currentLead?.status, outcome_type, lead_status);

      // Call notes live in the event payload. Never overwrite leads.notes (rep notes and Apollo intel).
      const updatePayload: any = { updated_at: timestamp };
      if (newStatus) updatePayload.status = newStatus;

      const callbackInstant = callback_time ? parseTorontoLocal(callback_time) : null;
      if (callbackInstant) {
        // Safe DATE column value (Toronto calendar date) to prevent timestamp truncation errors
        updatePayload.preferred_date = TORONTO_DATE_FMT.format(callbackInstant);

        // 3. Create outreach_tasks record to preserve full timestamp with time of day
        try {
          await supabase.from('outreach_tasks').insert({
            lead_id: rawLeadId,
            rep_id: finalRepId,
            task_type: 'callback',
            status: 'pending',
            due_at: callbackInstant.toISOString(),
            notes: notes ? `Callback scheduled: ${notes}` : 'Scheduled callback',
          });
        } catch (taskErr) {
          console.warn('[API /api/sales/calls] Failed to insert outreach_task:', taskErr);
        }
      }

      await supabase
        .from('leads')
        .update(updatePayload)
        .eq('id', rawLeadId);

      // 4. Run follow-up engine
      try {
        const eventRow = {
          event_id: eventId,
          rep_id: finalRepId,
          type: 'PHONE_CALL',
          payload,
          created_at: timestamp,
        };
        engineSummary = await runEngineForEvent(eventRow, { sessionUserId: finalRepId });
        if (engineSummary?.statusOverride) {
          await supabase
            .from('leads')
            .update({ status: engineSummary.statusOverride, updated_at: timestamp })
            .eq('id', rawLeadId);
        }
      } catch (engineErr) {
        console.error('[API /api/sales/calls] Follow-up engine error:', engineErr);
      }

      // 5. Auto Job and Customer Logging if won deal
      if (outcome_type === 'JOB_WON' || outcome_type === 'SALE') {
        try {
          autoSaleResult = await autoLogWonSale(supabase, {
            rawLeadId,
            saleDetails: sale_details,
            repId: finalRepId,
          });
        } catch (saleErr) {
          console.error('[API /api/sales/calls] Auto log won sale error:', saleErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      event_id: eventId,
      call: payload,
      followup: engineSummary,
      toast: engineSummary?.toast || null,
      auto_sale: autoSaleResult,
    }, { status: 201 });
  } catch (err: any) {
    console.error('[API /api/sales/calls] POST Exception:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
