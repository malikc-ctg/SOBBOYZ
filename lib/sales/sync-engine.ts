'use client';

import { createClient } from '@/lib/supabase/client';
import { salesDB, SalesOutboxEvent } from './db';

const SYNC_INTERVAL_MS = 15000; // 15 seconds

class SalesSyncEngine {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private userId: string | null = null;
  private listeners = new Set<() => void>();
  private supabase = createClient();

  setUserId(id: string | null) {
    this.userId = id;
  }

  start() {
    if (this.intervalId || typeof window === 'undefined') return;
    console.log('[Sales OS] Background sync started');
    this.intervalId = setInterval(() => this.runSync(), SYNC_INTERVAL_MS);

    // Sync immediately on regaining network connection
    window.addEventListener('online', () => this.runSync());

    this.runSync();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('[Sales OS] Background sync stopped');
    }
  }

  subscribe(callback: () => void) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    this.listeners.forEach(callback => {
      try {
        callback();
      } catch (e) {
        console.error('[SalesSyncEngine] Listener error:', e);
      }
    });
  }

  async runSync() {
    if (this.isRunning || typeof navigator === 'undefined' || !navigator.onLine || !this.userId) {
      return;
    }
    this.isRunning = true;

    try {
      await this.pushPendingEvents();
    } catch (err) {
      console.error('[Sales OS] Sync cycle error:', err);
    } finally {
      this.notify();
      this.isRunning = false;
    }
  }

  async pushPendingEvents() {
    const pending = await salesDB.getPendingEvents();
    if (pending.length === 0) return;

    console.log(`[Sales OS] Syncing ${pending.length} events...`);

    const batchSize = 25;
    for (let i = 0; i < pending.length; i += batchSize) {
      const batch = pending.slice(i, i + batchSize);

      const rows = batch.map(e => ({
        event_id: e.event_id,
        rep_id: this.userId,
        type: e.type,
        payload: e.payload,
        created_at: e.created_at,
      }));

      const { error } = await this.supabase
        .from('events')
        .upsert(rows, { onConflict: 'event_id' });

      if (error) {
        console.error('[Sales OS] Batch sync failed:', error);
        await Promise.all(batch.map(e => salesDB.incrementEventRetry(e.event_id)));
      } else {
        await Promise.all(batch.map(e => salesDB.markEventSynced(e.event_id)));
        console.log(`[Sales OS] Successfully synced ${batch.length} events`);
      }
    }
  }
}

export const salesSyncEngine = new SalesSyncEngine();
