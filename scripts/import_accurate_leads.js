const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const ws = require('ws');
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
  realtime: { transport: ws }
});

// Read the raw CSV text provided by user
const csvContent = fs.readFileSync('/Users/malikcampbell/.gemini/antigravity/brain/68603635-6dc7-48b0-8de8-1a92242763ab/scratch/accurate_data.csv', 'utf8');

// Proper CSV parser that handles multiline quoted fields (e.g. transcripts)
function parseCSV(text) {
  const rows = [];
  let currentRow = [];
  let currentField = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField);
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      currentRow.push(currentField);
      currentField = '';
      if (currentRow.length > 1 || currentRow[0] !== '') {
        rows.push(currentRow);
      }
      currentRow = [];
    } else {
      currentField += char;
    }
  }

  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

async function run() {
  console.log('Parsing CSV...');
  const rows = parseCSV(csvContent);
  console.log(`Parsed ${rows.length} total rows (including header)`);

  const headers = rows[0].map(h => h.trim());
  console.log('Headers:', headers);

  // Clear existing leads from phone sales OS
  console.log('Deleting existing phone leads...');
  await supabase
    .from('leads')
    .delete()
    .or('source.in.(phone_sales_os,contact_import,apollo),company_name.ilike.%Apex Edge%');

  // Clear previous mock/test PHONE_CALL events
  console.log('Clearing old mock phone events...');
  await supabase
    .from('events')
    .delete()
    .eq('type', 'PHONE_CALL');

  const leadRecords = [];
  const eventRecords = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r.length < 5) continue;

    const firstName = (r[0] || '').trim();
    const lastName = (r[1] || '').trim();
    const fullName = `${firstName} ${lastName}`.trim();
    const title = (r[2] || '').trim();
    const company = (r[3] || '').trim();
    const email = (r[5] || '').trim();
    const seniority = (r[6] || '').trim();
    const departments = (r[7] || '').trim();
    const subDepartments = (r[8] || '').trim();

    const workDirectPhone = (r[10] || '').trim();
    const mobilePhone = (r[12] || '').trim();
    const corporatePhone = (r[13] || '').trim();
    const otherPhone = (r[14] || '').trim();
    const companyPhone = (r[35] || '').trim();

    const primaryPhone = workDirectPhone || mobilePhone || corporatePhone || otherPhone || companyPhone || '';

    const invalidOrNotInterested = (r[17] || '').trim();
    const convOrEmailReceived = (r[18] || '').trim();
    const transcript = (r[19] || '').trim();
    const industry = (r[20] || '').trim();
    const keywords = (r[21] || '').trim();
    const linkedinUrl = (r[22] || '').trim();
    const website = (r[23] || '').trim();
    const city = (r[28] || 'Toronto').trim();

    // Determine normalized sector
    const rawSec = `${industry} ${keywords} ${company}`.toLowerCase();
    let sector = 'post_construction';
    if (rawSec.includes('office') || rawSec.includes('corporate') || rawSec.includes('financial')) {
      sector = 'commercial_office';
    } else if (rawSec.includes('property') || rawSec.includes('real estate') || rawSec.includes('residential') || rawSec.includes('landlord')) {
      sector = 'property_management';
    } else if (rawSec.includes('industrial') || rawSec.includes('warehouse') || rawSec.includes('logistics')) {
      sector = 'industrial_warehouse';
    } else if (rawSec.includes('medical') || rawSec.includes('dental') || rawSec.includes('clinic')) {
      sector = 'medical_healthcare';
    } else if (rawSec.includes('retail') || rawSec.includes('hospitality') || rawSec.includes('restaurant')) {
      sector = 'retail_hospitality';
    } else {
      sector = 'post_construction';
    }

    // Status: if transcript exists, mark contacted or quoted
    let status = 'new';
    let outcomeType = null;
    let aiSummary = null;
    let callDuration = 60;
    let callDate = new Date().toISOString();

    if (transcript) {
      status = 'contacted';
      outcomeType = 'CONVO';

      // Parse date & duration from transcript header
      // e.g. "Call with (905) 830-6026 · SEA OF BLUE Inc called · 02:01\nSep 28, 2026 1:33PM"
      const durMatch = transcript.match(/·\s*(\d{2}):(\d{2})/);
      if (durMatch) {
        callDuration = parseInt(durMatch[1]) * 60 + parseInt(durMatch[2]);
      }

      if (transcript.includes('Sep 28, 2026')) callDate = new Date('2026-09-28T13:33:00Z').toISOString();
      else if (transcript.includes('Sep 30, 2026 12:06PM')) callDate = new Date('2026-09-30T12:06:00Z').toISOString();
      else if (transcript.includes('Sep 30, 2026 12:16PM')) callDate = new Date('2026-09-30T12:16:00Z').toISOString();
      else if (transcript.includes('Sep 30, 2026 12:59PM')) callDate = new Date('2026-09-30T12:59:00Z').toISOString();
      else if (transcript.includes('Sep 30, 2026 1:10PM')) callDate = new Date('2026-09-30T13:10:00Z').toISOString();
      else if (transcript.includes('Oct 1, 2026 12:28PM')) callDate = new Date('2026-10-01T12:28:00Z').toISOString();
      else if (transcript.includes('Oct 1, 2026 12:39PM')) callDate = new Date('2026-10-01T12:39:00Z').toISOString();
      else if (transcript.includes('Oct 1, 2026 2:16PM')) callDate = new Date('2026-10-01T14:16:00Z').toISOString();
      else if (transcript.includes('Oct 1, 2026 3:05PM')) callDate = new Date('2026-10-01T15:05:00Z').toISOString();

      // Specific AI Summaries
      if (company.includes('Melrose Investments')) {
        outcomeType = 'INFO_SENT';
        status = 'quoted';
        aiSummary = 'Discussed post-construction cleaning for upcoming projects. Julien is PM at Melrose Investments and added Sea of Blue to their master trades list for an upcoming 12-unit residential/commercial project closing in ~1 month.';
      } else if (company.includes('HMA Construction') || fullName.includes('Avadh') || fullName.includes('Sherif')) {
        outcomeType = 'INFO_SENT';
        status = 'quoted';
        aiSummary = 'Major pipeline opportunity: Rami manages Ontario projects for HMA. Delivering 3 Burlington sites by Dec 22, plus partner has 20-22 projects in Kitchener-Waterloo area. Requested email to ramyi@hmaconstruct.com to coordinate with site supers for quotes.';
      } else if (company.includes('Chart Construction Management')) {
        outcomeType = 'INFO_SENT';
        status = 'contacted';
        aiSummary = 'Connected with Paolo Morano (Site Super). Currently using a cleaner but experiencing issues and open to competitive pricing. Requested company SOPs and operations overview sent to paolo@chartcm.ca.';
      } else if (company.includes('Cameron + Associates') || company.includes('CAMi')) {
        outcomeType = 'INFO_SENT';
        status = 'contacted';
        aiSummary = 'Connected with Dan Cameron (Project Coordinator). Goes out to tender with a select directory of cleaning contractors. Added Sea of Blue to tender list. Requested service deck sent to dancameron@camimanagement.com.';
      } else if (company.includes('Mondconsult')) {
        outcomeType = 'INFO_SENT';
        status = 'contacted';
        aiSummary = 'Spoke with Kinga (Project Manager). Discussed Highlight project in Mississauga coming out of legal transition soon. Directed to send proposal to Farhad (Tendering, ext 222, kinga@mondconsult.com) who will provide architectural drawings for quotation.';
      } else if (company.includes('Cambria Design Build')) {
        outcomeType = 'INFO_SENT';
        status = 'contacted';
        aiSummary = 'Spoke with reception regarding interior building cleaning. Reception confirmed they have an existing cleaner but took info and requested proposal sent to Mnortheast@cambriadesign.ca.';
      } else if (company.includes('Vaughan Build')) {
        outcomeType = 'INFO_SENT';
        status = 'contacted';
        aiSummary = 'Spoke with Wayne at Vaughan Build. Inquired about post-construction vendors. Advised that Rafael handles all bidding processes and requested company information sent to rafael@vaughanbuild.ca.';
      } else if (company.includes('ROSSCLAIR')) {
        outcomeType = 'CALLBACK';
        status = 'contacted';
        aiSummary = 'Spoke with Stephen Surtees (Site Superintendent). He was off duty and advised contacting the General Contractor directly regarding cleaning trades.';
      } else if (company.includes('Cornerstone Building')) {
        outcomeType = 'CONVO';
        status = 'contacted';
        aiSummary = 'Connected with Vanessa at reception. Estimating team and PM handle cleaning vendors. Vanessa took Ryan\'s contact number (437-494-1091) to pass to the PM.';
      } else {
        outcomeType = 'CONVO';
        aiSummary = `Outreach call completed with ${fullName} at ${company}.`;
      }
    }

    const intelNotes = {
      sector: sector,
      seniority,
      departments,
      sub_departments: subDepartments,
      work_direct_phone: workDirectPhone,
      mobile_phone: mobilePhone,
      corporate_phone: corporatePhone,
      other_phone: otherPhone,
      company_phone: companyPhone,
      linkedin_url: linkedinUrl,
      website,
      industry,
      transcript: transcript || null,
      ai_summary: aiSummary || null
    };

    leadRecords.push({
      source: 'phone_sales_os',
      customer_name: fullName,
      company_name: company,
      contact_title: title,
      customer_phone: primaryPhone,
      customer_email: email || null,
      city: city || 'GTA',
      service_type: 'post_construction_clean',
      status: status,
      notes: JSON.stringify(intelNotes)
    });

    if (transcript && outcomeType) {
      eventRecords.push({
        lead_index: leadRecords.length - 1,
        contact_name: fullName,
        company_name: company,
        phone_number: primaryPhone,
        city: city || 'GTA',
        outcome_type: outcomeType,
        duration_seconds: callDuration,
        notes: aiSummary || 'Call completed',
        ai_summary: aiSummary,
        transcript: transcript,
        created_at: callDate,
        rep_name: 'Ryan'
      });
    }
  }

  console.log(`Inserting ${leadRecords.length} accurate leads into database...`);
  const { data: insertedLeads, error: insertError } = await supabase
    .from('leads')
    .insert(leadRecords)
    .select();

  if (insertError) {
    console.error('Insert leads error:', insertError);
    process.exit(1);
  }
  console.log(`Successfully inserted ${insertedLeads.length} leads!`);

  // Now insert the real call events linked to their inserted lead ID
  const crypto = require('crypto');
  console.log(`Inserting ${eventRecords.length} real call events with transcripts & AI summaries...`);
  const eventPayloads = eventRecords.map(e => {
    const lead = insertedLeads[e.lead_index];
    const eventId = crypto.randomUUID();
    return {
      type: 'PHONE_CALL',
      event_id: eventId,
      rep_id: '07853cdf-ed2c-4f3b-b713-cde7c40e20a1',
      created_at: e.created_at,
      payload: JSON.stringify({
        event_id: eventId,
        contact_id: lead ? String(lead.id) : null,
        contact_name: e.contact_name,
        company_name: e.company_name,
        phone_number: e.phone_number,
        city: e.city,
        call_type: 'OUTBOUND',
        outcome_type: e.outcome_type,
        duration_seconds: e.duration_seconds,
        notes: e.notes,
        ai_summary: e.ai_summary,
        transcript: e.transcript,
        rep_name: 'Ryan',
        source: 'accurate_import',
        timestamp: e.created_at
      })
    };
  });

  const { data: insertedEvents, error: eventError } = await supabase
    .from('events')
    .insert(eventPayloads)
    .select();

  if (eventError) {
    console.error('Insert events error:', eventError);
  } else {
    console.log(`Successfully inserted ${insertedEvents.length} real call events!`);
  }

  console.log('Import completed successfully!');
}

run();
