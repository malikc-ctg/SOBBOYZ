'use client';

/**
 * Sea of Blue — Sales OS Offline Storage (IndexedDB)
 * High-performance, zero-friction client-side event outbox.
 * Replaces WASM SQLite for seamless Next.js SSR and PWA compatibility.
 */

const DB_NAME = 'sob_sales_offline_db';
const DB_VERSION = 1;

export interface SalesOutboxEvent {
  event_id: string;
  type: 'DAY_START' | 'DAY_END' | 'KNOCK' | 'BREAK_START' | 'BREAK_END' | 'DELETED';
  payload: Record<string, any>;
  created_at: string;
  synced: 0 | 1;
  retry_count: number;
}

export interface CachedProperty {
  property_id: string;
  address: string;
  lat: number | null;
  lng: number | null;
  last_status: string;
  last_knocked_at: string;
  mode?: 'residential' | 'commercial';
  company_name?: string | null;
}

class SalesDatabase {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<IDBDatabase> | null = null;

  async getDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
        return reject(new Error('IndexedDB is not supported or disabled in this browser environment'));
      }

      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));

        request.onsuccess = () => {
          this.db = request.result;
          resolve(this.db);
        };

        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;

          // Events outbox
          if (!db.objectStoreNames.contains('events')) {
            const eventsStore = db.createObjectStore('events', { keyPath: 'event_id' });
            eventsStore.createIndex('synced', 'synced', { unique: false });
            eventsStore.createIndex('created_at', 'created_at', { unique: false });
          }

          // Properties cache for map pins
          if (!db.objectStoreNames.contains('properties')) {
            db.createObjectStore('properties', { keyPath: 'property_id' });
          }

          // Key-value settings & state
          if (!db.objectStoreNames.contains('state')) {
            db.createObjectStore('state', { keyPath: 'key' });
          }
        };
      } catch (openErr) {
        reject(openErr);
      }
    });

    return this.initPromise;
  }

  // Insert a generic event into the outbox
  async insertLocalEvent(event_id: string, type: SalesOutboxEvent['type'], payload: Record<string, any>): Promise<void> {
    const db = await this.getDB();
    const created_at = new Date().toISOString();
    const eventRecord: SalesOutboxEvent = {
      event_id,
      type,
      payload,
      created_at,
      synced: 0,
      retry_count: 0,
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction(['events'], 'readwrite');
      const store = tx.objectStore('events');
      const req = store.put(eventRecord);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // Get pending events needing sync to Supabase
  async getPendingEvents(): Promise<SalesOutboxEvent[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['events'], 'readonly');
      const store = tx.objectStore('events');
      const req = store.getAll();

      req.onsuccess = () => {
        const all: SalesOutboxEvent[] = req.result || [];
        const pending = all
          .filter(e => e.synced === 0 && e.retry_count < 5)
          .sort((a, b) => (a.created_at > b.created_at ? 1 : -1))
          .slice(0, 100);
        resolve(pending);
      };
      req.onerror = () => reject(req.error);
    });
  }

  // Mark event as synced
  async markEventSynced(event_id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['events'], 'readwrite');
      const store = tx.objectStore('events');
      const getReq = store.get(event_id);

      getReq.onsuccess = () => {
        if (!getReq.result) return resolve();
        const updated = { ...getReq.result, synced: 1 };
        const putReq = store.put(updated);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  // Increment retry count
  async incrementEventRetry(event_id: string): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['events'], 'readwrite');
      const store = tx.objectStore('events');
      const getReq = store.get(event_id);

      getReq.onsuccess = () => {
        if (!getReq.result) return resolve();
        const updated = { ...getReq.result, retry_count: (getReq.result.retry_count || 0) + 1 };
        const putReq = store.put(updated);
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  }

  // Upsert local property pin cache
  async upsertProperty(prop: CachedProperty): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['properties'], 'readwrite');
      const store = tx.objectStore('properties');
      const req = store.put(prop);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  // Get all cached property pins
  async getAllProperties(): Promise<CachedProperty[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['properties'], 'readonly');
      const store = tx.objectStore('properties');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  // State store helper
  async setState(key: string, value: any): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['state'], 'readwrite');
      const store = tx.objectStore('state');
      const req = store.put({ key, value });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  async getState<T = any>(key: string): Promise<T | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['state'], 'readonly');
      const store = tx.objectStore('state');
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ? req.result.value : null);
      req.onerror = () => reject(req.error);
    });
  }
}

export const salesDB = new SalesDatabase();
