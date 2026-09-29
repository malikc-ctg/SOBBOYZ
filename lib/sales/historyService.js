import { supabase } from './supabase';
import { sqlocal, upsertServerEvent, bulkUpsertServerEvents, getSyncTimestamp, updateSyncTimestamp } from './db';
import { derivePropertiesFromEvents } from './propertyService';

/**
 * HISTORY DERIVATION SERVICE
 * Strictly reads from local Event Sourcing OPFS SQLite.
 */

// Fetches derived history from local db
export async function getLocalHistory() {
  const rs = await sqlocal.sql`SELECT * FROM events ORDER BY created_at ASC`;
  
  // Fold mechanism to derive sessions
  const sessionsMap = {}; // sessionId -> { started_at, ended_at, status, events: [], total_doors, total_sales, total_convos, ... }
  
  for (let row of rs) {
    const payload = JSON.parse(row.payload);
    
    if (row.type === 'DAY_START') {
      const sId = payload.session_id;
      if (!sessionsMap[sId]) {
        sessionsMap[sId] = {
          session_id: sId,
          session_date: payload.session_date,
          started_at: payload.start_time || row.created_at,
          status: 'ACTIVE',
          events: [], // Holds KNOCK & BREAK events
          total_doors: 0,
          total_sales: 0,
          total_convos: 0,
          territory: []
        };
      }
    } 
    else if (row.type === 'DAY_END') {
      const sId = payload.session_id;
      if (sessionsMap[sId]) {
        sessionsMap[sId].ended_at = payload.end_time || row.created_at;
        sessionsMap[sId].status = 'CLOSED';
        sessionsMap[sId].export_status = payload.export_status;
        sessionsMap[sId].export_url = payload.export_url;
      }
    }
    else if (row.type === 'KNOCK') {
      const sId = payload.session_id;
      if (sessionsMap[sId]) {
        // Build timeline item
        const item = {
          id: payload.event_id,
          type: 'KNOCK',
          time: payload.timestamp,
          address: `${payload.house_number || ''} ${payload.street_name || ''}`.trim(),
          outcome: payload.outcome_type,
          objection: payload.objection_type || payload.convo_status,
          callback_time: payload.callback_time,
          notes: payload.notes,
          lat: payload.lat,
          lng: payload.lng,
          synced: row.synced === 1
        };
        
        sessionsMap[sId].events.push(item);
        
        // Aggregations
        sessionsMap[sId].total_doors += 1;
        if (payload.outcome_type === 'CONVO') sessionsMap[sId].total_convos += 1;
        if (payload.outcome_type === 'SALE') {
            sessionsMap[sId].total_sales += 1;
            sessionsMap[sId].total_convos += 1; // Sales generally imply convos
        }
        
        // Push territory
        const street = payload.street_name;
        if (street && !sessionsMap[sId].territory.includes(street)) {
          sessionsMap[sId].territory.push(street);
        }
      }
    }
    else if (row.type === 'BREAK_START') {
      const sId = payload.session_id;
      if (sessionsMap[sId]) {
        sessionsMap[sId].events.push({
          id: payload.break_id,
          type: 'BREAK',
          time: payload.break_start_time,
          synced: row.synced === 1
        });
      }
    }
    else if (row.type === 'BREAK_END') {
      const sId = payload.session_id;
      if (sessionsMap[sId]) {
        const brk = sessionsMap[sId].events.find(e => e.type === 'BREAK' && e.id === payload.break_id);
        if (brk) {
          brk.duration = payload.duration;
        }
      }
    }
  }

  // Convert map to Array and sort descending by started_at
  const sessions = Object.values(sessionsMap).sort((a, b) => new Date(b.started_at) - new Date(a.started_at));
  
  // Sort events inside each session chronologically
  sessions.forEach(s => {
    s.events.sort((a, b) => new Date(a.time) - new Date(b.time));
  });

  return sessions;
}

/**
 * PULL SERVER DELTAS
 * Merges missing historic events from Supabase directly into OPFS.
 */
export async function forceSyncHistoryDeltas(repId) {
  if (!navigator.onLine || !repId) return false;
  
  const lastSyncStr = await getSyncTimestamp('history_sync_timestamp') || '1970-01-01T00:00:00.000Z';
  const PAGE_SIZE = 1000;
  let from = 0;
  let totalFetched = 0;
  let latestTimestamp = null;

  while (true) {
    const { data: serverEvents, error } = await supabase
      .from('events')
      .select('*')
      .eq('rep_id', repId)
      .gt('created_at', lastSyncStr)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("Failed to fetch history deltas:", error);
      break;
    }
    if (!serverEvents || serverEvents.length === 0) break;

    await bulkUpsertServerEvents(serverEvents);
    totalFetched += serverEvents.length;
    latestTimestamp = serverEvents[serverEvents.length - 1].created_at;

    if (serverEvents.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  if (totalFetched > 0) {
    console.log(`[History] Successfully synced ${totalFetched} events to local store.`);
    if (latestTimestamp) {
      await updateSyncTimestamp('history_sync_timestamp', latestTimestamp);
    }
    await derivePropertiesFromEvents();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('sync-local-events'));
    }
    return true;
  }
  
  return false;
}

/**
 * FETCH TEAM HISTORY
 * Queries Supabase events for DAY_START, DAY_END, KNOCK, BREAK_START, BREAK_END across all reps.
 * Folds them into structured team session records.
 */
export async function getTeamHistory() {
  if (!navigator.onLine) return [];
  
  try {
    // 1. Fetch reps profile mapping
    const { data: repsRes, error: repsError } = await supabase
      .from('reps')
      .select('user_id, display_name');

    if (repsError) {
      console.error('[History] Failed to fetch reps map for team history:', repsError);
      return [];
    }

    const repNameMap = {};
    (repsRes || []).forEach(r => {
      repNameMap[r.user_id] = r.display_name;
    });

    // 2. Paginate through ALL events — no date restriction
    const PAGE_SIZE = 1000;
    const serverEvents = [];
    let from = 0;

    while (true) {
      const { data, error } = await supabase
        .from('events')
        .select('event_id, rep_id, type, payload, created_at')
        .in('type', ['DAY_START', 'DAY_END', 'KNOCK', 'BREAK_START', 'BREAK_END'])
        .order('created_at', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);

      if (error) {
        console.error('[History] Failed to fetch team history events:', error);
        break;
      }

      if (!data || data.length === 0) break;
      serverEvents.push(...data);
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }

    // 3. Fold mechanism to group by session_id
    const sessionsMap = {};

    for (let row of serverEvents) {
      const payload = typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload;
      const repId = row.rep_id;
      const repName = repNameMap[repId] || 'Teammate';

      if (row.type === 'DAY_START') {
        const sId = payload.session_id;
        if (sId && !sessionsMap[sId]) {
          sessionsMap[sId] = {
            session_id: sId,
            rep_id: repId,
            rep_name: repName,
            session_date: payload.session_date,
            started_at: payload.start_time || row.created_at,
            status: 'ACTIVE',
            events: [],
            total_doors: 0,
            total_sales: 0,
            total_convos: 0,
            territory: []
          };
        }
      } 
      else if (row.type === 'DAY_END') {
        const sId = payload.session_id;
        if (sId && sessionsMap[sId]) {
          sessionsMap[sId].ended_at = payload.end_time || row.created_at;
          sessionsMap[sId].status = 'CLOSED';
          sessionsMap[sId].export_status = payload.export_status;
          sessionsMap[sId].export_url = payload.export_url;
        }
      }
      else if (row.type === 'KNOCK') {
        const sId = payload.session_id;
        if (sId) {
          if (!sessionsMap[sId]) {
            const dateOnly = new Date(row.created_at).toISOString().split('T')[0];
            sessionsMap[sId] = {
              session_id: sId,
              rep_id: repId,
              rep_name: repName,
              session_date: dateOnly,
              started_at: row.created_at,
              status: 'CLOSED', // assume closed if no DAY_START event was captured
              events: [],
              total_doors: 0,
              total_sales: 0,
              total_convos: 0,
              territory: []
            };
          }

          const item = {
            id: row.event_id,
            type: 'KNOCK',
            time: payload.timestamp || row.created_at,
            address: `${payload.house_number || ''} ${payload.street_name || ''}`.trim(),
            outcome: payload.outcome_type,
            objection: payload.objection_type || payload.convo_status,
            callback_time: payload.callback_time,
            notes: payload.notes,
            lat: payload.lat,
            lng: payload.lng,
            synced: true
          };
          
          sessionsMap[sId].events.push(item);
          sessionsMap[sId].total_doors += 1;
          if (payload.outcome_type === 'CONVO') sessionsMap[sId].total_convos += 1;
          if (payload.outcome_type === 'SALE') {
            sessionsMap[sId].total_sales += 1;
            sessionsMap[sId].total_convos += 1;
          }
          
          const street = payload.street_name;
          if (street && !sessionsMap[sId].territory.includes(street)) {
            sessionsMap[sId].territory.push(street);
          }
        }
      }
      else if (row.type === 'BREAK_START') {
        const sId = payload.session_id;
        if (sId && sessionsMap[sId]) {
          sessionsMap[sId].events.push({
            id: payload.break_id,
            type: 'BREAK',
            time: payload.break_start_time || row.created_at,
            synced: true
          });
        }
      }
      else if (row.type === 'BREAK_END') {
        const sId = payload.session_id;
        if (sId && sessionsMap[sId]) {
          const brk = sessionsMap[sId].events.find(e => e.type === 'BREAK' && e.id === payload.break_id);
          if (brk) {
            brk.duration = payload.duration;
          }
        }
      }
    }

    // Convert map to array and sort by start time descending
    const sessions = Object.values(sessionsMap).sort(
      (a, b) => new Date(b.started_at) - new Date(a.started_at)
    );

    // Sort events within each session
    sessions.forEach(s => {
      s.events.sort((a, b) => new Date(a.time) - new Date(b.time));
    });

    return sessions;
  } catch (err) {
    console.error('[History] Error in getTeamHistory:', err);
    return [];
  }
}
