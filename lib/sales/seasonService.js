import { sqlocal, insertLocalEvent } from './db';
import { MODES } from './modes';

const SEASON_STORAGE_KEY = 'knocklog_residential_seasons';

export function getSeasonsState() {
  if (typeof window === 'undefined') {
    return {
      activeSeason: { id: 'season_active', name: 'Current Active Campaign', startedAt: new Date().toISOString() },
      archivedSeasons: []
    };
  }

  try {
    const raw = localStorage.getItem(SEASON_STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('[SeasonService] Failed to read seasons state:', e);
  }

  // Default initial state:
  return {
    activeSeason: {
      id: 'season_window_2026',
      name: '2026 Window Cleaning Season',
      startedAt: '2026-03-01T00:00:00.000Z'
    },
    archivedSeasons: []
  };
}

export async function wrapUpSeason({
  endingSeasonName = '2026 Window Cleaning Season',
  newSeasonName = 'Fall Gutter & Off-Season Canvassing',
  repId = null,
  summary = null
}) {
  const currentState = getSeasonsState();
  const now = new Date().toISOString();

  const archivedEntry = {
    id: currentState.activeSeason?.id || ('season_' + Date.now()),
    name: endingSeasonName,
    endedAt: now,
    startedAt: currentState.activeSeason?.startedAt || '2026-03-01T00:00:00.000Z',
    summary: summary || { doors: 0, sales: 0, convos: 0 }
  };

  const newActiveSeason = {
    id: 'season_' + Date.now(),
    name: newSeasonName,
    startedAt: now
  };

  const nextState = {
    activeSeason: newActiveSeason,
    archivedSeasons: [archivedEntry, ...(currentState.archivedSeasons || [])]
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(SEASON_STORAGE_KEY, JSON.stringify(nextState));
    } catch (e) {
      console.warn('[SeasonService] Save state failed:', e);
    }
  }

  // Record an event in the local event store
  const eventId = crypto.randomUUID();
  const payload = {
    event_id: eventId,
    mode: MODES.RESIDENTIAL,
    rep_id: repId,
    timestamp: now,
    archived_season: archivedEntry,
    new_active_season: newActiveSeason
  };

  try {
    await insertLocalEvent(eventId, 'SEASON_WRAP_UP', payload);
  } catch (e) {
    console.warn('[SeasonService] Failed to insert SEASON_WRAP_UP event:', e);
  }

  // Close any active residential session locally so field reps start fresh
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('season-wrapped-up', { detail: nextState }));
  }

  return nextState;
}

export function exportSeasonCSV(sessions, seasonName = 'Residential Knock Log') {
  if (!sessions || sessions.length === 0) return;

  const rows = [
    ['Representative', 'Date', 'Time', 'Street', 'House Number', 'Outcome', 'Objection/Status', 'Callback Time', 'Notes']
  ];

  sessions.forEach(s => {
    const rep = s.rep_name || 'Sales Rep';
    (s.events || []).forEach(e => {
      if (e.type === 'KNOCK') {
        const d = new Date(e.time || s.started_at);
        const hMatch = (e.address || '').match(/^(\d+\w*)\s+(.*)/);
        let house = '';
        let street = e.address || '';
        if (hMatch) {
          house = hMatch[1];
          street = hMatch[2];
        }

        rows.push([
          rep,
          d.toLocaleDateString(),
          d.toLocaleTimeString(),
          street,
          house,
          e.outcome || '',
          e.objection || '',
          e.callback_time ? new Date(e.callback_time).toLocaleString() : '',
          e.notes || ''
        ]);
      }
    });
  });

  const csvContent = rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  const safeName = seasonName.replace(/[^a-z0-9]/gi, '_');
  a.download = `KnockLog_${safeName}_Export_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
