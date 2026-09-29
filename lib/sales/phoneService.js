import { supabase } from './supabase';
import { sqlocal, insertLocalEvent, getPendingEvents, markEventSynced } from './db';

/**
 * PHONE SALES SERVICE
 * Powers the tele-sales engine: lead queues, click-to-call, disposition logging,
 * offline event sourcing, and script battle-cards.
 */

export const CALL_OUTCOMES = [
  { key: 'SALE', label: 'Sale Closed', color: '#10b981', icon: '🏆', description: 'Booked service & agreed on price' },
  { key: 'CALLBACK', label: 'Callback Set', color: '#8b5cf6', icon: '📅', description: 'Scheduled follow-up date/time' },
  { key: 'CONVO', label: 'Good Convo', color: '#3b82f6', icon: '🗣️', description: 'Qualified interest / reviewing quote' },
  { key: 'NO_ANSWER', label: 'No Answer / Ring', color: '#6b7280', icon: '📵', description: 'Rang out, no answer' },
  { key: 'VOICEMAIL', label: 'Left Voicemail', color: '#f59e0b', icon: '📼', description: 'Left promotional VM' },
  { key: 'NOT_INTERESTED', label: 'Not Interested', color: '#ef4444', icon: '⛔', description: 'Declined service / competitor' },
  { key: 'BAD_NUMBER', label: 'Bad Number', color: '#9ca3af', icon: '❌', description: 'Wrong number or disconnected' },
];

export const OBJECTION_REBUTTALS = [
  {
    title: 'Too Expensive',
    trigger: '"That price is too high / I was expecting less"',
    rebuttal: 'I completely hear you. Most homeowners think that until they see what our trucks actually do. We use 200°F steaming water at high pressure with hospital-grade disinfectant — which kills 99.9% of bacteria, maggots, and odors that a regular garden hose literally cannot touch. If I can do your second bin today for half off, would Thursday morning work?',
  },
  {
    title: 'Can Do It Myself (DIY)',
    trigger: '"I can just hose it down myself"',
    rebuttal: 'Totally understand! The tricky thing is that cold hose water actually spreads E. coli and salmonella around your driveway, and grease sticks to plastic pores. We capture and filter all the contaminated runoff so none of that bacteria sits on your driveway or runs into city storm drains. For just under a dollar a day on the seasonal route, we handle the nastiest chore for you. Why not try the single clean first?',
  },
  {
    title: 'Send Me An Email',
    trigger: '"Can you just email me the information?"',
    rebuttal: 'I can definitely email that over right away. Just so I don\'t send you a generic catalog with 10 pages, are you mainly looking to sanitize the smelly compost/garbage bins, or did you also want a quick estimate for front walkway or siding wash while our crew is on your street?',
  },
  {
    title: 'Already Have Someone',
    trigger: '"We already have a company doing our cleaning"',
    rebuttal: 'Awesome, good to know you value keeping the property sanitized! Who are you currently using? Many of our clients switched over because our trucks do full 360-degree high-heat steam and we guarantee zero odor residue. What day do they usually come by? Let me send you our rate sheet so you have a backup if they ever miss a week.',
  },
  {
    title: 'Need To Talk To Spouse',
    trigger: '"I need to check with my husband / wife first"',
    rebuttal: 'Totally fair — I wouldn\'t want to surprise them either! Let\'s do this: I\'ll tentatively save a spot on Thursday\'s route so you get the $20 neighborhood discount. I\'ll shoot you a text confirmation now, and if they say no, just reply "Cancel" and we take you off. Fair enough?',
  }
];

export const CALL_SCRIPTS = {
  RESIDENTIAL_INBOUND: {
    title: 'Residential Inbound / Web Quote Follow-up',
    opener: 'Hi [Name], this is [RepName] with Sea of Blue exterior & bin cleaning! I saw you requested an instant quote for your home in [City]. I have your property pulled up right now — wanted to make sure you got the promo pricing before our route fills up this week!',
    discovery: 'Are you looking to get the garbage and green bins fresh and sanitized, or were you also wanting the front steps / walkway pressure-washed?',
    close: 'We actually have our wash unit in [City] on Thursday. If we add you to that neighborhood run, your total is only $[Price]. Can I lock in your morning slot?'
  },
  PAST_CUSTOMER_WINBACK: {
    title: 'Past Customer Seasonal Renewal',
    opener: 'Hey [Name], [RepName] here from Sea of Blue! You used us previously for cleaning at [City]. Summer heat is kicking in and we\'re re-opening routes for our preferred clients on your street.',
    discovery: 'Wanted to check in — how have your bins been holding up with the warm weather? Any fly or odor issues lately?',
    close: 'Because you\'re a returning VIP client, we have your renewal locked at just $[Price] for the full sanitizing deep clean. Does this week work for your bins?'
  },
  COMMERCIAL_B2B: {
    title: 'Commercial Facility / Office Manager',
    opener: 'Good morning, my name is [RepName] with Sea of Blue Commercial Facilities. I\'m calling regarding commercial waste area sanitization and exterior property washing for [Company] in [City].',
    discovery: 'Quick question — who currently oversees your exterior grounds maintenance and dumpster pad sanitation for health code compliance?',
    close: 'We do routine monthly steam washing for several corporate and medical plazas nearby. I can stop by for 5 minutes this Wednesday to do a complimentary site assessment and leave a 1-page custom proposal. Would 11 AM or 2 PM work better?'
  }
};

/**
 * Fetch contacts queue from API (with fallback)
 */
export async function fetchSalesContacts(filter = 'all') {
  try {
    const res = await fetch(`/api/sales/leads?filter=${filter}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.contacts || [];
  } catch (err) {
    console.warn('[PhoneService] API fetch failed, falling back to local cached leads:', err);
    return [];
  }
}

/**
 * Update lead status in Sea of Blue database
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
    console.error('[PhoneService] Failed to update lead status:', e);
    return null;
  }
}

/**
 * Create a new lead from the phone dialer
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
    console.error('[PhoneService] Failed to create new phone lead:', e);
    return null;
  }
}

/**
 * Log a phone call event
 * Writes locally to IndexedDB event sourcing and pushes to Supabase events table.
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
  objectionType = null,
  saleDetails = null,
  repId = '07853cdf-ed2c-4f3b-b713-cde7c40e20a1',
  repName = 'Malik'
}) {
  const eventId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `call_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const timestamp = new Date().toISOString();

  const payload = {
    event_id: eventId,
    contact_id: contactId,
    contact_name: contactName,
    phone_number: phoneNumber,
    city: city || 'Toronto',
    call_type: callType,
    outcome_type: outcomeType,
    duration_seconds: durationSeconds,
    notes: notes,
    callback_time: callbackTime,
    objection_type: objectionType,
    sale_details: saleDetails,
    rep_id: repId,
    rep_name: repName,
    timestamp: timestamp,
  };

  // 1. Write to local event sourcing (IndexedDB)
  await insertLocalEvent(eventId, 'CALL', payload, timestamp);

  // 2. If it is a sale, also update the remote lead status
  if (outcomeType === 'SALE' && contactId) {
    updateLeadStatus(contactId, 'converted', `Won via Phone Sales OS: $${saleDetails?.job_total || 0}`);
  } else if (outcomeType === 'CALLBACK' && contactId) {
    updateLeadStatus(contactId, 'callback', `Callback set: ${callbackTime} - ${notes}`, callbackTime);
  }

  // 3. Push to Supabase events in background
  try {
    await supabase.from('events').upsert({
      event_id: eventId,
      rep_id: repId,
      type: 'CALL',
      payload: payload,
      created_at: timestamp
    }, { onConflict: 'event_id' });
  } catch (err) {
    console.warn('[PhoneService] Remote push deferred to syncEngine:', err);
  }

  // 4. Notify app listeners
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sync-local-events'));
  }

  return payload;
}

/**
 * Fetch local call history from IndexedDB
 */
export async function getLocalCallHistory() {
  try {
    const rs = await sqlocal.sql`SELECT * FROM events WHERE type = 'CALL' ORDER BY created_at DESC`;
    return rs.map(r => {
      const p = typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload;
      return {
        id: r.event_id,
        ...p,
        created_at: r.created_at,
        synced: r.synced === 1
      };
    });
  } catch (e) {
    console.error('[PhoneService] getLocalCallHistory error:', e);
    return [];
  }
}

/**
 * Compute today's phone sales metrics
 */
export async function getTodayCallStats() {
  try {
    const calls = await getLocalCallHistory();
    const todayStr = new Date().toISOString().split('T')[0];

    const todayCalls = calls.filter(c => (c.timestamp || c.created_at || '').startsWith(todayStr));

    let totalCalls = todayCalls.length;
    let connects = 0;
    let callbacks = 0;
    let sales = 0;
    let revenue = 0;

    for (const c of todayCalls) {
      if (['SALE', 'CONVO', 'CALLBACK'].includes(c.outcome_type)) {
        connects++;
      }
      if (c.outcome_type === 'CALLBACK') {
        callbacks++;
      }
      if (c.outcome_type === 'SALE') {
        sales++;
        const price = c.sale_details?.job_total ? parseFloat(String(c.sale_details.job_total).replace(/[^0-9.]/g, '')) : 0;
        if (!isNaN(price)) revenue += price;
      }
    }

    const closeRate = totalCalls > 0 ? ((sales / totalCalls) * 100).toFixed(1) : '0.0';

    return {
      totalCalls,
      connects,
      callbacks,
      sales,
      closeRate,
      revenue,
      todayCalls
    };
  } catch (e) {
    return {
      totalCalls: 0,
      connects: 0,
      callbacks: 0,
      sales: 0,
      closeRate: '0.0',
      revenue: 0,
      todayCalls: []
    };
  }
}
