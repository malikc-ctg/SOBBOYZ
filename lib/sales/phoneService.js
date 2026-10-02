import { supabase } from './supabase';
import { sqlocal, insertLocalEvent, getPendingEvents, markEventSynced } from './db';

/**
 * B2B COMMERCIAL & POST-CONSTRUCTION PHONE SALES SERVICE
 * Powers inside tele-sales for construction companies, GCs, property managers,
 * click-to-call dialer, Apollo lead management, disposition logging, and B2B battle-cards.
 */

export const CALL_OUTCOMES = [
  { key: 'WALKTHROUGH', label: 'Site Walkthrough Booked', color: '#3b82f6', icon: '🚶‍♂️', description: 'Booked jobsite walkthrough or facility audit' },
  { key: 'SEND_QUOTE', label: 'Send Bid / Rate Card', color: '#06b6d4', icon: '✉️', description: 'Requested WSIB docs, scope spec sheet, and rate card' },
  { key: 'CALLBACK', label: 'Callback Scheduled', color: '#8b5cf6', icon: '📅', description: 'Scheduled follow-up with Project Manager / DM' },
  { key: 'GATEKEEPER', label: 'Gatekeeper / Found DM', color: '#f59e0b', icon: '🚪', description: 'Identified PM or DM name & direct extension' },
  { key: 'CONVO', label: 'Qualified Interest', color: '#10b981', icon: '🗣️', description: 'Spoke with DM, active build in pipeline' },
  { key: 'VOICEMAIL', label: 'Left Voicemail', color: '#a855f7', icon: '📼', description: 'Left 30-sec trade pitch voicemail' },
  { key: 'NO_ANSWER', label: 'No Answer / Ringing', color: '#6b7280', icon: '📵', description: 'Rang out, no answer' },
  { key: 'NOT_INTERESTED', label: 'Not Interested / Bad Fit', color: '#ef4444', icon: '⛔', description: 'Declined or no active builds' },
  { key: 'BAD_NUMBER', label: 'Bad Number', color: '#9ca3af', icon: '❌', description: 'Wrong number or disconnected' },
  { key: 'SALE', label: 'Contract / Job Won', color: '#10b981', icon: '🏆', description: 'Signed cleaning trade contract or PO issued' },
];

export const OBJECTION_REBUTTALS = [
  {
    title: 'Trades Clean Their Own Mess',
    vertical: 'post_construction',
    trigger: '"The framing and drywall trades clean their own mess"',
    rebuttal: 'The framing and drywall trades always do basic broom sweeps, but city building inspectors and client handover require HEPA fine-particulate extraction, window razor scraping, and sawdust wiping inside new millwork. That\'s where we come in as the final turnover trade so you pass occupancy on the first inspection.',
  },
  {
    title: 'Already Have a Cleaning Sub',
    vertical: 'post_construction',
    trigger: '"We already have a regular cleaner / trade we use"',
    rebuttal: 'Totally respect that! GCs usually keep 2 or 3 insured cleaning subs on file because when handover deadlines crunch or a sub doesn\'t show with enough crew, turnover gets delayed. Let me send our WSIB certificate and pricing so you have us in your pocket as an insured backup for your next turnover.',
  },
  {
    title: 'Send Me An Email First',
    vertical: 'general',
    trigger: '"Just send an email with your pricing and company profile"',
    rebuttal: 'I\'ll send that right over today! What\'s the best direct email for your Project Manager? Just so I don\'t send generic spam, is your upcoming project commercial retail, condo turnover, or office fit-out?',
  },
  {
    title: 'Not Building Right Now',
    vertical: 'post_construction',
    trigger: '"We don\'t have any active projects wrapping up right now"',
    rebuttal: 'Understood! When does your next project break ground or approach turnover? Let\'s get our WSIB clearance and compliance docs approved with your procurement team now so we\'re ready to bid when tenders open.',
  },
  {
    title: 'Already Have Janitorial (Interior)',
    vertical: 'commercial',
    trigger: '"We already have a company that handles our cleaning"',
    rebuttal: 'Totally understand! Most commercial janitorial services only handle light interior sweeping, trash, and restrooms. Our commercial teams bring mobile 200°F steam units for dumpster corrals, concrete gum removal, and VCT strip-and-wax that regular cleaners aren\'t equipped for. Who oversees your facility maintenance so I can send our 1-page backup spec sheet?',
  },
  {
    title: 'Speaking to Gatekeeper / Receptionist',
    vertical: 'general',
    trigger: '"I\'m just the front desk / receptionist, they aren\'t in"',
    rebuttal: 'I completely understand! We service several commercial job sites and facilities nearby. Who is the Project Manager or Site Superintendent in charge of site turnover and subcontracts so I can send our trade compliance package?',
  },
  {
    title: 'Too Expensive / Budget Frozen',
    vertical: 'commercial',
    trigger: '"We don\'t have budget for exterior or specialized washing"',
    rebuttal: 'Completely hear you on watching operating expenses. For commercial properties, routine maintenance prevents city health inspector fines and tenant pest complaints that cost thousands more. Our monthly commercial routes start at a flat rate. Why not let us do a 5-minute site assessment this week to benchmark your current numbers?',
  },
];

export const CALL_SCRIPTS = {
  POST_CONSTRUCTION_GC: {
    title: '🔨 GC Project Manager (Post-Construction Clean)',
    vertical: 'post_construction',
    opener: 'Good morning [Name], this is [RepName] with Sea of Blue Commercial & Post-Construction in Toronto. I\'m reaching out regarding your active job sites and trade turnover cleaning.',
    discovery: 'Who currently handles your 3-phase rough and final inspection cleans, window paint/sticker razor scraping, and punch-list dust extraction before client turnover?',
    value: 'We carry $5M commercial liability, active WSIB clearance, and our crews come equipped with commercial HEPA dust extractors so you pass city occupancy inspection on the first walkthrough.',
    close: 'Are you wrapping up any commercial, retail, or multi-residential build-outs in the next 30 to 60 days that we can quote or walk?'
  },
  SUPERINTENDENT_ON_SITE: {
    title: '🏗️ Site Superintendent (Active Build Turnover)',
    vertical: 'post_construction',
    opener: 'Hey [Name], [RepName] here with Sea of Blue Post-Construction. Calling you directly from the GTA trade network.',
    discovery: 'Are you guys in the drywall/finish stage on your current site, or already approaching the final turnover clean?',
    value: 'We specialize in quick-turnaround final punch cleans—HEPA drywall dust extraction, window sticker scraping, and millwork wipe down.',
    close: 'I can drop by the trailer or job site for 10 minutes Thursday to look over the floor plan and leave our trade spec sheet. What\'s the site address?'
  },
  GATEKEEPER_GC: {
    title: '🚪 GC Front Desk (Finding the PM / Estimator)',
    vertical: 'gatekeeper',
    opener: 'Hi good morning! I was hoping you could help point me in the right direction — who at your office oversees subcontracts for post-construction trade cleaning and turnover?',
    discovery: 'We\'re updating our WSIB clearance and trade partner files for GTA commercial builders.',
    close: 'Can you give me their direct extension or email so I can send our WSIB clearance certificate and post-construction rate card?'
  },
  COMMERCIAL_B2B: {
    title: '🏢 Property Manager Dumpster Pad & Health Code',
    vertical: 'commercial',
    opener: 'Good morning, my name is [RepName] with Sea of Blue Commercial Facilities. I\'m calling regarding exterior dumpster corral sanitization and health code compliance for [Company] in [City].',
    discovery: 'Quick question: with the warmer weather, are grease build-up and organic odor around the waste disposal area becoming an issue for tenants or visitors?',
    close: 'We have our 200°F mobile steam truck servicing commercial plazas in [City] this week. I can stop by for 5 minutes Wednesday to do a complimentary site assessment and leave a 1-page flat proposal. Would 11 AM or 2 PM work better for you?'
  },
  FACILITY_DIRECTOR: {
    title: '🏭 Facility Director / Night Janitorial',
    vertical: 'commercial',
    opener: 'Good morning [Name], this is [RepName] with Sea of Blue Commercial Facilities. I oversee nighttime janitorial and floor care routes across [City].',
    discovery: 'Who currently oversees your nightly cleaning and VCT floor care maintenance?',
    close: 'We provide bonded, HEPA-equipped crews with automated digital shift logs. I\'d love to stop by for a quick 10-minute site audit this week. Does morning or afternoon work better?'
  },
};

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
 * Live In-Call Quick Enrichment: update any field on lead
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
 * Batch Import Apollo.io Leads
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
    console.error('[PhoneService] Batch import Apollo leads failed:', e);
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

  // 1. Save locally in SQLocal
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
    let dbStatus = outcomeType.toLowerCase();
    if (outcomeType === 'WALKTHROUGH') dbStatus = 'walkthrough_booked';
    if (outcomeType === 'SEND_QUOTE') dbStatus = 'quoted';
    if (outcomeType === 'CALLBACK') dbStatus = 'contacted';
    if (outcomeType === 'SALE') dbStatus = 'won';
    if (outcomeType === 'NOT_INTERESTED') dbStatus = 'lost';
    
    await updateLeadStatus(contactId, dbStatus, notes, callbackTime);
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
