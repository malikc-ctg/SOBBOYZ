import { createServiceClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth';

const STATUS_COLORS: Record<string, string> = {
  SALE: '#10b981',
  WALKTHROUGH_BOOKED: '#a855f7',
  GATEKEEPER: '#f59e0b',
  DECISION_MAKER: '#3b82f6',
  DM_INTERESTED: '#06b6d4',
  HAS_VENDOR: '#eab308',
  LANDLORD: '#d97706',
  NOT_NOW: '#ec4899',
  CONVO: '#3b82f6',
  NOT_INTERESTED: '#ef4444',
  CALLBACK: '#a855f7',
  THINKING: '#60a5fa',
  NO_SOLICITING: '#dc2626',
  CONSTRUCTION: '#f59e0b',
  NO_ANSWER: '#64748b',
};

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const supabase = await createServiceClient();

    // 1. Fetch reps name mapping
    const repsRes = await supabase.from('reps').select('user_id, display_name');
    const repNameMap: Record<string, string> = {};
    (repsRes.data || []).forEach((r: any) => {
      repNameMap[r.user_id] = r.display_name;
    });

    // 2. Fetch commercial opportunities
    const oppsRes = await supabase
      .from('commercial_opportunities')
      .select('id, company_name, address, unit_number, stage, dm_name, dm_phone, expected_mrr, walkthrough_date, lat, lng')
      .not('lat', 'is', null)
      .not('lng', 'is', null);

    // 3. Fetch all team property coverage rows in parallel 1000-item chunks
    const CHUNK_SIZE = 1000;
    const ranges = [
      { from: 0, to: 999 },
      { from: 1000, to: 1999 },
      { from: 2000, to: 2999 },
      { from: 3000, to: 3999 },
      { from: 4000, to: 4999 },
    ];

    const coverageChunks = await Promise.all(
      ranges.map(async ({ from, to }) => {
        const { data } = await supabase
          .from('team_property_coverage')
          .select('house_number, street_name, last_knocked_at, outcome_type, convo_status, objection_type, lat, lng, rep_id, mode')
          .range(from, to);
        return data || [];
      })
    );

    const allCoverage = coverageChunks.flat();

    const features: any[] = [];

    // Add residential & commercial knocks
    for (const row of allCoverage) {
      if (!row.lat || !row.lng) continue;
      const address = `${row.house_number || ''} ${row.street_name || ''}`.trim() || 'Address';
      const outcome = row.outcome_type || 'NO_ANSWER';
      const color = STATUS_COLORS[outcome] || STATUS_COLORS.NO_ANSWER;
      const repName = repNameMap[row.rep_id] || 'Teammate';

      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [row.lng, row.lat],
        },
        properties: {
          id: `knock_${address}`,
          kind: 'KNOCK',
          address,
          status: outcome,
          status_label: outcome.replace(/_/g, ' '),
          convo_status: row.convo_status,
          objection_type: row.objection_type,
          mode: row.mode || 'residential',
          rep_name: repName,
          timestamp: row.last_knocked_at,
          color,
          weight: outcome === 'SALE' ? 1.0 : outcome === 'CONVO' ? 0.7 : 0.3,
        },
      });
    }

    // Add commercial opportunities
    for (const opp of oppsRes.data || []) {
      if (!opp.lat || !opp.lng) continue;
      const address = `${opp.address || ''}${opp.unit_number ? ' Ste ' + opp.unit_number : ''}`.trim();
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [opp.lng, opp.lat],
        },
        properties: {
          id: `comm_${opp.id}`,
          kind: 'COMMERCIAL_OPP',
          company_name: opp.company_name || 'Commercial Account',
          address,
          stage: opp.stage || 'walkthrough_scheduled',
          dm_name: opp.dm_name || 'Decision Maker',
          dm_phone: opp.dm_phone || '',
          expected_mrr: opp.expected_mrr ? Number(opp.expected_mrr) : null,
          walkthrough_date: opp.walkthrough_date,
          color: '#c084fc',
          weight: 1.0,
        },
      });
    }

    return NextResponse.json({
      type: 'FeatureCollection',
      features,
      summary: {
        total_knocks: allCoverage.length,
        commercial_opps: (oppsRes.data || []).length,
      },
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
      },
    });
  } catch (err: any) {
    console.error('[API /api/operations/sales-geojson] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
