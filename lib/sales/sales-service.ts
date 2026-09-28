import { createClient } from '@/lib/supabase/client';

export interface RepLeaderboardRow {
  rep_id: string;
  rep_name: string;
  doors: number;
  convos: number;
  walkthroughs_booked: number;
  sales: number;
  mrr: number;
  revenue: number;
  close_rate: string;
  dph: string | null;
  commission: number;
}

export interface RadarItem {
  rep_id: string;
  rep_name: string;
  status: string;
  street_name: string;
  mode: 'residential' | 'commercial';
  company_name?: string;
  timestamp: string;
}

export interface CommercialOpportunity {
  id: string;
  created_by_rep_id: string;
  company_name: string;
  facility_type?: string;
  address: string;
  unit_number?: string;
  dm_name?: string;
  dm_title?: string;
  dm_phone?: string;
  dm_email?: string;
  gatekeeper_name?: string;
  stage: 'knocked' | 'walkthrough_scheduled' | 'proposal_sent' | 'negotiation' | 'won' | 'lost';
  walkthrough_date?: string;
  expected_mrr?: number;
  one_time_value?: number;
  cleaning_frequency?: string;
  square_footage?: number;
  competitor_vendor?: string;
  competitor_contract_expires_at?: string;
  lost_reason?: string;
  updated_at: string;
}

export function calculateCommission(amount: number | string, isCommercial = false): number {
  if (!amount) return 0;
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/[^0-9.]/g, ''));
  if (isNaN(num) || num <= 0) return 0;

  if (isCommercial) {
    // Commercial rule: 50% of Month 1 MRR or 20% of one-time project
    return num * 0.50;
  }

  // Residential rule: Tiered commission
  let pct = 0.25;
  if (num > 400) pct = 0.40;
  else if (num >= 349) pct = 0.30;

  return num * pct;
}

/**
 * Fetch Leaderboard stats for a given time window and mode filter.
 */
export async function getTeamLeaderboard(
  dateFilter: 'TODAY' | 'YESTERDAY' | 'WEEK' | 'ALL_TIME' = 'TODAY',
  modeFilter: 'all' | 'residential' | 'commercial' = 'all'
): Promise<RepLeaderboardRow[]> {
  const supabase = createClient();
  const now = new Date();
  let startISO = '';
  let endISO = '';
  let allTime = false;

  if (dateFilter === 'ALL_TIME') {
    allTime = true;
  } else if (dateFilter === 'WEEK') {
    const day = now.getDay();
    const diff = day === 0 ? 6 : day - 1;
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    startISO = monday.toISOString().split('T')[0] + 'T00:00:00.000Z';
    endISO = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toISOString().split('T')[0] + 'T00:00:00.000Z';
  } else if (dateFilter === 'YESTERDAY') {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    startISO = yesterday.toISOString().split('T')[0] + 'T00:00:00.000Z';
    endISO = now.toISOString().split('T')[0] + 'T00:00:00.000Z';
  } else {
    // TODAY
    startISO = now.toISOString().split('T')[0] + 'T00:00:00.000Z';
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    endISO = tomorrow.toISOString().split('T')[0] + 'T00:00:00.000Z';
  }

  // Fetch knocks
  let knockQuery = supabase.from('events').select('rep_id, payload, created_at').eq('type', 'KNOCK');
  if (!allTime) {
    knockQuery = knockQuery.gte('created_at', startISO).lt('created_at', endISO);
  }

  // Fetch session hours
  let sessionQuery = supabase.from('events').select('rep_id, type, payload, created_at').in('type', ['DAY_START', 'DAY_END']);
  if (!allTime) {
    sessionQuery = sessionQuery.gte('created_at', startISO).lt('created_at', endISO);
  }

  // Fetch reps / employees
  const [knocksRes, sessionsRes, employeesRes] = await Promise.all([
    knockQuery.range(0, 2000),
    sessionQuery.range(0, 1000),
    supabase.from('employees').select('id, full_name, user_id'),
  ]);

  const repNameMap: Record<string, string> = {};
  (employeesRes.data || []).forEach(e => {
    if (e.user_id) repNameMap[e.user_id] = e.full_name;
    repNameMap[e.id] = e.full_name;
  });

  // Calculate session hours
  const sessionHours: Record<string, number> = {};
  const activeStarts: Record<string, Date> = {};
  for (const s of (sessionsRes.data || [])) {
    const p = typeof s.payload === 'string' ? JSON.parse(s.payload) : s.payload;
    const rid = s.rep_id;
    if (s.type === 'DAY_START' && p.start_time) {
      activeStarts[rid] = new Date(p.start_time);
    } else if (s.type === 'DAY_END' && p.end_time && activeStarts[rid]) {
      const hrs = (new Date(p.end_time).getTime() - activeStarts[rid].getTime()) / (1000 * 60 * 60);
      sessionHours[rid] = (sessionHours[rid] || 0) + Math.max(0.1, hrs);
      delete activeStarts[rid];
    }
  }

  // Tally stats per rep
  const repStats: Record<string, RepLeaderboardRow> = {};
  const seenAddresses: Record<string, Set<string>> = {};

  for (const row of (knocksRes.data || [])) {
    const p = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
    const rid = row.rep_id;
    const mode = p.mode || 'residential';

    if (modeFilter !== 'all' && mode !== modeFilter) {
      continue;
    }

    if (!repStats[rid]) {
      repStats[rid] = {
        rep_id: rid,
        rep_name: repNameMap[rid] || 'Sales Rep',
        doors: 0,
        convos: 0,
        walkthroughs_booked: 0,
        sales: 0,
        mrr: 0,
        revenue: 0,
        close_rate: '0.0',
        dph: null,
        commission: 0,
      };
      seenAddresses[rid] = new Set();
    }

    const addrKey = `${p.street_name || ''} ${p.house_number || p.unit_number || ''}`.trim().toLowerCase();
    if (addrKey && !seenAddresses[rid].has(addrKey)) {
      seenAddresses[rid].add(addrKey);
      repStats[rid].doors++;
    }

    const outcome = p.outcome_type;
    if (outcome === 'CONVO') {
      repStats[rid].convos++;
    } else if (outcome === 'WALKTHROUGH_BOOKED') {
      repStats[rid].convos++;
      repStats[rid].walkthroughs_booked++;
      // Give a $50 pipeline commission credit per qualified commercial walkthrough
      repStats[rid].commission += 50;
    } else if (outcome === 'SALE') {
      repStats[rid].sales++;
      if (mode === 'commercial') {
        const mrrVal = parseFloat(p.contract_mrr || '0');
        if (mrrVal > 0) {
          repStats[rid].mrr += mrrVal;
          repStats[rid].commission += calculateCommission(mrrVal, true);
        }
      } else {
        const rev = parseFloat(String(p.sale_details?.job_total || p.job_total || '0').replace(/[^0-9.]/g, ''));
        if (rev > 0) {
          repStats[rid].revenue += rev;
          repStats[rid].commission += calculateCommission(rev, false);
        }
      }
    }
  }

  return Object.values(repStats).map(r => ({
    ...r,
    close_rate: r.doors > 0 ? ((r.sales / r.doors) * 100).toFixed(1) : '0.0',
    dph: sessionHours[r.rep_id] ? (r.doors / sessionHours[r.rep_id]).toFixed(1) : null,
  })).sort((a, b) => (b.sales + b.walkthroughs_booked) - (a.sales + a.walkthroughs_booked) || b.doors - a.doors);
}

/**
 * Fetch team radar (most recent knock and location for each active rep).
 */
export async function getTeamRadar(): Promise<RadarItem[]> {
  const supabase = createClient();
  const todayStr = new Date().toISOString().split('T')[0];

  const { data: knocks } = await supabase
    .from('events')
    .select('rep_id, payload, created_at')
    .eq('type', 'KNOCK')
    .gte('created_at', todayStr + 'T00:00:00.000Z')
    .order('created_at', { ascending: false })
    .limit(500);

  const { data: employees } = await supabase.from('employees').select('user_id, full_name');
  const repNameMap: Record<string, string> = {};
  (employees || []).forEach(e => {
    if (e.user_id) repNameMap[e.user_id] = e.full_name;
  });

  const radarMap: Record<string, RadarItem> = {};

  for (const row of (knocks || [])) {
    const rid = row.rep_id;
    if (radarMap[rid]) continue; // Already have latest for this rep

    const p = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
    radarMap[rid] = {
      rep_id: rid,
      rep_name: repNameMap[rid] || 'Sales Rep',
      status: p.outcome_type || 'KNOCK',
      street_name: p.street_name || 'In Field',
      mode: p.mode || 'residential',
      company_name: p.company_name,
      timestamp: p.timestamp || row.created_at,
    };
  }

  return Object.values(radarMap);
}

/**
 * Fetch Sales OS Commercial Pipeline opportunities.
 */
export async function getCommercialOpportunities(): Promise<CommercialOpportunity[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('commercial_opportunities')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[Sales OS] getCommercialOpportunities error:', error);
    return [];
  }
  return data || [];
}

/**
 * Update an opportunity stage in the Sales OS pipeline.
 */
export async function updateOpportunityStage(id: string, stage: CommercialOpportunity['stage']) {
  const supabase = createClient();
  const { error } = await supabase
    .from('commercial_opportunities')
    .update({ stage, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    throw error;
  }
}
