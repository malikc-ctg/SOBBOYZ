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

const OUTCOME_LABELS: Record<string, string> = {
  SALE: 'Won Sale',
  WALKTHROUGH_BOOKED: 'Walkthrough Booked',
  DECISION_MAKER: 'Decision Maker Reached',
  DM_INTERESTED: 'DM Interested',
  GATEKEEPER: 'Gatekeeper Contacted',
  HAS_VENDOR: 'Has Existing Vendor',
  LANDLORD: 'Landlord Contact',
  NOT_NOW: 'Not Right Now',
  CONVO: 'Conversation',
  NOT_INTERESTED: 'Not Interested',
  CALLBACK: 'Call Back Requested',
  THINKING: 'Thinking About It',
  NO_SOLICITING: 'No Soliciting',
  CONSTRUCTION: 'Under Construction',
  NO_ANSWER: 'No Answer',
};

const OUTCOME_PRIORITY: Record<string, number> = {
  SALE: 10,
  WALKTHROUGH_BOOKED: 9,
  DM_INTERESTED: 8,
  DECISION_MAKER: 7,
  CONVO: 6,
  CALLBACK: 5,
  THINKING: 4,
  GATEKEEPER: 3,
  HAS_VENDOR: 3,
  NOT_NOW: 2,
  NO_ANSWER: 1,
};

function cleanPlazaName(streetName: string, fallbackName?: string | null): string {
  if (streetName && streetName.includes('—')) {
    const parts = streetName.split('—');
    const right = parts[1]?.trim() || '';
    const firstComma = right.split(',')[0]?.trim();
    if (firstComma) return firstComma;
  }
  return fallbackName || streetName || 'Commercial Plaza';
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const supabase = await createServiceClient();

    // 1. Fetch reps, opportunities, jobs, and knock events in parallel
    const ranges = [
      { from: 0, to: 999 },
      { from: 1000, to: 1999 },
      { from: 2000, to: 2999 },
      { from: 3000, to: 3999 },
      { from: 4000, to: 4999 },
    ];

    const [repsRes, oppsRes, jobsRes, knockChunks] = await Promise.all([
      supabase.from('reps').select('user_id, display_name'),
      supabase
        .from('commercial_opportunities')
        .select('id, company_name, address, unit_number, stage, dm_name, dm_phone, expected_mrr, walkthrough_date, lat, lng')
        .not('lat', 'is', null)
        .not('lng', 'is', null),
      supabase
        .from('jobs')
        .select('id, job_number, address_line1, status, quoted_price, final_price, service_type, scheduled_date')
        .order('scheduled_date', { ascending: false }),
      Promise.all(
        ranges.map(async ({ from, to }) => {
          const { data } = await supabase
            .from('events')
            .select('id, rep_id, payload, created_at')
            .eq('type', 'KNOCK')
            .range(from, to);
          return data || [];
        })
      ),
    ]);

    // Reps mapping
    const repNameMap: Record<string, string> = {};
    (repsRes.data || []).forEach((r: any) => {
      repNameMap[r.user_id] = r.display_name;
    });

    // Service jobs indexed by normalized address
    const jobsByAddress = new Map<string, any[]>();
    (jobsRes.data || []).forEach((j: any) => {
      const addrKey = (j.address_line1 || '').toLowerCase().trim();
      if (!addrKey) return;
      if (!jobsByAddress.has(addrKey)) jobsByAddress.set(addrKey, []);
      jobsByAddress.get(addrKey)!.push({
        id: j.id,
        job_number: j.job_number,
        service_type: j.service_type,
        status: j.status,
        scheduled_date: j.scheduled_date,
        price: j.final_price || j.quoted_price || 0,
      });
    });

    const allEvents = knockChunks.flat();

    // 2. Separate into Commercial/Plaza Knocks vs Residential Knocks
    const plazaMap = new Map<string, {
      lat: number;
      lng: number;
      street_name: string;
      house_number: string;
      knocks: any[];
    }>();

    const residentialMap = new Map<string, {
      lat: number;
      lng: number;
      house_number: string;
      street_name: string;
      knocks: any[];
    }>();

    for (const ev of allEvents) {
      const p = ev.payload || {};
      if (!p.lat || !p.lng) continue;

      const isCommercial =
        p.mode === 'commercial' ||
        p.target_type === 'BUSINESS' ||
        Boolean(p.business_name);

      const repName = repNameMap[ev.rep_id] || 'Teammate';
      const outcome = p.outcome_type || 'NO_ANSWER';
      const timestamp = p.timestamp || ev.created_at;

      if (isCommercial) {
        // Group by plaza coordinates key (rounded to 3 decimals ~110m)
        const plazaKey = `${p.lat.toFixed(3)}_${p.lng.toFixed(3)}`;
        if (!plazaMap.has(plazaKey)) {
          plazaMap.set(plazaKey, {
            lat: p.lat,
            lng: p.lng,
            street_name: p.street_name || '',
            house_number: p.house_number || '',
            knocks: [],
          });
        }

        const sd = p.sale_details || {};
        const ld = p.lead_details || {};
        plazaMap.get(plazaKey)!.knocks.push({
          id: ev.id,
          business_name: p.business_name || p.company_name || 'Business Tenant',
          suite: p.suite || p.unit_number || null,
          outcome_type: outcome,
          outcome_label: OUTCOME_LABELS[outcome] || outcome.replace(/_/g, ' '),
          color: STATUS_COLORS[outcome] || STATUS_COLORS.NO_ANSWER,
          rep_name: sd.rep_override || repName,
          timestamp,
          convo_status: p.convo_status || null,
          objection_type: p.objection_type || null,
          walkthrough_date: ld.walkthrough_date || p.walkthrough_date || null,
          expected_mrr: p.expected_mrr ? Number(p.expected_mrr) : null,
          price: sd.job_total ? parseFloat(sd.job_total) : (p.price ? Number(p.price) : null),
          dm_name: p.dm_name || ld.dm_name || null,
          dm_phone: p.dm_phone || ld.dm_phone || null,
          job_status: sd.job_status || (outcome === 'SALE' ? 'COMPLETED' : null),
        });
      } else {
        // Residential address key
        const house = (p.house_number || '').trim();
        const street = (p.street_name || '').trim();
        const addrKey = `${house} ${street}`.toLowerCase().trim();
        if (!addrKey) continue;

        if (!residentialMap.has(addrKey)) {
          residentialMap.set(addrKey, {
            lat: p.lat,
            lng: p.lng,
            house_number: house,
            street_name: street,
            knocks: [],
          });
        }

        const sd = p.sale_details || {};
        residentialMap.get(addrKey)!.knocks.push({
          id: ev.id,
          outcome_type: outcome,
          outcome_label: OUTCOME_LABELS[outcome] || outcome.replace(/_/g, ' '),
          color: STATUS_COLORS[outcome] || STATUS_COLORS.NO_ANSWER,
          rep_name: sd.rep_override || repName,
          timestamp,
          convo_status: p.convo_status || null,
          objection_type: p.objection_type || null,
          price: sd.job_total ? parseFloat(sd.job_total) : null,
          homeowner_name: sd.homeowner_name || null,
          phone: sd.phone || null,
          email: sd.email || null,
          service_date: sd.service_date || null,
          job_status: sd.job_status || (outcome === 'SALE' ? 'COMPLETED' : null),
          payment_method: sd.payment_method || null,
        });
      }
    }

    // Merge commercial opportunities into plazas or as standalone plaza dots
    const opps = oppsRes.data || [];
    for (const opp of opps) {
      if (!opp.lat || !opp.lng) continue;
      const plazaKey = `${opp.lat.toFixed(3)}_${opp.lng.toFixed(3)}`;
      const existingPlaza = plazaMap.get(plazaKey);

      const oppKnock = {
        id: `opp_${opp.id}`,
        business_name: opp.company_name || 'Commercial Account',
        suite: opp.unit_number || null,
        outcome_type: opp.walkthrough_date ? 'WALKTHROUGH_BOOKED' : 'DECISION_MAKER',
        outcome_label: opp.walkthrough_date ? 'Walkthrough Booked' : 'Commercial B2B',
        color: opp.walkthrough_date ? STATUS_COLORS.WALKTHROUGH_BOOKED : STATUS_COLORS.DECISION_MAKER,
        rep_name: 'Field Sales',
        timestamp: opp.walkthrough_date || new Date().toISOString(),
        convo_status: opp.stage || 'active',
        objection_type: null,
        walkthrough_date: opp.walkthrough_date || null,
        expected_mrr: opp.expected_mrr ? Number(opp.expected_mrr) : null,
        price: opp.expected_mrr ? Number(opp.expected_mrr) : null,
        dm_name: opp.dm_name || null,
        dm_phone: opp.dm_phone || null,
        job_status: null,
      };

      if (existingPlaza) {
        // If not already in the plaza's knocks, add it
        const alreadyHas = existingPlaza.knocks.some(
          (k) => k.business_name?.toLowerCase() === opp.company_name?.toLowerCase()
        );
        if (!alreadyHas) {
          existingPlaza.knocks.unshift(oppKnock);
        }
      } else {
        plazaMap.set(plazaKey, {
          lat: opp.lat,
          lng: opp.lng,
          street_name: opp.address || '',
          house_number: '',
          knocks: [oppKnock],
        });
      }
    }

    const features: any[] = [];

    // ── Build Plaza Features (ONE BIG DOT PER PLAZA) ───────────────────────────
    for (const [key, pz] of Array.from(plazaMap.entries())) {
      // Sort knocks inside plaza: latest first
      pz.knocks.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const uniqueBusinesses = Array.from(new Set(pz.knocks.map((k) => k.business_name).filter(Boolean)));
      const walkthroughsCount = pz.knocks.filter((k) => k.outcome_type === 'WALKTHROUGH_BOOKED').length;
      const dmsCount = pz.knocks.filter((k) => ['DECISION_MAKER', 'DM_INTERESTED'].includes(k.outcome_type)).length;
      const salesCount = pz.knocks.filter((k) => k.outcome_type === 'SALE').length;

      const title = cleanPlazaName(pz.street_name, uniqueBusinesses[0]);
      const cleanAddress = pz.street_name.includes('—')
        ? pz.street_name.split('—')[1]?.trim() || pz.street_name
        : `${pz.house_number} ${pz.street_name}`.trim();

      const topBusinesses = uniqueBusinesses.slice(0, 3).join(', ');
      const businessesSummary =
        uniqueBusinesses.length > 3
          ? `${topBusinesses} +${uniqueBusinesses.length - 3} more`
          : topBusinesses || 'Commercial tenants';

      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [pz.lng, pz.lat],
        },
        properties: {
          id: `plaza_${key}`,
          kind: 'COMMERCIAL_OPP', // Retains compatibility with DispatchMap commercial layers
          is_plaza: true,
          company_name: title,
          address: cleanAddress || title,
          color: '#c084fc',
          weight: 1.2,
          total_knocks: pz.knocks.length,
          businesses_count: uniqueBusinesses.length,
          walkthroughs_count: walkthroughsCount,
          decision_makers_count: dmsCount,
          sales_count: salesCount,
          businesses_summary: businessesSummary,
          knocks: JSON.stringify(pz.knocks),
        },
      });
    }

    // ── Build Residential Features (ONE DOT PER HOME WITH FULL HISTORY) ──────
    for (const [addrKey, prop] of Array.from(residentialMap.entries())) {
      // Sort knocks: latest first
      prop.knocks.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      const latestKnock = prop.knocks[0];
      const address = `${prop.house_number} ${prop.street_name}`.trim();

      // Determine highest priority outcome
      let bestKnock = latestKnock;
      let highestPriority = 0;
      for (const k of prop.knocks) {
        const prio = OUTCOME_PRIORITY[k.outcome_type] || 0;
        if (prio > highestPriority) {
          highestPriority = prio;
          bestKnock = k;
        }
      }

      // Find any won sale details across any knock history
      const saleKnock = prop.knocks.find((k) => k.outcome_type === 'SALE' || k.price);
      const isSale = Boolean(saleKnock);

      const color = STATUS_COLORS[bestKnock.outcome_type] || STATUS_COLORS.NO_ANSWER;
      const matchedJobs = jobsByAddress.get(addrKey) || [];

      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [prop.lng, prop.lat],
        },
        properties: {
          id: `knock_${addrKey}`,
          kind: 'KNOCK',
          address,
          status: bestKnock.outcome_type,
          status_label: OUTCOME_LABELS[bestKnock.outcome_type] || bestKnock.outcome_label || 'Knock',
          color,
          weight: isSale ? 1.0 : bestKnock.outcome_type === 'CONVO' ? 0.7 : 0.35,
          rep_name: saleKnock?.rep_name || latestKnock.rep_name || 'Teammate',
          timestamp: latestKnock.timestamp,
          knock_count: prop.knocks.length,
          has_multi_knocks: prop.knocks.length > 1,
          is_sale: isSale,
          price: saleKnock?.price ?? null,
          deal_value: saleKnock?.price ?? null,
          homeowner_name: saleKnock?.homeowner_name ?? null,
          phone: saleKnock?.phone ?? null,
          email: saleKnock?.email ?? null,
          service_date: saleKnock?.service_date ?? null,
          job_status: saleKnock?.job_status ?? (isSale ? 'COMPLETED' : null),
          payment_method: saleKnock?.payment_method ?? null,
          // Full chronological knock history
          history: JSON.stringify(prop.knocks),
          // Linked past or scheduled operations jobs
          service_history: JSON.stringify(matchedJobs),
        },
      });
    }

    const totalKnocksLogged = allEvents.length;
    const totalPlazas = plazaMap.size;
    const totalResidentialProperties = residentialMap.size;

    return NextResponse.json(
      {
        type: 'FeatureCollection',
        features,
        summary: {
          total_knocks: totalKnocksLogged,
          commercial_opps: totalPlazas,
          unique_residential: totalResidentialProperties,
          total_plazas: totalPlazas,
        },
      },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=60',
        },
      }
    );
  } catch (err: any) {
    console.error('[API /api/operations/sales-geojson] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
