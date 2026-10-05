import React, { useState, useEffect } from 'react';
import {
  Users,
  Calendar,
  Clock,
  PhoneCall,
  PhoneIncoming,
  PhoneMissed,
  Target,
  Trophy,
  RefreshCw,
  Search,
  Copy,
  Check,
  FileText,
  BarChart3
} from 'lucide-react';
import { getTodayCallStats } from '@/lib/sales/phoneService';

export default function RepStatsView({ onOpenDossier, initialRep = 'all' }) {
  const [loading, setLoading] = useState(true);
  const [statsData, setStatsData] = useState(null);
  const [selectedPeriod, setSelectedPeriod] = useState('today'); // 'today' | 'yesterday' | 'week' | 'all' | 'custom'
  const [selectedRep, setSelectedRep] = useState(initialRep); // 'all' | repName
  const [selectedDate, setSelectedDate] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  // Fetch full stats whenever period, rep, or date changes
  async function loadStats() {
    setLoading(true);
    try {
      const data = await getTodayCallStats({
        period: selectedPeriod,
        rep: selectedRep,
        date: selectedDate
      });
      setStatsData(data);
    } catch (err) {
      console.error('[RepStatsView] Error loading stats:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStats();
  }, [selectedPeriod, selectedRep, selectedDate]);

  // Copy phone number helper
  const handleCopyPhone = (e, callId, phone) => {
    e.stopPropagation();
    if (!phone) return;
    try {
      if (navigator?.clipboard?.writeText) {
        navigator.clipboard.writeText(phone);
      }
    } catch {
      // fallback
    }
    setCopiedId(callId);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const byRep = statsData?.byRep || [];
  const byDate = statsData?.byDate || [];
  const repNames = statsData?.repNames || [];
  const calls = statsData?.calls || [];

  // Filter calls by search query
  const filteredCalls = calls.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.contact_name && c.contact_name.toLowerCase().includes(q)) ||
      (c.company_name && c.company_name.toLowerCase().includes(q)) ||
      (c.phone_number && c.phone_number.includes(q)) ||
      (c.rep_name && c.rep_name.toLowerCase().includes(q)) ||
      (c.outcome_type && c.outcome_type.toLowerCase().includes(q)) ||
      (c.notes && c.notes.toLowerCase().includes(q))
    );
  });

  // Calculate current period label
  let periodLabel = 'Today (Live Shift)';
  if (selectedDate) {
    const shift = byDate.find(d => d.date === selectedDate);
    periodLabel = shift ? `Shift: ${shift.label}` : `Date: ${selectedDate}`;
  } else if (selectedPeriod === 'yesterday') {
    periodLabel = 'Yesterday';
  } else if (selectedPeriod === 'week') {
    periodLabel = 'Past 7 Days';
  } else if (selectedPeriod === 'all') {
    periodLabel = 'All-Time';
  }

  return (
    <div className="space-y-6 pb-12 font-sans">
      
      {/* 1. TOP HEADER & CONTROLS BAR */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <BarChart3 size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <span>Rep Performance & Shift History</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-blue-950/80 border border-blue-800/80 text-blue-300">
                  {periodLabel}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Daily dials reset automatically at midnight. All historical shifts and rep metrics are permanently archived.
              </p>
            </div>
          </div>
        </div>

        {/* Period Selector Pills & Refresh */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="inline-flex rounded-xl bg-slate-950/90 border border-slate-800 p-1 text-xs">
            <button
              type="button"
              onClick={() => { setSelectedDate(null); setSelectedPeriod('today'); }}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                !selectedDate && selectedPeriod === 'today'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => { setSelectedDate(null); setSelectedPeriod('yesterday'); }}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                !selectedDate && selectedPeriod === 'yesterday'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Yesterday
            </button>
            <button
              type="button"
              onClick={() => { setSelectedDate(null); setSelectedPeriod('week'); }}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                !selectedDate && selectedPeriod === 'week'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              7 Days
            </button>
            <button
              type="button"
              onClick={() => { setSelectedDate(null); setSelectedPeriod('all'); }}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                !selectedDate && selectedPeriod === 'all'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All Time
            </button>
          </div>

          {/* Rep Filter Dropdown */}
          <div className="relative">
            <select
              value={selectedRep}
              onChange={e => setSelectedRep(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All Reps (Team)</option>
              {repNames.map(r => (
                <option key={r} value={r}>
                  Rep: {r}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={loadStats}
            className="p-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition"
            title="Refresh metrics"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin text-blue-400' : ''} />
          </button>
        </div>
      </div>

      {/* 2. PRIMARY KPI SUMMARY CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total Dials */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Dials Logged</span>
            <PhoneCall size={14} className="text-blue-400" />
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-white font-mono">{statsData?.dials ?? 0}</div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
              {!selectedDate && selectedPeriod === 'today' ? 'Resets at 00:00' : 'Total calls in view'}
            </div>
          </div>
        </div>

        {/* Pickups / Connects */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Pick Ups</span>
            <PhoneIncoming size={14} className="text-emerald-400" />
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-emerald-400 font-mono">{statsData?.pickups ?? 0}</div>
            <div className="text-[10px] text-emerald-400/90 font-mono font-bold mt-0.5">
              {statsData?.connectRate ?? '0.0'}% connect rate
            </div>
          </div>
        </div>

        {/* No Answers */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[10px]">No Answer</span>
            <PhoneMissed size={14} className="text-amber-400" />
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-amber-400 font-mono">{statsData?.noAnswers ?? 0}</div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
              {statsData?.dials > 0 ? `${Math.round(((statsData?.noAnswers || 0) / statsData.dials) * 100)}% of dials` : '0%'}
            </div>
          </div>
        </div>

        {/* Walkthroughs Booked */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Walkthroughs</span>
            <Target size={14} className="text-purple-400" />
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-purple-400 font-mono">{statsData?.walkthroughs ?? 0}</div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">Primary Target</div>
          </div>
        </div>

        {/* Quotes Sent */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Info / Quotes</span>
            <FileText size={14} className="text-cyan-400" />
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-cyan-400 font-mono">{statsData?.infoSent ?? 0}</div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">Pricing requests</div>
          </div>
        </div>

        {/* Jobs Won */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span className="font-semibold uppercase tracking-wider text-[10px]">Contracts Won</span>
            <Trophy size={14} className="text-emerald-300" />
          </div>
          <div className="mt-2.5">
            <div className="text-2xl font-black text-emerald-300 font-mono">{statsData?.jobsWon ?? 0}</div>
            <div className="text-[10px] text-emerald-300/90 font-mono font-bold mt-0.5">
              {statsData?.closeRate ?? '0.0'}% close rate
            </div>
          </div>
        </div>
      </div>

      {/* 3. REP SCORECARDS (Tracked via Reps) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <Users size={16} className="text-blue-400" />
            <span>Sales Rep Leaderboard & Performance</span>
          </h3>
          <span className="text-xs text-slate-400">
            {byRep.length} active reps tracked
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {byRep.map((rep, idx) => {
            const isSelected = selectedRep.toLowerCase() === rep.repName.toLowerCase();
            const initials = rep.repName
              .split(' ')
              .map(n => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase();

            return (
              <div
                key={rep.repName}
                onClick={() => setSelectedRep(isSelected ? 'all' : rep.repName)}
                className={`p-4 rounded-xl border transition cursor-pointer ${
                  isSelected
                    ? 'bg-blue-950/40 border-blue-500 shadow-md shadow-blue-500/10'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                {/* Rep Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center font-bold text-xs text-blue-400">
                      {initials}
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm flex items-center gap-1.5">
                        <span>{rep.repName}</span>
                        {idx === 0 && (
                          <span className="text-[10px] font-mono font-bold bg-amber-950/80 text-amber-300 border border-amber-800/80 px-1.5 py-0.2 rounded">
                            Top Rep
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {rep.lastCallAt ? `Last active ${new Date(rep.lastCallAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'No recent calls'}
                      </div>
                    </div>
                  </div>

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-400'
                      : 'bg-slate-950 text-slate-400 border-slate-800'
                  }`}>
                    {isSelected ? 'Focused' : 'Filter'}
                  </span>
                </div>

                {/* Rep Performance Stats Grid */}
                <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800/80 text-center">
                  <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/50">
                    <div className="text-xs text-slate-400">Today</div>
                    <div className="text-base font-black text-white font-mono mt-0.5">
                      {rep.todayDials}
                    </div>
                    <div className="text-[9px] text-slate-500">dials</div>
                  </div>

                  <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/50">
                    <div className="text-xs text-slate-400">All-Time</div>
                    <div className="text-base font-black text-blue-400 font-mono mt-0.5">
                      {rep.totalDials}
                    </div>
                    <div className="text-[9px] text-slate-500">dials</div>
                  </div>

                  <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/50">
                    <div className="text-xs text-slate-400">Connect Rate</div>
                    <div className="text-base font-black text-emerald-400 font-mono mt-0.5">
                      {rep.connectRate}%
                    </div>
                    <div className="text-[9px] text-slate-500">{rep.pickups} connects</div>
                  </div>
                </div>

                {/* Conversion Badges */}
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mt-3 pt-2 border-t border-slate-800/40">
                  <span>Walkthroughs: <strong className="text-purple-300">{rep.walkthroughs}</strong></span>
                  <span>Quotes: <strong className="text-cyan-300">{rep.infoSent}</strong></span>
                  <span>Deals Won: <strong className="text-emerald-300">{rep.jobsWon}</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 4. HISTORICAL SHIFTS ARCHIVE ("Saved After a Certain Time") */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Calendar size={16} className="text-blue-400" />
              <span>Saved Shifts & Daily History Archive</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Click any shift to load historical performance and inspect rep calls for that date.
            </p>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {byDate.length} shifts recorded
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {byDate.map(shift => {
            const isSelectedDate = selectedDate === shift.date;

            return (
              <div
                key={shift.date}
                onClick={() => {
                  if (isSelectedDate) {
                    setSelectedDate(null);
                  } else {
                    setSelectedDate(shift.date);
                  }
                }}
                className={`p-3.5 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                  isSelectedDate
                    ? 'bg-blue-950/50 border-blue-500 shadow-md shadow-blue-500/10'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="font-bold text-xs text-white">
                      {shift.label}
                    </span>
                    {shift.isToday && (
                      <span className="text-[9px] font-mono font-bold bg-blue-900/80 text-blue-300 px-1.5 py-0.5 rounded border border-blue-700/80">
                        LIVE
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-400 font-mono mb-2">
                    {shift.date}
                  </div>

                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Dials:</span>
                      <strong className="text-white font-mono">{shift.dials}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Connects:</span>
                      <strong className="text-emerald-400 font-mono">{shift.pickups} ({shift.connectRate}%)</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">No Answer:</span>
                      <strong className="text-amber-400 font-mono">{shift.noAnswers}</strong>
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
                  <span className="truncate max-w-[120px]">
                    {shift.reps.join(', ')}
                  </span>
                  <span className="text-blue-400 font-bold">
                    {isSelectedDate ? 'Active' : 'Inspect'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. CALL LOG ACTIVITY STREAM */}
      <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Clock size={16} className="text-blue-400" />
              <span>Shift Call Activity Log</span>
              <span className="text-xs text-slate-400 font-normal">
                ({filteredCalls.length} calls logged)
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Click any call or double-click to view the full contact dossier, transcript, and notes.
            </p>
          </div>

          {/* Search inside calls */}
          <div className="relative w-full sm:w-72">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search shift calls..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Calls Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800/80">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800/80 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <th className="py-2.5 px-3">Time</th>
                <th className="py-2.5 px-3">Sales Rep</th>
                <th className="py-2.5 px-3">Contact & Company</th>
                <th className="py-2.5 px-3">Phone</th>
                <th className="py-2.5 px-3">Call Outcome</th>
                <th className="py-2.5 px-3">Duration</th>
                <th className="py-2.5 px-3">Notes & Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredCalls.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500 text-xs">
                    No calls recorded for this filter criteria
                  </td>
                </tr>
              ) : (
                filteredCalls.map(c => {
                  let outcomeColor = 'bg-slate-900 text-slate-300 border-slate-800';
                  if (['WALKTHROUGH', 'WALKTHROUGH_BOOKED'].includes(c.outcome_type)) {
                    outcomeColor = 'bg-purple-950/80 text-purple-300 border-purple-800/80';
                  } else if (['SALE', 'JOB_WON', 'WON'].includes(c.outcome_type)) {
                    outcomeColor = 'bg-emerald-950/80 text-emerald-300 border-emerald-800/80';
                  } else if (['SEND_QUOTE', 'INFO_SENT'].includes(c.outcome_type)) {
                    outcomeColor = 'bg-cyan-950/80 text-cyan-300 border-cyan-800/80';
                  } else if (c.outcome_type === 'CONVO') {
                    outcomeColor = 'bg-blue-950/80 text-blue-300 border-blue-800/80';
                  } else if (c.outcome_type === 'NO_ANSWER') {
                    outcomeColor = 'bg-amber-950/80 text-amber-300 border-amber-800/80';
                  } else if (c.outcome_type === 'CALLBACK') {
                    outcomeColor = 'bg-violet-950/80 text-violet-300 border-violet-800/80';
                  }

                  const timeStr = c.created_at
                    ? new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '--:--';
                  const dateStr = c.created_at
                    ? new Date(c.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })
                    : '';

                  return (
                    <tr
                      key={c.event_id || Math.random()}
                      onClick={() => onOpenDossier && c.contact_id && onOpenDossier({ id: c.contact_id, name: c.contact_name, company: c.company_name, phone: c.phone_number })}
                      className="hover:bg-slate-800/40 transition cursor-pointer group"
                      title="Click to inspect lead dossier"
                    >
                      <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                        <span className="font-semibold text-slate-200">{timeStr}</span>
                        <span className="text-[10px] text-slate-500 ml-1.5">{dateStr}</span>
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap font-sans font-semibold text-slate-200">
                        {c.rep_name}
                      </td>

                      <td className="py-2.5 px-3 min-w-[160px] font-sans">
                        <div className="font-semibold text-white group-hover:text-blue-300 transition truncate max-w-[200px]">
                          {c.contact_name || 'Prospect'}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                          {c.company_name || 'Commercial Account'}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={e => handleCopyPhone(e, c.event_id, c.phone_number)}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-950 border border-slate-800 hover:border-blue-600 text-slate-300 hover:text-white transition group/phone"
                          title="Click to copy number"
                        >
                          <span>{c.phone_number || 'No number'}</span>
                          {copiedId === c.event_id ? (
                            <Check size={11} className="text-emerald-400" />
                          ) : (
                            <Copy size={11} className="text-slate-500 group-hover/phone:text-white" />
                          )}
                        </button>
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${outcomeColor}`}>
                          {c.outcome_type || 'DIAL'}
                        </span>
                      </td>

                      <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">
                        {c.duration_seconds ? `${c.duration_seconds}s` : '--'}
                      </td>

                      <td className="py-2.5 px-3 text-slate-300 font-sans max-w-[240px] truncate">
                        {c.notes || c.ai_summary || <span className="text-slate-600 italic">No notes</span>}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
