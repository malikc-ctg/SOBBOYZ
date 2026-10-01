import fs from 'fs';

const env = fs.readFileSync('.env.local', 'utf8');
const sobKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim().replace(/^["']|["']$/g, '');
const sobUrl = 'https://lhpclmglzyemisgjrgts.supabase.co';

const oldUrl = 'https://rwuwfevgepigvuihindn.supabase.co';
const oldKey = 'sb_publishable_JYO2wYAlT2MANkchrYlFfw_CISKaut_';

const REP_MAP = {
  // Malik
  '07853cdf-ed2c-4f3b-b713-cde7c40e20a1': {
    targetId: 'd616b5ed-d3a0-425d-b0c2-5f47a9320fc5',
    name: 'Malik Campbell',
    email: 'malik@seaofblue.app'
  },
  // Ayaan
  '2e5444e2-b68b-4a87-895c-1cace8e75485': {
    targetId: '3b2831b3-7922-4cb5-aa77-1a9b182e77a1',
    name: 'Ayaan Baig',
    email: 'ayaan@seaofblue.app'
  },
  // Raahim
  'a454b170-9fc1-40ea-971f-7730610ffbaf': {
    targetId: 'fa039375-1c07-4579-890a-6c7000cc0be8',
    name: 'Raahim',
    email: 'raahim@seaofblue.app'
  }
};

async function migrate() {
  console.log('--- STARTING OLD KNOCKLOG DATA MIGRATION ---');
  console.log(`Source: ${oldUrl}`);
  console.log(`Target: ${sobUrl}`);

  let totalFetched = 0;
  let totalInserted = 0;
  let offset = 0;
  const BATCH_SIZE = 100;

  const repCounts = {
    Malik: 0,
    Ayaan: 0,
    Raahim: 0,
    Other: 0
  };

  while (true) {
    const fetchUrl = `${oldUrl}/rest/v1/events?order=created_at.asc&offset=${offset}&limit=${BATCH_SIZE}`;
    const res = await fetch(fetchUrl, {
      headers: {
        apikey: oldKey,
        Authorization: `Bearer ${oldKey}`
      }
    });

    if (!res.ok) {
      console.error(`Failed to fetch offset ${offset}:`, res.status, await res.text());
      break;
    }

    const events = await res.json();
    if (!events || events.length === 0) {
      console.log('No more events to fetch.');
      break;
    }

    totalFetched += events.length;

    const transformed = events.map(e => {
      const mapping = REP_MAP[e.rep_id];
      const targetRepId = mapping ? mapping.targetId : e.rep_id;

      if (mapping) {
        if (mapping.name.startsWith('Malik')) repCounts.Malik++;
        else if (mapping.name.startsWith('Ayaan')) repCounts.Ayaan++;
        else if (mapping.name.startsWith('Raahim')) repCounts.Raahim++;
      } else {
        repCounts.Other++;
      }

      // Deep copy payload and replace rep_id inside payload if present
      let payload = e.payload;
      if (typeof payload === 'object' && payload !== null) {
        payload = { ...payload };
        if (payload.rep_id && REP_MAP[payload.rep_id]) {
          payload.rep_id = REP_MAP[payload.rep_id].targetId;
        }
        if (payload.user_id && REP_MAP[payload.user_id]) {
          payload.user_id = REP_MAP[payload.user_id].targetId;
        }
      }

      return {
        event_id: e.event_id,
        rep_id: targetRepId,
        type: e.type,
        payload: payload,
        created_at: e.created_at
      };
    });

    // Insert into Sea of Blue
    const insertRes = await fetch(`${sobUrl}/rest/v1/events`, {
      method: 'POST',
      headers: {
        apikey: sobKey,
        Authorization: `Bearer ${sobKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates'
      },
      body: JSON.stringify(transformed)
    });

    if (!insertRes.ok) {
      console.error(`Failed to insert batch at offset ${offset}:`, insertRes.status, await insertRes.text());
    } else {
      totalInserted += transformed.length;
      process.stdout.write(`Migrated ${totalInserted}/${totalFetched} events (Offset: ${offset})...\r`);
    }

    if (events.length < BATCH_SIZE) {
      break;
    }

    offset += BATCH_SIZE;
  }

  console.log('\n--- MIGRATION COMPLETED ---');
  console.log(`Total events fetched from old DB: ${totalFetched}`);
  console.log(`Total events upserted to Sea of Blue: ${totalInserted}`);
  console.log('Breakdown by mapped rep:', repCounts);

  // Check target counts
  const sobEventsRes = await fetch(`${sobUrl}/rest/v1/events?select=count`, {
    headers: { apikey: sobKey, Authorization: `Bearer ${sobKey}`, Prefer: 'count=exact' }
  });
  console.log(`Sea of Blue events table total: ${sobEventsRes.headers.get('content-range')}`);

  const sobKnocksRes = await fetch(`${sobUrl}/rest/v1/knock_events?select=count`, {
    headers: { apikey: sobKey, Authorization: `Bearer ${sobKey}`, Prefer: 'count=exact' }
  });
  console.log(`Sea of Blue knock_events table total: ${sobKnocksRes.headers.get('content-range')}`);
}

migrate().catch(console.error);
