// High-performance IndexedDB-backed drop-in replacement for sqlocal
// Compatible with Next.js SSR, PWA, Safari, Chrome, and iOS WebView without COOP/COEP headers.

const DB_NAME = 'knocklog-local-db';
const DB_VERSION = 1;

let dbInstance = null;
let dbPromise = null;

function getIDB() {
  if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  if (dbInstance) return Promise.resolve(dbInstance);
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('events')) {
          const s = db.createObjectStore('events', { keyPath: 'event_id' });
          s.createIndex('synced', 'synced', { unique: false });
          s.createIndex('created_at', 'created_at', { unique: false });
          s.createIndex('type', 'type', { unique: false });
        }
        if (!db.objectStoreNames.contains('properties')) {
          db.createObjectStore('properties', { keyPath: 'property_id' });
        }
        if (!db.objectStoreNames.contains('sync_state')) {
          db.createObjectStore('sync_state', { keyPath: 'key' });
        }
      };

      request.onsuccess = (e) => {
        dbInstance = e.target.result;
        resolve(dbInstance);
      };

      request.onerror = (e) => {
        console.warn('[KnockLog DB] IndexedDB open error:', e.target.error);
        resolve(null);
      };
    } catch (err) {
      console.warn('[KnockLog DB] IndexedDB exception:', err);
      resolve(null);
    }
  });

  return dbPromise;
}

// In-memory fallback if IndexedDB is blocked
const memStore = {
  events: new Map(),
  properties: new Map(),
  sync_state: new Map(),
};

// ── Drop-in sqlocal template tag parser ──
export const sqlocal = {
  sql: async (strings, ...values) => {
    const rawSql = strings.reduce((acc, str, i) => acc + str + (values[i] !== undefined ? `__VAL_${i}__` : ''), '').trim();
    const db = await getIDB();

    // 1. SELECT * FROM events ORDER BY created_at ASC
    if (rawSql.includes('SELECT * FROM events') && rawSql.includes('ORDER BY created_at ASC')) {
      if (!db) {
        return Array.from(memStore.events.values()).sort((a, b) => a.created_at.localeCompare(b.created_at));
      }
      return new Promise((resolve) => {
        const tx = db.transaction(['events'], 'readonly');
        const req = tx.objectStore('events').getAll();
        req.onsuccess = () => {
          const rows = req.result || [];
          rows.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
          resolve(rows);
        };
        req.onerror = () => resolve([]);
      });
    }

    // 2. SELECT COUNT(*) as count FROM events WHERE synced = 0
    if (rawSql.includes('SELECT COUNT(*) as count FROM events WHERE synced = 0')) {
      if (!db) {
        const cnt = Array.from(memStore.events.values()).filter(e => e.synced === 0).length;
        return [{ count: cnt }];
      }
      return new Promise((resolve) => {
        const tx = db.transaction(['events'], 'readonly');
        const req = tx.objectStore('events').getAll();
        req.onsuccess = () => {
          const cnt = (req.result || []).filter(e => e.synced === 0).length;
          resolve([{ count: cnt }]);
        };
        req.onerror = () => resolve([{ count: 0 }]);
      });
    }

    // 3. SELECT * FROM events WHERE synced = 0 AND retry_count < 5
    if (rawSql.includes('FROM events WHERE synced = 0')) {
      if (!db) {
        return Array.from(memStore.events.values())
          .filter(e => e.synced === 0 && (e.retry_count || 0) < 5)
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .slice(0, 100);
      }
      return new Promise((resolve) => {
        const tx = db.transaction(['events'], 'readonly');
        const req = tx.objectStore('events').getAll();
        req.onsuccess = () => {
          const pending = (req.result || [])
            .filter(e => e.synced === 0 && (e.retry_count || 0) < 5)
            .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))
            .slice(0, 100);
          resolve(pending);
        };
        req.onerror = () => resolve([]);
      });
    }

    // 4. SELECT payload FROM events WHERE type = 'DAY_START' ORDER BY created_at DESC LIMIT 1
    if (rawSql.includes("WHERE type = 'DAY_START'") && rawSql.includes('LIMIT 1')) {
      if (!db) {
        const items = Array.from(memStore.events.values())
          .filter(e => e.type === 'DAY_START')
          .sort((a, b) => b.created_at.localeCompare(a.created_at));
        return items.length > 0 ? [{ payload: items[0].payload }] : [];
      }
      return new Promise((resolve) => {
        const tx = db.transaction(['events'], 'readonly');
        const req = tx.objectStore('events').getAll();
        req.onsuccess = () => {
          const items = (req.result || [])
            .filter(e => e.type === 'DAY_START')
            .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
          resolve(items.length > 0 ? [{ payload: items[0].payload }] : []);
        };
        req.onerror = () => resolve([]);
      });
    }

    // 5. SELECT payload FROM events WHERE type = 'DAY_END'
    if (rawSql.includes("WHERE type = 'DAY_END'")) {
      if (!db) {
        return Array.from(memStore.events.values()).filter(e => e.type === 'DAY_END').map(e => ({ payload: e.payload }));
      }
      return new Promise((resolve) => {
        const tx = db.transaction(['events'], 'readonly');
        const req = tx.objectStore('events').getAll();
        req.onsuccess = () => {
          const items = (req.result || []).filter(e => e.type === 'DAY_END').map(e => ({ payload: e.payload }));
          resolve(items);
        };
        req.onerror = () => resolve([]);
      });
    }

    // 6. SELECT payload, created_at FROM events WHERE type = 'KNOCK'
    if (rawSql.includes("FROM events WHERE type = 'KNOCK'")) {
      if (!db) {
        return Array.from(memStore.events.values()).filter(e => e.type === 'KNOCK').map(e => ({ payload: e.payload, created_at: e.created_at }));
      }
      return new Promise((resolve) => {
        const tx = db.transaction(['events'], 'readonly');
        const req = tx.objectStore('events').getAll();
        req.onsuccess = () => {
          const items = (req.result || []).filter(e => e.type === 'KNOCK').map(e => ({ payload: e.payload, created_at: e.created_at }));
          resolve(items);
        };
        req.onerror = () => resolve([]);
      });
    }

    // 7. SELECT * FROM properties WHERE lat IS NOT NULL
    if (rawSql.includes('FROM properties')) {
      if (!db) {
        return Array.from(memStore.properties.values()).filter(p => p.lat != null && p.lng != null);
      }
      return new Promise((resolve) => {
        const tx = db.transaction(['properties'], 'readonly');
        const req = tx.objectStore('properties').getAll();
        req.onsuccess = () => {
          const items = (req.result || []).filter(p => p.lat != null && p.lng != null);
          resolve(items);
        };
        req.onerror = () => resolve([]);
      });
    }

    // 8. UPDATE events SET payload = ... WHERE event_id = ...
    if (rawSql.startsWith('UPDATE events SET payload')) {
      const payloadVal = values[0];
      const eventIdVal = values[1];
      if (!db) {
        const e = memStore.events.get(eventIdVal);
        if (e) memStore.events.set(eventIdVal, { ...e, payload: typeof payloadVal === 'string' ? payloadVal : JSON.stringify(payloadVal), synced: 0 });
        return [];
      }
      return new Promise((resolve) => {
        const tx = db.transaction(['events'], 'readwrite');
        const store = tx.objectStore('events');
        const getReq = store.get(eventIdVal);
        getReq.onsuccess = () => {
          if (getReq.result) {
            const updated = {
              ...getReq.result,
              payload: typeof payloadVal === 'string' ? payloadVal : JSON.stringify(payloadVal),
              synced: 0,
            };
            store.put(updated);
          }
          resolve([]);
        };
        getReq.onerror = () => resolve([]);
      });
    }

    // 9. DELETE FROM events WHERE event_id = ...
    if (rawSql.startsWith('DELETE FROM events')) {
      const eventIdVal = values[0];
      if (!db) {
        memStore.events.delete(eventIdVal);
        return [];
      }
      return new Promise((resolve) => {
        const tx = db.transaction(['events'], 'readwrite');
        tx.objectStore('events').delete(eventIdVal);
        tx.oncomplete = () => resolve([]);
        tx.onerror = () => resolve([]);
      });
    }

    // Default fallback
    return [];
  }
};

export const initLocalSchema = async () => {
  await getIDB();
};

export async function insertLocalEvent(event_id, type, payload) {
  const created_at = new Date().toISOString();
  const record = {
    event_id,
    type,
    payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
    created_at,
    synced: 0,
    retry_count: 0
  };

  const db = await getIDB();
  if (!db) {
    memStore.events.set(event_id, record);
    return;
  }
  return new Promise((resolve) => {
    const tx = db.transaction(['events'], 'readwrite');
    tx.objectStore('events').put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export async function upsertServerEvent(event_id, type, payload, created_at) {
  const record = {
    event_id,
    type,
    payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
    created_at,
    synced: 1,
    retry_count: 0
  };

  const db = await getIDB();
  if (!db) {
    memStore.events.set(event_id, record);
    return;
  }
  return new Promise((resolve) => {
    const tx = db.transaction(['events'], 'readwrite');
    tx.objectStore('events').put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export async function getPendingEvents() {
  const db = await getIDB();
  if (!db) {
    return Array.from(memStore.events.values()).filter(e => e.synced === 0 && (e.retry_count || 0) < 5).slice(0, 100);
  }
  return new Promise((resolve) => {
    const tx = db.transaction(['events'], 'readonly');
    const req = tx.objectStore('events').getAll();
    req.onsuccess = () => {
      const items = (req.result || []).filter(e => e.synced === 0 && (e.retry_count || 0) < 5).slice(0, 100);
      resolve(items);
    };
    req.onerror = () => resolve([]);
  });
}

export async function markEventSynced(event_id) {
  const db = await getIDB();
  if (!db) {
    const e = memStore.events.get(event_id);
    if (e) memStore.events.set(event_id, { ...e, synced: 1 });
    return;
  }
  return new Promise((resolve) => {
    const tx = db.transaction(['events'], 'readwrite');
    const store = tx.objectStore('events');
    const getReq = store.get(event_id);
    getReq.onsuccess = () => {
      if (getReq.result) {
        store.put({ ...getReq.result, synced: 1 });
      }
      resolve();
    };
    getReq.onerror = () => resolve();
  });
}

export async function incrementEventRetry(event_id) {
  const db = await getIDB();
  if (!db) {
    const e = memStore.events.get(event_id);
    if (e) memStore.events.set(event_id, { ...e, retry_count: (e.retry_count || 0) + 1 });
    return;
  }
  return new Promise((resolve) => {
    const tx = db.transaction(['events'], 'readwrite');
    const store = tx.objectStore('events');
    const getReq = store.get(event_id);
    getReq.onsuccess = () => {
      if (getReq.result) {
        store.put({ ...getReq.result, retry_count: (getReq.result.retry_count || 0) + 1 });
      }
      resolve();
    };
    getReq.onerror = () => resolve();
  });
}

export async function getSyncTimestamp(key = 'last_sync_timestamp') {
  const db = await getIDB();
  if (!db) {
    const item = memStore.sync_state.get(key);
    return item?.value || null;
  }
  return new Promise((resolve) => {
    const tx = db.transaction(['sync_state'], 'readonly');
    const req = tx.objectStore('sync_state').get(key);
    req.onsuccess = () => resolve(req.result?.value || null);
    req.onerror = () => resolve(null);
  });
}

export async function updateSyncTimestamp(key = 'last_sync_timestamp', timestamp) {
  if (arguments.length === 1) {
    timestamp = key;
    key = 'last_sync_timestamp';
  }
  const db = await getIDB();
  if (!db) {
    memStore.sync_state.set(key, { key, value: timestamp });
    return;
  }
  return new Promise((resolve) => {
    const tx = db.transaction(['sync_state'], 'readwrite');
    tx.objectStore('sync_state').put({ key, value: timestamp });
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export async function upsertProperty({ property_id, address, lat, lng, last_status, last_knocked_at, last_rep_id, territory_id, knocked_today }) {
  const db = await getIDB();
  const record = { property_id, address, lat, lng, last_status, last_knocked_at, last_rep_id, territory_id, knocked_today };
  if (!db) {
    memStore.properties.set(property_id, record);
    return;
  }
  return new Promise((resolve) => {
    const tx = db.transaction(['properties'], 'readwrite');
    tx.objectStore('properties').put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

export async function getAllProperties() {
  const db = await getIDB();
  if (!db) {
    return Array.from(memStore.properties.values()).filter(p => p.lat != null && p.lng != null);
  }
  return new Promise((resolve) => {
    const tx = db.transaction(['properties'], 'readonly');
    const req = tx.objectStore('properties').getAll();
    req.onsuccess = () => {
      const items = (req.result || []).filter(p => p.lat != null && p.lng != null);
      resolve(items);
    };
    req.onerror = () => resolve([]);
  });
}

export async function updateLocalEvent(event_id, updatedPayload) {
  const db = await getIDB();
  const payloadStr = typeof updatedPayload === 'string' ? updatedPayload : JSON.stringify(updatedPayload);
  if (!db) {
    const e = memStore.events.get(event_id);
    if (e) memStore.events.set(event_id, { ...e, payload: payloadStr, synced: 0 });
    return;
  }
  return new Promise((resolve) => {
    const tx = db.transaction(['events'], 'readwrite');
    const store = tx.objectStore('events');
    const getReq = store.get(event_id);
    getReq.onsuccess = () => {
      if (getReq.result) {
        store.put({ ...getReq.result, payload: payloadStr, synced: 0 });
      }
      resolve();
    };
    getReq.onerror = () => resolve();
  });
}

export async function softDeleteLocalEvent(event_id) {
  const db = await getIDB();
  if (!db) {
    const e = memStore.events.get(event_id);
    if (e) memStore.events.set(event_id, { ...e, type: 'DELETED', synced: 0 });
    return;
  }
  return new Promise((resolve) => {
    const tx = db.transaction(['events'], 'readwrite');
    const store = tx.objectStore('events');
    const getReq = store.get(event_id);
    getReq.onsuccess = () => {
      if (getReq.result) {
        store.put({ ...getReq.result, type: 'DELETED', synced: 0 });
      }
      resolve();
    };
    getReq.onerror = () => resolve();
  });
}

initLocalSchema().catch(console.error);
