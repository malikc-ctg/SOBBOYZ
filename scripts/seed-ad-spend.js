global.WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const weeklyLogs = [
  { week_start_date: "2026-08-25", week_end_date: "2026-08-31", channel: "lsa", amount: 790.47, conversions: 23, notes: "Google LSA Activity (23 leads). 2026-08-31: Google Ads Promotion Credit (CA$-224.86)" },
  { week_start_date: "2026-08-18", week_end_date: "2026-08-24", channel: "lsa", amount: 501.00, conversions: 11, notes: "Google LSA Activity (11 leads)" },
  { week_start_date: "2026-08-11", week_end_date: "2026-08-17", channel: "lsa", amount: 220.41, conversions: 5, notes: "Google LSA Activity (5 leads)" },
  { week_start_date: "2026-08-04", week_end_date: "2026-08-10", channel: "lsa", amount: 444.00, conversions: 11, notes: "Google LSA Activity (11 leads)" },
  { week_start_date: "2026-07-28", week_end_date: "2026-08-03", channel: "lsa", amount: 342.25, conversions: 18, notes: "Google LSA Activity (18 leads). 2026-07-31: Google Ads Promotion Credit (CA$-375.14)" },
  { week_start_date: "2026-07-21", week_end_date: "2026-07-27", channel: "lsa", amount: 679.27, conversions: 31, notes: "Google LSA Activity (31 leads)" },
  { week_start_date: "2026-07-14", week_end_date: "2026-07-20", channel: "lsa", amount: 750.10, conversions: 35, notes: "Google LSA Activity (35 leads)" },
  { week_start_date: "2026-07-07", week_end_date: "2026-07-13", channel: "lsa", amount: 866.21, conversions: 35, notes: "Google LSA Activity (35 leads)" },
  { week_start_date: "2026-06-30", week_end_date: "2026-07-06", channel: "lsa", amount: 373.44, conversions: 21, notes: "Google LSA Activity (21 leads)" },
  { week_start_date: "2026-06-23", week_end_date: "2026-06-29", channel: "lsa", amount: 402.45, conversions: 19, notes: "Google LSA Activity (19 leads)" },
  { week_start_date: "2026-06-16", week_end_date: "2026-06-22", channel: "lsa", amount: 272.15, conversions: 9, notes: "Google LSA Activity (9 leads)" }
];

async function seed() {
  console.log("Checking ad_spend_logs table in Supabase...");
  
  const { data, error } = await supabase
    .from('ad_spend_logs')
    .upsert(weeklyLogs);

  if (error) {
    console.error("Database query result:", error.message || error);
  } else {
    console.log("Successfully seeded ad_spend_logs records!", data);
  }
}

seed();
