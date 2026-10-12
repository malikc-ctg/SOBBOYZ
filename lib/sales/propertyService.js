import { sqlocal, upsertProperty, getAllProperties } from './db';
import { modeOf, MODES, resolveStatus } from './modes';

/**
 * PROPERTY DERIVATION SERVICE
 * Scans the local event log and builds/updates the properties table
 * with the latest status, coordinates, and timestamps for each address.
 */

// Deterministic property_id from address string
function makePropertyId(address) {
  let hash = 0;
  for (let i = 0; i < address.length; i++) {
    const char = address.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return 'prop_' + Math.abs(hash).toString(36);
}

function buildGeoJSONFromKnocks(knocks, filterMode = null) {
  const propMap = {};
  const todayStr = new Date().toISOString().split('T')[0];

  const STATUS_PRIORITY = {
    SALE: 10,
    WALKTHROUGH_BOOKED: 9,
    DM_INTERESTED: 8,
    DECISION_MAKER: 7,
    GATEKEEPER: 6,
    CONVO: 5,
    CALLBACK: 4,
    THINKING: 3,
    NOT_NOW: 2,
    HAS_VENDOR: 2,
    NOT_INTERESTED: 1,
    NO_ANSWER: 0
  };

  for (const row of knocks) {
    const p = row.payload ? JSON.parse(row.payload) : row; // handle both sqlocal rows and raw payload objects
    // Mode filter: only include pins that match the requested mode (or all if filterMode is null)
    const mode = modeOf(p);
    if (filterMode !== null && mode !== filterMode) continue;

    const address = `${p.house_number || ''} ${p.street_name || ''}`.trim();
    if (!address) continue;
    if (!p.lat || !p.lng) continue; // Must have coordinates to map

    const resolvedStatus = resolveStatus(p);

    if (mode === MODES.COMMERCIAL) {
      // Group by plaza location / street name so all knocks in that plaza form one dot
      const plazaKey = (p.street_name || address || `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).trim().toLowerCase();
      const pid = 'plaza_' + makePropertyId(plazaKey);

      const knockItem = {
        event_id: p.event_id || p.id,
        business_name: p.business_name || 'Commercial Target',
        suite: p.suite || null,
        address,
        status: resolvedStatus,
        statusLabel: (resolvedStatus || '').replace(/_/g, ' '),
        outcome_type: p.outcome_type,
        notes: p.notes || null,
        callback_time: p.callback_time || null,
        timestamp: p.timestamp || row.created_at,
        timeStr: (p.timestamp || row.created_at) ? new Date(p.timestamp || row.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
        rep_name: p.rep_name || null,
      };

      if (!propMap[pid]) {
        propMap[pid] = {
          property_id: pid,
          address: p.street_name || address,
          plaza_name: p.street_name || address,
          business_name: p.business_name || null,
          suite: p.suite || null,
          mode,
          lat: p.lat,
          lng: p.lng,
          last_status: resolvedStatus,
          last_knocked_at: p.timestamp || row.created_at,
          knocked_today: (p.timestamp || row.created_at || '').startsWith(todayStr) ? 1 : 0,
          visits: 0,
          is_plaza: 1,
          knocks: []
        };
      }

      propMap[pid].visits += 1;
      propMap[pid].knocks.push(knockItem);

      // Prioritize prominent status for the plaza dot's pin color
      const curPri = STATUS_PRIORITY[propMap[pid].last_status] ?? -1;
      const newPri = STATUS_PRIORITY[resolvedStatus] ?? -1;
      if (newPri > curPri || (newPri === curPri && (p.timestamp || row.created_at) > propMap[pid].last_knocked_at)) {
        propMap[pid].last_status = resolvedStatus;
      }

      if ((p.timestamp || row.created_at) > propMap[pid].last_knocked_at) {
        propMap[pid].last_knocked_at = p.timestamp || row.created_at;
      }
      if ((p.timestamp || row.created_at || '').startsWith(todayStr)) {
        propMap[pid].knocked_today = 1;
      }
    } else {
      // Residential mode: individual house pins
      const pid = makePropertyId(address.toLowerCase());
      propMap[pid] = {
        property_id: pid,
        address,
        business_name: null,
        suite: null,
        mode,
        lat: p.lat,
        lng: p.lng,
        last_status: resolvedStatus,
        last_knocked_at: p.timestamp || row.created_at,
        knocked_today: (p.timestamp || row.created_at || '').startsWith(todayStr) ? 1 : 0,
        visits: (propMap[pid]?.visits || 0) + 1,
        is_plaza: 0,
        knocks: []
      };
    }
  }

  return {
    type: 'FeatureCollection',
    features: Object.values(propMap).map(p => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [p.lng, p.lat]
      },
      properties: {
        property_id: p.property_id,
        address: p.address,
        plaza_name: p.plaza_name || p.address,
        business_name: p.business_name,
        suite: p.suite,
        mode: p.mode,
        is_plaza: p.is_plaza || 0,
        total_knocks: p.knocks ? p.knocks.length : 1,
        knocks: p.knocks ? JSON.stringify(p.knocks) : '[]',
        last_status: p.last_status,
        last_knocked_at: p.last_knocked_at,
        knocked_today: p.knocked_today,
        visits: p.visits
      }
    }))
  };
}


/**
 * Scans all KNOCK events from local SQLite and upserts into the properties table.
 * This is idempotent — safe to call repeatedly.
 */
export async function derivePropertiesFromEvents() {
  const rs = await sqlocal.sql`SELECT * FROM events WHERE type = 'KNOCK' ORDER BY created_at ASC`;
  const todayStr = new Date().toISOString().split('T')[0];
  const propMap = {};
  
  for (const row of rs) {
    const p = JSON.parse(row.payload);
    const mode = modeOf(p);
    const address = `${p.house_number || ''} ${p.street_name || ''}`.trim();
    if (!address) continue;

    const pid = (mode === MODES.COMMERCIAL && p.target_key)
      ? 'comm_' + p.target_key
      : makePropertyId(address.toLowerCase());

    const resolvedStatus = resolveStatus(p);
    const knockedToday = (p.timestamp || row.created_at).startsWith(todayStr) ? 1 : 0;

    propMap[pid] = {
      property_id: pid,
      address,
      lat: p.lat || propMap[pid]?.lat || null,
      lng: p.lng || propMap[pid]?.lng || null,
      last_status: resolvedStatus,
      last_knocked_at: p.timestamp || row.created_at,
      last_rep_id: p.rep_id || null,
      territory_id: null,
      knocked_today: knockedToday || propMap[pid]?.knocked_today || 0
    };
  }

  for (const prop of Object.values(propMap)) {
    await upsertProperty(prop);
  }
}

/**
 * Returns all geo-located properties as a GeoJSON FeatureCollection
 */
export async function getPropertiesAsGeoJSON() {
  const props = await getAllProperties();
  
  return {
    type: 'FeatureCollection',
    features: props.map(p => ({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [p.lng, p.lat]
      },
      properties: {
        property_id: p.property_id,
        address: p.address,
        last_status: p.last_status,
        last_knocked_at: p.last_knocked_at,
        knocked_today: p.knocked_today,
        last_rep_id: p.last_rep_id
      }
    }))
  };
}

export async function getActiveSessionGeoJSON(filterMode = null) {
  const rsStart = await sqlocal.sql`SELECT payload FROM events WHERE type = 'DAY_START' ORDER BY created_at DESC LIMIT 1`;
  if (rsStart.length === 0) return { type: 'FeatureCollection', features: [] };
  
  const sessData = JSON.parse(rsStart[0].payload);
  const sessionId = sessData.session_id;

  const rsEnd = await sqlocal.sql`SELECT payload FROM events WHERE type = 'DAY_END'`;
  const ends = rsEnd.filter(r => JSON.parse(r.payload).session_id === sessionId);
  if (ends.length > 0) return { type: 'FeatureCollection', features: [] }; // Session closed

  const knocksRs = await sqlocal.sql`SELECT payload, created_at FROM events WHERE type = 'KNOCK'`;
  const knocks = knocksRs.filter(r => JSON.parse(r.payload).session_id === sessionId);
  
  return buildGeoJSONFromKnocks(knocks, filterMode);
}

export async function getSessionGeoJSON(sessionId, filterMode = null) {
  const knocksRs = await sqlocal.sql`SELECT payload, created_at FROM events WHERE type = 'KNOCK'`;
  const knocks = knocksRs.filter(r => JSON.parse(r.payload).session_id === sessionId);
  return buildGeoJSONFromKnocks(knocks, filterMode);
}


