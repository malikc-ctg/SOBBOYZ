import { supabase } from './supabase';
import { sqlocal, insertLocalEvent, getPendingEvents, markEventSynced } from './db';

/**
 * B2B COMMERCIAL PHONE SALES SERVICE
 * Powers inside tele-sales for commercial accounts, property managers,
 * click-to-call dialer, disposition logging, and B2B battle-cards.
 */

export const CALL_OUTCOMES = [
  { key: 'SALE', label: 'Commercial Contract Won', color: '#10b981', icon: '🏆', description: 'Agreed on commercial cleaning contract & monthly terms' },
  { key: 'CALLBACK', label: 'Callback Scheduled', color: '#8b5cf6', icon: '📅', description: 'Scheduled follow-up with decision maker' },
  { key: 'WALKTHROUGH', label: 'Site Walkthrough Booked', color: '#3b82f6', icon: '🚶‍♂️', description: 'Booked in-person plaza or facility site visit' },
  { key: 'CONVO', label: 'Qualified Interest', color: '#06b6d4', icon: '🗣️', description: 'Spoke with DM, reviewing commercial proposal' },
  { key: 'GATEKEEPER', label: 'Gatekeeper / Leave Info', color: '#f59e0b', icon: '🚪', description: 'Receptionist / sent info to property manager' },
  { key: 'NO_ANSWER', label: 'No Answer / Ringing', color: '#6b7280', icon: '📵', description: 'Rang out, no answer' },
  { key: 'VOICEMAIL', label: 'Left Voicemail', color: '#a855f7', icon: '📼', description: 'Left commercial pitch voicemail' },
  { key: 'NOT_INTERESTED', label: 'Not Interested', color: '#ef4444', icon: '⛔', description: 'Declined commercial service' },
  { key: 'BAD_NUMBER', label: 'Bad Number', color: '#9ca3af', icon: '❌', description: 'Wrong number or disconnected' },
];

export const OBJECTION_REBUTTALS = [
  {
    title: 'Already Have a Cleaning Company',
    trigger: '"We already have a company that handles our cleaning"',
    rebuttal: 'Totally understand! Most commercial janitorial services only handle interior sweeping, trash emptying, and restrooms. Our commercial trucks bring mobile 200°F steam units specifically for exterior dumpster corrals, concrete gum removal, and grease traps that regular cleaners aren\'t equipped for. Who is your property or facilities manager? Let me send a 1-page spec sheet so you have a specialized backup.',
  },
  {
    title: 'Speaking to Gatekeeper / Receptionist',
    trigger: '"I\'m just the front desk / receptionist, they aren\'t in"',
    rebuttal: 'I completely understand! We service several commercial plazas nearby for exterior health code sanitization. What is the direct email or extension for whoever oversees exterior grounds maintenance and property management so I can send our 1-page compliance rate card?',
  },
  {
    title: 'Too Expensive / Budget Frozen',
    trigger: '"We don\'t have budget for exterior washing right now"',
    rebuttal: 'Completely hear you on watching operating expenses. For commercial plazas, routine monthly dumpster steam cleaning actually prevents city health inspector fines and tenant pest complaints that cost thousands more. Our monthly commercial routes start at a flat rate. Why not let us do a 5-minute site check this Wednesday to give you exact numbers for when budgets open up?',
  },
  {
    title: 'Send Me An Email First',
    trigger: '"Just send an email with your pricing"',
    rebuttal: 'I\'ll send that right over today. Just so I don\'t send a generic 10-page packet, does your building primarily need rear dumpster pad sanitization, or are you also looking to have the front storefront sidewalks and entranceways steam-washed?',
  },
  {
    title: 'Tenants Are Responsible',
    trigger: '"The individual retail tenants handle their own trash"',
    rebuttal: 'That\'s very common! What we find with most multi-tenant plazas is that grease and organic waste still spill into the shared concrete enclosure, creating odor and pest issues that reflect poorly on the entire property. We partner directly with property managers to maintain the shared corral on a set monthly schedule. Would a quick site quote work for you this Thursday?',
  }
];

export const CALL_SCRIPTS = {
  COMMERCIAL_B2B: {
    title: 'Property Manager Dumpster Pad & Health Code',
    opener: 'Good morning, my name is [RepName] with Sea of Blue Commercial Facilities. I\'m calling regarding exterior dumpster corral sanitization and health code compliance for [Company] in [City].',
    discovery: 'Quick question: with the warmer weather, are grease build-up and organic odor around the waste disposal area becoming an issue for tenants or visitors?',
    close: 'We have our 200°F mobile steam truck servicing commercial plazas in [City] this week. I can stop by for 5 minutes Wednesday to do a complimentary site assessment and leave a 1-page flat proposal. Would 11 AM or 2 PM work better for you?'
  },
  RETAIL_STOREFRONT: {
    title: 'Plaza & Retail Storefront Walkway Wash',
    opener: 'Hi [Name], [RepName] here with Sea of Blue Commercial Wash in [City]. I\'m reaching out about the exterior front walkways and customer entrance at [Company].',
    discovery: 'Are you guys looking to have gum, oil spots, and high-traffic grime deep cleaned off your storefront entrance before the weekend rush?',
    close: 'We do early morning or after-hours steam cleaning so there\'s zero interruption to customer foot traffic. If we add your plaza to Thursday\'s run, your monthly rate is only $[Price]. Can I drop off the site spec sheet tomorrow?'
  },
  FACILITY_DIRECTOR: {
    title: 'Commercial Facility Director / Industrial',
    opener: 'Good morning [Name], this is [RepName] with Sea of Blue Industrial & Commercial Washing. I oversee exterior sanitization routes across [City].',
    discovery: 'Who currently handles your exterior waste area pressure washing and concrete oil stain mitigation?',
    close: 'We capture all grease and contaminated runoff in compliance with municipal environmental by-laws. I\'d love to stop by for a quick 5-minute site assessment this week. Does morning or afternoon work better?'
  }
};

/**
 * Fetch B2B contacts queue from API (with fallback)
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
 * Update B2B lead status in Sea of Blue database
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
  objectionType = null,
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
    objection_type: objectionType,
    sale_details: saleDetails,
    rep_id: repId,
    rep_name: repName,
    timestamp: timestamp,
  };

  // 1. Save locally in SQLocal for instant response & offline resilience
  try {
    await insertLocalEvent(eventId, 'PHONE_CALL', payload);
  } catch (err) {
    console.warn('[PhoneService] Local SQLite write failed, proceeding:', err);
  }

  // 2. Sync to Supabase events table
  try {
    const { error } = await supabase.from('events').insert({
      id: eventId,
      type: 'PHONE_CALL',
      rep_id: repId,
      payload: JSON.stringify(payload),
      created_at: timestamp
    });

    if (!error) {
      await markEventSynced(eventId);
    }
  } catch (err) {
    console.warn('[PhoneService] Cloud sync failed, will sync via engine:', err);
  }

  // 3. Update lead status in CRM table
  if (contactId) {
    await updateLeadStatus(contactId, outcomeType.toLowerCase(), notes, callbackTime);
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
        callbacks: 0,
        sales: 0,
        closeRate: '0.0',
        revenue: 0,
        todayCalls: []
      };
    }

    const todayCalls = events.map(e => typeof e.payload === 'string' ? JSON.parse(e.payload) : e.payload);
    const totalCalls = todayCalls.length;
    const connects = todayCalls.filter(c => ['SALE', 'CALLBACK', 'WALKTHROUGH', 'CONVO'].includes(c.outcome_type)).length;
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
      callbacks: 0,
      sales: 0,
      closeRate: '0.0',
      revenue: 0,
      todayCalls: []
    };
  }
}
