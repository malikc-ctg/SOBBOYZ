import { supabase } from './supabase';
import { 
  getPendingEvents, 
  markEventSynced, 
  incrementEventRetry,
  getSyncTimestamp,
  updateSyncTimestamp,
  bulkUpsertServerEvents,
  sqlocal,
  insertLocalEvent
} from './db';
import { derivePropertiesFromEvents } from './propertyService';

const SYNC_INTERVAL_MS = 15000; // 15 seconds (battery-optimized)
const MAX_RETRIES = 5;

class SyncEngine {
  constructor() {
    this.intervalId = null;
    this.isRunning = false;
    this.userId = null;
    this.listeners = new Set();
  }

  setUserId(id) {
    this.userId = id;
  }

  start() {
    if (this.intervalId) return;
    console.log('[SyncEngine] Started.');
    this.intervalId = setInterval(() => this.runSync(), SYNC_INTERVAL_MS);
    // Run immediately on start
    this.runSync();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[SyncEngine] Stopped.');
    }
  }

  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    for (let callback of this.listeners) {
      callback();
    }
  }

  async runSync() {
    if (this.isRunning || !navigator.onLine || !this.userId) return;
    this.isRunning = true;
    
    try {
      await this.pushPendingEvents();
      await this.pullDeltaEvents();
    } catch (err) {
      console.error('[SyncEngine] Sync cycle error:', err);
    } finally {
      this.notify();
      this.isRunning = false;
    }
  }

  async pushPendingEvents() {
    const pending = await getPendingEvents();
    if (pending.length === 0) return;

    console.log(`[SyncEngine] Found ${pending.length} pending events to sync.`);

    // Batch process: 25 at a time for faster round-trips
    const batchSize = 25;
    for (let i = 0; i < pending.length; i += batchSize) {
      const batch = pending.slice(i, i + batchSize);
      
      const payload = batch.map(e => ({
        event_id: e.event_id,
        rep_id: this.userId,
        type: e.type,
        payload: JSON.parse(e.payload),
        created_at: e.created_at
      }));

      // Use upsert to prevent duplicates on retries
      const { error } = await supabase
        .from('events')
        .upsert(payload, { onConflict: 'event_id' });

      if (error) {
        console.error('[SyncEngine] Batch sync failed:', error);
        // Mark retries concurrently instead of sequentially
        await Promise.all(batch.map(e => incrementEventRetry(e.event_id)));
      } else {
        // Mark synced concurrently instead of sequentially
        await Promise.all(batch.map(e => markEventSynced(e.event_id)));
        console.log(`[SyncEngine] Successfully synced batch of ${batch.length} events.`);
      }
    }
  }

  async pullDeltaEvents() {
    if (!this.userId) return;
    try {
      const lastSync = await getSyncTimestamp('sync_engine_last_pull') || '1970-01-01T00:00:00.000Z';
      const PAGE_SIZE = 1000;
      let from = 0;
      let totalPulled = 0;
      let latestTimestamp = null;

      while (true) {
        const { data, error } = await supabase
          .from('events')
          .select('event_id, type, payload, created_at, rep_id')
          .eq('rep_id', this.userId)
          .gt('created_at', lastSync)
          .order('created_at', { ascending: true })
          .range(from, from + PAGE_SIZE - 1);

        if (error) {
          console.error('[SyncEngine] Pull error:', error);
          break;
        }
        if (!data || data.length === 0) break;

        await bulkUpsertServerEvents(data);
        totalPulled += data.length;
        latestTimestamp = data[data.length - 1].created_at;

        if (data.length < PAGE_SIZE) break;
        from += PAGE_SIZE;
      }

      if (totalPulled > 0) {
        console.log(`[SyncEngine] Successfully pulled and stored ${totalPulled} events from Supabase.`);
        if (latestTimestamp) {
          await updateSyncTimestamp('sync_engine_last_pull', latestTimestamp);
        }
        await derivePropertiesFromEvents();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('sync-local-events'));
        }
      }
    } catch (e) {
      console.error('[SyncEngine] pullDeltaEvents error:', e);
    }
  }
}

export const syncEngine = new SyncEngine();
