'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { salesDB } from '@/lib/sales/db';
import { Clock, Calendar, CheckCircle2, DollarSign, TrendingUp } from 'lucide-react';

interface HistoryTabProps {
  user: any;
  repName: string;
}

export default function HistoryTab({ user, repName }: HistoryTabProps) {
  const [personalKnocks, setPersonalKnocks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadHistory() {
      const supabase = createClient();
      const todayStr = new Date().toISOString().split('T')[0];

      const { data } = await supabase
        .from('events')
        .select('*')
        .eq('type', 'KNOCK')
        .eq('rep_id', user.id)
        .gte('created_at', todayStr + 'T00:00:00.000Z')
        .order('created_at', { ascending: false });

      setPersonalKnocks(data || []);
      setLoading(false);
    }
    loadHistory();
  }, [user.id]);

  const salesCount = personalKnocks.filter(k => {
    const p = typeof k.payload === 'string' ? JSON.parse(k.payload) : k.payload;
    return p.outcome_type === 'SALE';
  }).length;

  return (
    <div className="flex flex-col h-full bg-[#0a0f1d] text-white p-4 space-y-4 overflow-y-auto">
      {/* Shift Overview Card */}
      <div className="bg-[#121a2f] border border-white/10 p-5 rounded-2xl space-y-3">
        <h3 className="text-base font-bold text-white flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-400" /> Today’s Field Performance
        </h3>

        <div className="grid grid-cols-3 gap-2 pt-1">
          <div className="bg-[#0a0f1d] p-3 rounded-xl border border-white/5 text-center">
            <div className="text-xl font-black text-white font-mono">{personalKnocks.length}</div>
            <div className="text-[11px] text-slate-400 font-medium mt-0.5">Doors Logged</div>
          </div>
          <div className="bg-[#0a0f1d] p-3 rounded-xl border border-white/5 text-center">
            <div className="text-xl font-black text-emerald-400 font-mono">{salesCount}</div>
            <div className="text-[11px] text-slate-400 font-medium mt-0.5">Deals Closed</div>
          </div>
          <div className="bg-[#0a0f1d] p-3 rounded-xl border border-white/5 text-center">
            <div className="text-xl font-black text-amber-300 font-mono">
              {personalKnocks.length > 0 ? ((salesCount / personalKnocks.length) * 100).toFixed(1) : 0}%
            </div>
            <div className="text-[11px] text-slate-400 font-medium mt-0.5">Close Rate</div>
          </div>
        </div>
      </div>

      {/* Activity Log */}
      <div className="space-y-2">
        <div className="text-xs font-medium text-slate-400 px-1">Recent Knock Log (Today)</div>

        {personalKnocks.length === 0 ? (
          <div className="text-center py-10 text-slate-500 text-sm">
            No knocks logged yet today.
          </div>
        ) : (
          personalKnocks.map(k => {
            const p = typeof k.payload === 'string' ? JSON.parse(k.payload) : k.payload;
            const isSale = p.outcome_type === 'SALE';
            const isAssess = p.outcome_type === 'WALKTHROUGH_BOOKED';

            return (
              <div
                key={k.event_id}
                className="bg-[#121a2f] border border-white/10 p-3.5 rounded-2xl flex items-center justify-between text-xs shadow-sm"
              >
                <div>
                  <div className="font-bold text-white text-sm">
                    {p.mode === 'commercial' && p.company_name
                      ? p.company_name
                      : `${p.house_number || ''} ${p.street_name || ''}`}
                  </div>
                  <div className="text-slate-400 text-[11px] mt-0.5">
                    {p.street_name} {p.unit_number ? `· #${p.unit_number}` : ''}
                  </div>
                </div>

                <div className="text-right">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      isSale
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : isAssess
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {p.outcome_type}
                  </span>
                  <div className="text-[10px] text-slate-500 mt-1">
                    {new Date(p.timestamp || k.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
