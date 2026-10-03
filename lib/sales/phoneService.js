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
 * Get call history for today
 */
export async function getTodayCallStats() {
  try {
    const res = await fetch('/api/sales/calls');
    if (res.ok) {
      const data = await res.json();
      const allCalls = data.calls || [];
      const totalCalls = allCalls.length;
      const connects = allCalls.filter(c => ['SALE', 'WALKTHROUGH', 'SEND_QUOTE', 'CALLBACK', 'CONVO'].includes(c.outcome_type)).length;
      const walkthroughs = allCalls.filter(c => c.outcome_type === 'WALKTHROUGH').length;
      const callbacks = allCalls.filter(c => c.outcome_type === 'CALLBACK').length;
      const sales = allCalls.filter(c => c.outcome_type === 'SALE').length;
      
      let revenue = 0;
      allCalls.forEach(c => {
        if (c.outcome_type === 'SALE' && c.sale_details?.job_total) {
          revenue += parseFloat(String(c.sale_details.job_total).replace(/[^0-9.]/g, '')) || 0;
        }
      });

      const closeRate = connects > 0 ? ((sales / connects) * 100).toFixed(1) : '0.0';

      return {
        totalCalls,
        connects,
        walkthroughs,
        callbacks,
        sales,
        closeRate,
        revenue,
        todayCalls: allCalls
      };
    }
  } catch (apiErr) {
    console.warn('[PhoneService] /api/sales/calls fetch error, trying client query:', apiErr);
  }

  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .eq('type', 'PHONE_CALL')
      .gte('created_at', `${todayStr}T00:00:00.000Z`)
      .order('created_at', { ascending: false });

    if (error || !events) {
      return {
        totalCalls: 0,
        connects: 0,
        walkthroughs: 0,
        callbacks: 0,
        sales: 0,
        closeRate: '0.0',
        revenue: 0,
        todayCalls: []
      };
    }

    const todayCalls = events.map(e => typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload);
    const totalCalls = todayCalls.length;
    const connects = todayCalls.filter(c => ['SALE', 'WALKTHROUGH', 'SEND_QUOTE', 'CALLBACK', 'CONVO'].includes(c.outcome_type)).length;
    const walkthroughs = todayCalls.filter(c => c.outcome_type === 'WALKTHROUGH').length;
    const callbacks = todayCalls.filter(c => c.outcome_type === 'CALLBACK').length;
    const sales = todayCalls.filter(c => c.outcome_type === 'SALE').length;
    
    let revenue = 0;
    todayCalls.forEach(c => {
      if (c.outcome_type === 'SALE' && c.sale_details?.job_total) {
        revenue += parseFloat(String(c.sale_details.job_total).replace(/[^0-9.]/g, '')) || 0;
      }
    });

    const closeRate = connects > 0 ? ((sales / connects) * 100).toFixed(1) : '0.0';

    return {
      totalCalls,
      connects,
      walkthroughs,
      callbacks,
      sales,
      closeRate,
      revenue,
      todayCalls
    };
  } catch (err) {
    return {
      totalCalls: 0,
      connects: 0,
      walkthroughs: 0,
      callbacks: 0,
      sales: 0,
      closeRate: '0.0',
      revenue: 0,
      todayCalls: []
    };
  }
}
