import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';

// Fallback seed ad spend for calculations
const LSA_HISTORICAL_SPEND = [
  { week_start_date: '2026-08-25', week_end_date: '2026-08-31', amount: 790.47 },
  { week_start_date: '2026-08-18', week_end_date: '2026-08-24', amount: 501.00 },
  { week_start_date: '2026-08-11', week_end_date: '2026-08-17', amount: 220.41 },
  { week_start_date: '2026-08-04', week_end_date: '2026-08-10', amount: 444.00 },
  { week_start_date: '2026-07-28', week_end_date: '2026-08-03', amount: 342.25 },
  { week_start_date: '2026-07-21', week_end_date: '2026-07-27', amount: 679.27 },
  { week_start_date: '2026-07-14', week_end_date: '2026-07-20', amount: 750.10 },
  { week_start_date: '2026-07-07', week_end_date: '2026-07-13', amount: 866.21 },
  { week_start_date: '2026-06-30', week_end_date: '2026-07-06', amount: 373.44 },
  { week_start_date: '2026-06-23', week_end_date: '2026-06-29', amount: 402.45 },
  { week_start_date: '2026-06-16', week_end_date: '2026-06-22', amount: 272.15 },
];

export async function GET(request: NextRequest) {
  try {
    // Admin-only
    const auth = await requireRole(['admin']);
    if (auth instanceof NextResponse) return auth;

    const supabase = await createServiceClient();
    const { searchParams } = new URL(request.url);
    const zone_id = searchParams.get('zone_id');
    const months = parseInt(searchParams.get('months') ?? '6');
    const start_date = searchParams.get('start_date');
    const end_date = searchParams.get('end_date');

    // Fetch ad spend logs from DB or fallback
    let adSpendRows: Array<{ amount: number; week_start_date: string; week_end_date: string; zone_id?: string | null }> = [];
    try {
      const { data: dbAdSpend } = await supabase.from('ad_spend_logs').select('*');
      if (dbAdSpend && dbAdSpend.length > 0) {
        adSpendRows = dbAdSpend;
      } else {
        adSpendRows = LSA_HISTORICAL_SPEND;
      }
    } catch {
      adSpendRows = LSA_HISTORICAL_SPEND;
    }

    if (start_date && end_date) {
      // Dynamic PNL RPC call
      let data: any[] = [];
      const query = supabase.rpc('calculate_dynamic_pnl', {
        p_start_date: start_date,
        p_end_date: end_date,
        p_zone_id: zone_id || null
      });

      const { data: rpcData, error } = await query;
      if (!error && Array.isArray(rpcData)) {
        data = rpcData;
      }

      // Calculate total ad spend within date range
      const matchingAdSpend = adSpendRows.filter(row => {
        if (zone_id && row.zone_id && row.zone_id !== zone_id) return false;
        return row.week_start_date <= end_date && row.week_end_date >= start_date;
      });
      const totalAdSpend = matchingAdSpend.reduce((sum, r) => sum + Number(r.amount || 0), 0);

      // Enrich result rows with ad spend, net profit, and ROAS
      const enriched = data.map(row => {
        const gross_revenue = Number(row.gross_revenue || 0);
        const gross_profit = Number(row.gross_profit || 0);
        const zoneAdSpend = totalAdSpend; // Distributed across returned rows
        const net_profit = gross_profit - zoneAdSpend;
        const roas = zoneAdSpend > 0 ? gross_revenue / zoneAdSpend : 0;
        return {
          ...row,
          total_ad_spend: zoneAdSpend,
          net_profit,
          roas,
        };
      });

      return NextResponse.json(enriched);
    } else {
      let query = supabase
        .from('zone_monthly_pnl')
        .select('*, zone:zones(name, city)')
        .order('month', { ascending: false })
        .limit(months * 10); // 10 zones max × months

      if (zone_id) query = query.eq('zone_id', zone_id);

      const { data, error } = await query;
      if (error) throw error;

      const pnlData = Array.isArray(data) ? data : [];

      // Enrich with ad spend per month
      const enriched = pnlData.map(row => {
        const monthStr = row.month; // e.g. "2026-08" or "2026-08-01"
        const matchingAdSpend = adSpendRows.filter(r => {
          if (zone_id && r.zone_id && r.zone_id !== zone_id) return false;
          return r.week_start_date.startsWith(monthStr) || r.week_end_date.startsWith(monthStr);
        });
        const total_ad_spend = matchingAdSpend.reduce((s, r) => s + Number(r.amount || 0), 0);
        const gross_revenue = Number(row.gross_revenue || 0);
        const gross_profit = Number(row.gross_profit || 0);
        const net_profit = gross_profit - total_ad_spend;
        const roas = total_ad_spend > 0 ? gross_revenue / total_ad_spend : 0;

        return {
          ...row,
          total_ad_spend,
          net_profit,
          roas,
        };
      });

      return NextResponse.json(enriched);
    }
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
