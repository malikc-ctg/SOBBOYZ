'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import { salesSyncEngine } from '@/lib/sales/sync-engine';
import { DoorOpen, Map as MapIcon, Users, History, Loader2, Sparkles } from 'lucide-react';
import LoggerTab from '@/components/sales/LoggerTab';
import TeamTab from '@/components/sales/TeamTab';
import HistoryTab from '@/components/sales/HistoryTab';

// Dynamic import for MapTab to avoid SSR window issues
const MapTab = dynamic(() => import('@/components/sales/MapTab'), {
  ssr: false,
  loading: () => (
    <div className="flex-1 flex items-center justify-center bg-[#0a0f1d] text-slate-400">
      <Loader2 className="w-6 h-6 animate-spin" />
    </div>
  ),
});

export default function SalesPortalPage() {
  const [activeTab, setActiveTab] = useState<'KNOCK' | 'MAP' | 'TEAM' | 'HISTORY'>('KNOCK');
  const [user, setUser] = useState<any>(null);
  const [repName, setRepName] = useState<string>('Sales Rep');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function loadUserSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Fallback demo user for local testing if not logged in
        setUser({ id: '00000000-0000-0000-0000-000000000001', email: 'sales@seaofblue.ca' });
        setRepName('Sales Rep');
        salesSyncEngine.setUserId('00000000-0000-0000-0000-000000000001');
        salesSyncEngine.start();
        setLoading(false);
        return;
      }

      setUser(session.user);
      salesSyncEngine.setUserId(session.user.id);
      salesSyncEngine.start();

      // Look up rep name in employees
      const { data: emp } = await supabase
        .from('employees')
        .select('full_name')
        .eq('user_id', session.user.id)
        .maybeSingle();

      setRepName(emp?.full_name || session.user.email?.split('@')[0] || 'Sales Rep');
      setLoading(false);
    }

    loadUserSession();

    return () => {
      salesSyncEngine.stop();
    };
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-screen bg-[#0a0f1d] flex flex-col items-center justify-center text-white gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <div className="text-sm font-medium text-slate-400">Loading Sales OS...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-[#0a0f1d] overflow-hidden select-none font-sans">
      {/* Active Tab View */}
      <div className="flex-1 overflow-hidden relative">
        <div style={{ display: activeTab === 'KNOCK' ? 'block' : 'none', height: '100%' }}>
          <LoggerTab user={user} repName={repName} />
        </div>
        <div style={{ display: activeTab === 'MAP' ? 'block' : 'none', height: '100%' }}>
          <MapTab user={user} repName={repName} />
        </div>
        <div style={{ display: activeTab === 'TEAM' ? 'block' : 'none', height: '100%' }}>
          <TeamTab user={user} repName={repName} />
        </div>
        <div style={{ display: activeTab === 'HISTORY' ? 'block' : 'none', height: '100%' }}>
          <HistoryTab user={user} repName={repName} />
        </div>
      </div>

      {/* Pinned Bottom Navigation */}
      <nav className="h-16 bg-[#0d1424] border-t border-white/10 flex items-center justify-around px-2 z-30">
        <button
          onClick={() => setActiveTab('KNOCK')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
            activeTab === 'KNOCK' ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <DoorOpen className={`w-5 h-5 ${activeTab === 'KNOCK' ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px] font-semibold mt-0.5">Knock</span>
        </button>

        <button
          onClick={() => setActiveTab('MAP')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
            activeTab === 'MAP' ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MapIcon className={`w-5 h-5 ${activeTab === 'MAP' ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px] font-semibold mt-0.5">Map</span>
        </button>

        <button
          onClick={() => setActiveTab('TEAM')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
            activeTab === 'TEAM' ? 'text-indigo-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className={`w-5 h-5 ${activeTab === 'TEAM' ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px] font-semibold mt-0.5">Team & B2B</span>
        </button>

        <button
          onClick={() => setActiveTab('HISTORY')}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-xl transition-all ${
            activeTab === 'HISTORY' ? 'text-blue-400' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className={`w-5 h-5 ${activeTab === 'HISTORY' ? 'stroke-[2.5]' : ''}`} />
          <span className="text-[10px] font-semibold mt-0.5">History</span>
        </button>
      </nav>
    </div>
  );
}
