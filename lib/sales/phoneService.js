import { supabase } from './supabase';
import { insertLocalEvent, markEventSynced } from './db';

/**
 * B2B COMMERCIAL & POST-CONSTRUCTION PHONE SALES SERVICE
 * Powers inside tele-sales for construction companies, general contractors,
 * commercial property managers, click-to-call, lead management, and disposition logging.
 */

export const CALL_OUTCOMES = [
  { key: 'WALKTHROUGH', label: 'Site Walkthrough Booked', color: '#3b82f6', description: 'Booked jobsite walkthrough assessment' },
  { key: 'SEND_QUOTE', label: 'Send Bid / Spec Sheet', color: '#06b6d4', description: 'Requested WSIB certificate and pricing spec sheet' },
  { key: 'CALLBACK', label: 'Callback Scheduled', color: '#8b5cf6', description: 'Scheduled follow-up with Project Manager or Decision Maker' },
  { key: 'GATEKEEPER', label: 'Gatekeeper / Found DM', color: '#f59e0b', description: 'Identified Project Manager or Site Super name and direct line' },
  { key: 'CONVO', label: 'Qualified Interest', color: '#10b981', description: 'Connected with decision maker, active build in pipeline' },
  { key: 'VOICEMAIL', label: 'Left Voicemail', color: '#a855f7', description: 'Left 30-sec trade capabilities voicemail' },
  { key: 'NO_ANSWER', label: 'No Answer / Ringing', color: '#6b7280', description: 'Rang out, no answer' },
  { key: 'NOT_INTERESTED', label: 'Not Interested', color: '#ef4444', description: 'Declined or no upcoming projects' },
  { key: 'BAD_NUMBER', label: 'Bad Number', color: '#9ca3af', description: 'Disconnected or incorrect number' },
  { key: 'SALE', label: 'Contract / Job Won', color: '#10b981', description: 'Signed cleaning subcontract or purchase order issued' },
];

/**
 * Fetch B2B contacts queue from API (with filter)
 */
export async function fetchSalesContacts(filter = 'all') {
  try {
    const res = await fetch(`/api/sales/leads?filter=${filter}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.contacts || [];
  } catch (err) {
    console.warn('[PhoneService] API fetch failed:', err);
    return [];
  }
}

/**
 * Update B2B lead status in database
 */
export async function updateLeadStatus(leadId, status, notes = '', callbackTime = null) {
  try {
    const res = await fetch('/api/sales/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_id: leadId,
        status,
        notes,
        callback_time: callbackTime
      })
    });
    return await res.json();
  } catch (e) {
    console.error('[PhoneService] Update lead status failed:', e);
    return null;
  }
}

/**
 * Live In-Call Quick Enrichment & Queue Double-Click Update
 */
export async function updateLeadContact(leadId, fields = {}) {
  try {
    const res = await fetch('/api/sales/leads', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        lead_id: leadId,
        ...fields,
      })
    });
    return await res.json();
  } catch (e) {
    console.error('[PhoneService] Update lead contact failed:', e);
    return null;
  }
}

/**
 * Create a new B2B phone lead
 */
export async function createNewPhoneLead(leadData) {
  try {
    const res = await fetch('/api/sales/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(leadData)
    });
    return await res.json();
  } catch (e) {
    console.error('[PhoneService] Create B2B lead failed:', e);
    return null;
  }
}

/**
 * Batch Import Leads
 */
export async function batchImportApolloLeads(leadsArray) {
  try {
    const res = await fetch('/api/sales/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leads: leadsArray })
    });
    return await res.json();
  } catch (e) {
    console.error('[PhoneService] Batch import leads failed:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Log call event (with offline SQLocal queue + Supabase sync)
 */
export async function logCallEvent({
  contactId,
  contactName,
  phoneNumber,
  city,
  callType = 'OUTBOUND',
  outcomeType,
  durationSeconds = 0,
  notes = '',
  callbackTime = null,
  saleDetails = null,
  repId,
  repName
}) {
  const eventId = crypto.randomUUID();
  const timestamp = new Date().toISOString();

  const payload = {
    event_id: eventId,
    contact_id: contactId,
    contact_name: contactName,
    phone_number: phoneNumber,
    city: city || 'GTA',
    call_type: callType,
    outcome_type: outcomeType,
    duration_seconds: durationSeconds,
    notes: notes,
    callback_time: callbackTime,
    sale_details: saleDetails,
    rep_id: repId,
    rep_name: repName,
    timestamp: timestamp,
  };

  // 1. Save locally in SQLocal
  try {
    await insertLocalEvent(eventId, 'PHONE_CALL', payload);
  } catch (err) {
    console.warn('[PhoneService] Local SQLite write failed, proceeding:', err);
  }

  // 2. Post to server endpoint with service credentials
  try {
    const res = await fetch('/api/sales/calls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contact_id: contactId,
        contact_name: contactName,
        company_name: payload.company_name || '',
        phone_number: phoneNumber,
        city: city,
        call_type: callType,
        outcome_type: outcomeType,
        duration_seconds: durationSeconds,
        notes: notes,
        callback_time: callbackTime,
        sale_details: saleDetails,
        rep_id: repId,
        rep_name: repName
      })
    });
    if (res.ok) {
      await markEventSynced(eventId);
    }
  } catch (err) {
    console.warn('[PhoneService] Cloud API call log failed, will sync via engine:', err);
  }

  // Notify listeners to update stats
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sync-local-events'));
  }

  return { success: true, event_id: eventId };
}

/**
 * Normalizes rep names across calls
 */
export function normalizeRepName(name) {
  if (!name) return 'Unassigned';
  const clean = String(name).trim();
  if (clean.toLowerCase() === 'malik') return 'Malik Campbell';
  return clean;
}

/**
 * Get call history with support for daily shift resets, historical date archives, and per-rep tracking
 * options: {
 *   period: 'today' | 'yesterday' | 'week' | 'all' | 'custom',
 *   rep: 'all' | string,
 *   date: 'YYYY-MM-DD' | null
 * }
 */
export async function getTodayCallStats(options = {}) {
  const { period = 'today', rep = 'all', date = null } = options;

  let rawCalls = [];
  try {
    const res = await fetch('/api/sales/calls');
    if (res.ok) {
      const data = await res.json();
      rawCalls = data.calls || [];
    }
  } catch (apiErr) {
    console.warn('[PhoneService] /api/sales/calls fetch error, falling back to supabase client:', apiErr);
  }

  if (rawCalls.length === 0) {
    try {
      const { data: events, error } = await supabase
        .from('events')
        .select('*')
        .eq('type', 'PHONE_CALL')
        .order('created_at', { ascending: false });
      if (!error && events) {
        rawCalls = events.map(e => {
          let payload = e.payload;
          if (typeof payload === 'string') {
            try { payload = JSON.parse(payload); } catch { payload = {}; }
          }
          return {
            event_id: e.event_id || e.id,
            created_at: e.created_at || payload.timestamp,
            rep_id: e.rep_id || payload.rep_id,
            rep_name: payload.rep_name || 'Malik Campbell',
            contact_id: payload.contact_id,
            contact_name: payload.contact_name,
            company_name: payload.company_name,
            phone_number: payload.phone_number,
            city: payload.city,
            call_type: payload.call_type || 'OUTBOUND',
            outcome_type: payload.outcome_type,
            duration_seconds: payload.duration_seconds || 0,
            notes: payload.notes || '',
            ai_summary: payload.ai_summary || null,
            transcript: payload.transcript || null,
            recording_url: payload.recording_url || null,
            timestamp: payload.timestamp || e.created_at,
            callback_time: payload.callback_time,
            sale_details: payload.sale_details,
          };
        });
      }
    } catch (sbErr) {
      console.warn('[PhoneService] Supabase fallback error:', sbErr);
    }
  }

  // Normalize all call records
  const allCalls = rawCalls.map(c => {
    const repName = normalizeRepName(c.rep_name);
    const dateObj = new Date(c.created_at || c.timestamp || Date.now());
    const localDate = dateObj.toLocaleDateString('en-CA'); // YYYY-MM-DD
    return {
      ...c,
      rep_name: repName,
      localDate,
      dateObj
    };
  });

  // Calculate today and yesterday local date strings
  const now = new Date();
  const todayStr = now.toLocaleDateString('en-CA');
  const yesterdayObj = new Date(now);
  yesterdayObj.setDate(yesterdayObj.getDate() - 1);
  const yesterdayStr = yesterdayObj.toLocaleDateString('en-CA');

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  // Group calls by date (Shift archives)
  const dateMap = {};
  allCalls.forEach(c => {
    const d = c.localDate;
    if (!dateMap[d]) {
      dateMap[d] = {
        date: d,
        calls: [],
        reps: new Set(),
      };
    }
    dateMap[d].calls.push(c);
    dateMap[d].reps.add(c.rep_name);
  });

  const byDate = Object.keys(dateMap)
    .sort((a, b) => b.localeCompare(a))
    .map(d => {
      const dayCalls = dateMap[d].calls;
      const dials = dayCalls.length;
      const pickups = dayCalls.filter(c => ['CONVO', 'CONNECTED', 'SALE', 'WALKTHROUGH', 'SEND_QUOTE', 'CALLBACK', 'JOB_WON', 'INFO_SENT'].includes(c.outcome_type)).length;
      const noAnswers = dayCalls.filter(c => ['NO_ANSWER', 'VOICEMAIL', 'BUSY'].includes(c.outcome_type)).length;
      const infoSent = dayCalls.filter(c => ['SEND_QUOTE', 'INFO_SENT', 'QUOTE_SENT'].includes(c.outcome_type)).length;
      const walkthroughs = dayCalls.filter(c => ['WALKTHROUGH', 'WALKTHROUGH_BOOKED'].includes(c.outcome_type)).length;
      const jobsWon = dayCalls.filter(c => ['SALE', 'JOB_WON', 'WON'].includes(c.outcome_type)).length;
      const connectRate = dials > 0 ? ((pickups / dials) * 100).toFixed(1) : '0.0';

      let label = d;
      if (d === todayStr) label = 'Today (Live Shift)';
      else if (d === yesterdayStr) label = 'Yesterday';
      else {
        try {
          const parts = d.split('-');
          const dt = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
          label = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
        } catch {
          label = d;
        }
      }

      return {
        date: d,
        label,
        isToday: d === todayStr,
        isYesterday: d === yesterdayStr,
        dials,
        pickups,
        noAnswers,
        infoSent,
        walkthroughs,
        jobsWon,
        connectRate,
        reps: Array.from(dateMap[d].reps),
        calls: dayCalls
      };
    });

  // Group calls by rep
  const repMap = {};
  allCalls.forEach(c => {
    const r = normalizeRepName(c.rep_name);
    if (!repMap[r]) {
      repMap[r] = {
        repName: r,
        totalCalls: [],
        todayCalls: [],
        yesterdayCalls: []
      };
    }
    repMap[r].totalCalls.push(c);
    if (c.localDate === todayStr) repMap[r].todayCalls.push(c);
    if (c.localDate === yesterdayStr) repMap[r].yesterdayCalls.push(c);
  });

  const byRep = Object.keys(repMap)
    .map(r => {
      const repData = repMap[r];
      const repCalls = repData.totalCalls;
      const dials = repCalls.length;
      const todayDials = repData.todayCalls.length;
      const pickups = repCalls.filter(c => ['CONVO', 'CONNECTED', 'SALE', 'WALKTHROUGH', 'SEND_QUOTE', 'CALLBACK', 'JOB_WON', 'INFO_SENT'].includes(c.outcome_type)).length;
      const todayPickups = repData.todayCalls.filter(c => ['CONVO', 'CONNECTED', 'SALE', 'WALKTHROUGH', 'SEND_QUOTE', 'CALLBACK', 'JOB_WON', 'INFO_SENT'].includes(c.outcome_type)).length;
      const noAnswers = repCalls.filter(c => ['NO_ANSWER', 'VOICEMAIL', 'BUSY'].includes(c.outcome_type)).length;
      const walkthroughs = repCalls.filter(c => ['WALKTHROUGH', 'WALKTHROUGH_BOOKED'].includes(c.outcome_type)).length;
      const infoSent = repCalls.filter(c => ['SEND_QUOTE', 'INFO_SENT', 'QUOTE_SENT'].includes(c.outcome_type)).length;
      const jobsWon = repCalls.filter(c => ['SALE', 'JOB_WON', 'WON'].includes(c.outcome_type)).length;
      const connectRate = dials > 0 ? ((pickups / dials) * 100).toFixed(1) : '0.0';
      const todayConnectRate = todayDials > 0 ? ((todayPickups / todayDials) * 100).toFixed(1) : '0.0';
      
      const sortedCalls = [...repCalls].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const lastCallAt = sortedCalls[0]?.created_at || null;

      return {
        repName: r,
        totalDials: dials,
        todayDials,
        pickups,
        todayPickups,
        noAnswers,
        walkthroughs,
        infoSent,
        jobsWon,
        connectRate,
        todayConnectRate,
        lastCallAt,
        calls: repCalls
      };
    })
    .sort((a, b) => b.totalDials - a.totalDials);

  const repNames = byRep.map(r => r.repName);

  // Filter calls based on options (period, rep, date)
  let filteredCalls = allCalls;

  if (rep && rep !== 'all') {
    const targetRep = normalizeRepName(rep).toLowerCase();
    filteredCalls = filteredCalls.filter(c => normalizeRepName(c.rep_name).toLowerCase() === targetRep);
  }

  if (date) {
    filteredCalls = filteredCalls.filter(c => c.localDate === date);
  } else if (period === 'today') {
    filteredCalls = filteredCalls.filter(c => c.localDate === todayStr);
  } else if (period === 'yesterday') {
    filteredCalls = filteredCalls.filter(c => c.localDate === yesterdayStr);
  } else if (period === 'week') {
    filteredCalls = filteredCalls.filter(c => c.dateObj >= sevenDaysAgo);
  } // 'all' keeps all

  const dials = filteredCalls.length;
  const pickups = filteredCalls.filter(c => ['CONVO', 'CONNECTED', 'SALE', 'WALKTHROUGH', 'SEND_QUOTE', 'CALLBACK', 'JOB_WON', 'INFO_SENT'].includes(c.outcome_type)).length;
  const noAnswers = filteredCalls.filter(c => ['NO_ANSWER', 'VOICEMAIL', 'BUSY'].includes(c.outcome_type)).length;
  const infoSent = filteredCalls.filter(c => ['SEND_QUOTE', 'INFO_SENT', 'QUOTE_SENT'].includes(c.outcome_type)).length;
  const jobsWon = filteredCalls.filter(c => ['SALE', 'JOB_WON', 'WON'].includes(c.outcome_type)).length;
  const walkthroughs = filteredCalls.filter(c => ['WALKTHROUGH', 'WALKTHROUGH_BOOKED'].includes(c.outcome_type)).length;
  const callbacks = filteredCalls.filter(c => c.outcome_type === 'CALLBACK').length;

  let revenue = 0;
  filteredCalls.forEach(c => {
    if (['SALE', 'JOB_WON', 'WON'].includes(c.outcome_type) && c.sale_details?.job_total) {
      revenue += parseFloat(String(c.sale_details.job_total).replace(/[^0-9.]/g, '')) || 0;
    }
  });

  const connectRate = dials > 0 ? ((pickups / dials) * 100).toFixed(1) : '0.0';
  const closeRate = pickups > 0 ? ((jobsWon / pickups) * 100).toFixed(1) : '0.0';

  const todayCalls = allCalls.filter(c => c.localDate === todayStr);

  return {
    dials,
    pickups,
    noAnswers,
    infoSent,
    jobsWon,
    totalCalls: dials,
    connects: pickups,
    walkthroughs,
    callbacks,
    sales: jobsWon,
    connectRate,
    closeRate,
    revenue,
    calls: filteredCalls,
    todayCalls,
    allCalls,
    byDate,
    byRep,
    repNames,
    todayStr,
    yesterdayStr,
    currentPeriod: period,
    currentRep: rep,
    selectedDate: date
  };
}
