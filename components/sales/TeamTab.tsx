'use client';

import React, { useState, useEffect } from 'react';
import {
  getTeamLeaderboard, getTeamRadar, getCommercialOpportunities,
  updateOpportunityStage, RepLeaderboardRow, RadarItem, CommercialOpportunity
} from '@/lib/sales/sales-service';
import {
  Trophy, Radio, Briefcase, Calendar, CheckCircle2,
  DollarSign, ChevronRight, Clock, ArrowRight, Building, User
} from 'lucide-react';
import { toast } from 'sonner';

interface TeamTabProps {
  user: any;
  repName: string;
}

const ODOO_STAGES: { key: CommercialOpportunity['stage']; label: string; color: string }[] = [
  { key: 'knocked', label: '1. Knocked', color: 'border-slate-500 text-slate-300' },
  { key: 'walkthrough_scheduled', label: '2. Walkthrough', color: 'border-indigo-500 text-indigo-300' },
  { key: 'proposal_sent', label: '3. Proposal Sent', color: 'border-blue-500 text-blue-300' },
  { key: 'negotiation', label: '4. In Review', color: 'border-amber-500 text-amber-300' },
  { key: 'won', label: '5. Won Contract', color: 'border-emerald-500 text-emerald-300' },
];

export default function TeamTab({ user, repName }: TeamTabProps) {
  const [activeSubTab, setActiveSubTab] = useState<'leaderboard' | 'radar' | 'odoo_pipeline'>('leaderboard');
  const [timeFilter, setTimeFilter] = useState<'TODAY' | 'WEEK' | 'ALL_TIME'>('TODAY');
  const [modeFilter, setModeFilter] = useState<'all' | 'residential' | 'commercial'>('all');

  const [leaderboard, setLeaderboard] = useState<RepLeaderboardRow[]>([]);
  const [radar, setRadar] = useState<RadarItem[]>([]);
  const [pipelineOpps, setPipelineOpps] = useState<CommercialOpportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const [lb, rad, opps] = await Promise.all([
          getTeamLeaderboard(timeFilter, modeFilter),
          getTeamRadar(),
          getCommercialOpportunities(),
        ]);
        setLeaderboard(lb);
        setRadar(rad);
        setPipelineOpps(opps);
      } catch (err) {
        console.error('Failed to load team data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [timeFilter, modeFilter]);

  const handleAdvanceStage = async (opp: CommercialOpportunity) => {
    const currentIndex = ODOO_STAGES.findIndex(s => s.key === opp.stage);
    if (currentIndex >= ODOO_STAGES.length - 1) return;

    const nextStage = ODOO_STAGES[currentIndex + 1].key;
    try {
      await updateOpportunityStage(opp.id, nextStage);
      setPipelineOpps(prev =>
        prev.map(item => (item.id === opp.id ? { ...item, stage: nextStage } : item))
      );
      toast.success(`Moved ${opp.company_name} to ${ODOO_STAGES[currentIndex + 1].label}!`);
    } catch (e: any) {
      toast.error('Failed to update stage');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0f1d] text-white">
      {/* Sub-navigation */}
      <div className="p-3 bg-[#11192e] border-b border-white/10 flex items-center justify-between gap-2">
        <div className="flex bg-[#0a0f1d] p-1 rounded-xl border border-white/10">
          <button
            onClick={() => setActiveSubTab('leaderboard')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeSubTab === 'leaderboard' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" /> Leaderboard
          </button>
          <button
            onClick={() => setActiveSubTab('odoo_pipeline')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeSubTab === 'odoo_pipeline' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" /> B2B Pipeline
          </button>
          <button
            onClick={() => setActiveSubTab('radar')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeSubTab === 'radar' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5" /> Live Radar
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* ============================================================== */}
        {/* LEADERBOARD VIEW                                               */}
        {/* ============================================================== */}
        {activeSubTab === 'leaderboard' && (
          <div className="space-y-3">
            {/* Filters */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-1 bg-[#121a2f] p-1 rounded-xl border border-white/10">
                {(['TODAY', 'WEEK', 'ALL_TIME'] as const).map(tf => (
                  <button
                    key={tf}
                    onClick={() => setTimeFilter(tf)}
                    className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg ${
                      timeFilter === tf ? 'bg-blue-600 text-white' : 'text-slate-400'
                    }`}
                  >
                    {tf === 'TODAY' ? 'Today' : tf === 'WEEK' ? 'Week' : 'All-Time'}
                  </button>
                ))}
              </div>

              <div className="flex gap-1 bg-[#121a2f] p-1 rounded-xl border border-white/10">
                {(['all', 'residential', 'commercial'] as const).map(mf => (
                  <button
                    key={mf}
                    onClick={() => setModeFilter(mf)}
                    className={`px-2 py-1 text-[11px] font-semibold rounded-lg ${
                      modeFilter === mf ? 'bg-slate-700 text-white' : 'text-slate-400'
                    }`}
                  >
                    {mf === 'all' ? 'All' : mf === 'residential' ? 'Resi' : 'B2B'}
                  </button>
                ))}
              </div>
            </div>

            {/* Rep Scorecards */}
            {leaderboard.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                No knocks logged for this period yet. Start walking!
              </div>
            ) : (
              leaderboard.map((row, idx) => (
                <div
                  key={row.rep_id}
                  className="bg-[#121a2f] border border-white/10 p-4 rounded-2xl flex items-center justify-between shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs ${
                        idx === 0
                          ? 'bg-amber-400 text-slate-900 font-extrabold'
                          : idx === 1
                          ? 'bg-slate-300 text-slate-900'
                          : idx === 2
                          ? 'bg-amber-700 text-white'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {idx + 1}
                    </div>
                    <div>
                      <div className="font-bold text-sm text-white">{row.rep_name}</div>
                      <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                        <span>🚪 {row.doors} doors</span>
                        <span>·</span>
                        <span>💬 {row.convos} convos</span>
                        {row.walkthroughs_booked > 0 && (
                          <>
                            <span>·</span>
                            <span className="text-indigo-400 font-semibold">📅 {row.walkthroughs_booked} assess</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-base font-bold text-emerald-400">
                      {row.mrr > 0 ? `$${row.mrr}/mo` : `$${row.revenue}`}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 font-medium">
                      Est. Comm: <span className="text-amber-300 font-bold">${Math.round(row.commission)}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* SALES OS B2B PIPELINE VIEW                                */}
        {/* ============================================================== */}
        {activeSubTab === 'odoo_pipeline' && (
          <div className="space-y-3">
            <div className="text-xs text-slate-400 font-medium px-1 flex items-center justify-between">
              <span>B2B Opportunities ({pipelineOpps.length})</span>
              <span className="text-indigo-400">Sales OS Pipeline</span>
            </div>

            {pipelineOpps.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                No commercial opportunities logged yet. Flip to Commercial mode to book walkthroughs!
              </div>
            ) : (
              pipelineOpps.map(opp => (
                <div
                  key={opp.id}
                  className="bg-[#121a2f] border border-white/10 p-4 rounded-2xl space-y-3 shadow-sm"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold text-sm text-white flex items-center gap-1.5">
                        <Building className="w-3.5 h-3.5 text-indigo-400" /> {opp.company_name}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {opp.address} {opp.unit_number ? `· ${opp.unit_number}` : ''}
                      </div>
                    </div>

                    <div className="px-2.5 py-1 rounded-lg text-xs font-semibold border bg-indigo-500/10 border-indigo-500/30 text-indigo-300">
                      {opp.stage.replace('_', ' ').toUpperCase()}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="grid grid-cols-2 gap-2 text-xs bg-[#0a0f1d] p-2.5 rounded-xl border border-white/5">
                    <div>
                      <span className="text-slate-500">Contact:</span>{' '}
                      <span className="text-slate-300 font-medium">{opp.dm_name || 'Front Desk'}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Est. MRR:</span>{' '}
                      <span className="text-emerald-400 font-bold">{opp.expected_mrr ? `$${opp.expected_mrr}/mo` : 'TBD'}</span>
                    </div>
                    {opp.walkthrough_date && (
                      <div className="col-span-2 text-amber-300 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Walkthrough: {new Date(opp.walkthrough_date).toLocaleString()}
                      </div>
                    )}
                  </div>

                  {/* Advance Stage Action Button */}
                  {opp.stage !== 'won' && (
                    <button
                      onClick={() => handleAdvanceStage(opp)}
                      className="w-full py-2 bg-[#1b2642] hover:bg-[#233154] text-xs font-semibold text-slate-200 rounded-xl border border-white/10 flex items-center justify-center gap-1.5"
                    >
                      Advance to Next Stage <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* RADAR VIEW                                                     */}
        {/* ============================================================== */}
        {activeSubTab === 'radar' && (
          <div className="space-y-3">
            <div className="text-xs text-slate-400 font-medium px-1">
              Live Team GPS Locations (Updated Today)
            </div>

            {radar.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-sm">
                No active reps on the field yet today.
              </div>
            ) : (
              radar.map(item => (
                <div
                  key={item.rep_id}
                  className="bg-[#121a2f] border border-white/10 p-3.5 rounded-2xl flex items-center justify-between shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
                    <div>
                      <div className="font-bold text-sm text-white">{item.rep_name}</div>
                      <div className="text-xs text-slate-400 mt-0.5">
                        {item.mode === 'commercial' && item.company_name ? item.company_name : item.street_name}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300">
                      {item.status}
                    </span>
                    <div className="text-[10px] text-slate-500 mt-1">
                      {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
