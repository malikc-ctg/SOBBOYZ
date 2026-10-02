'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import SalesLaunchpad from '@/components/sales/SalesLaunchpad';

const DispatchMap = dynamic(() => import('@/components/admin/dashboard/DispatchMap'), {
  ssr: false,
  loading: () => (
    <div className="flex h-96 items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  ),
});
import Logger from '@/components/sales/Logger';
import PhoneTab from '@/components/sales/phone/PhoneTab';
import HistoryTab from '@/components/sales/history/HistoryTab';
import MapTab from '@/components/sales/map/MapTab';
import TeamTab from '@/components/sales/team/TeamTab';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  LayoutGrid, ArrowLeft, Home, Building2, 
  PhoneCall, Map, Trophy, Compass, Clock, Users, RefreshCw
} from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@/components/sales/styles/knocklog.css';
import '@/components/sales/mapStyles.css';
import '@/components/sales/team/teamStyles.css';
import '@/components/sales/historyStyles.css';
import '@/components/sales/salesLayout.css';
import '@/components/sales/phone/phoneStyles.css';
import '@/components/sales/launchpadStyles.css';

import { createClient } from '@/lib/supabase/client';
import { syncEngine } from '@/lib/sales/syncEngine';
import { getPendingEvents } from '@/lib/sales/db';

export default function AdminSalesOSPage() {
  const searchParams = useSearchParams();
  const initialApp = searchParams.get('app') || searchParams.get('mode') || null;
  const [activeApp, setActiveApp] = useState<string | null>(initialApp);
  const [fieldTab, setFieldTab] = useState<'KNOCK' | 'MAP' | 'TEAM' | 'HISTORY'>('KNOCK');
  const [user, setUser] = useState<{ id: string; email: string } | null>(null);
  const [repName, setRepName] = useState('Admin');
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const appParam = searchParams.get('app') || searchParams.get('mode');
    if (appParam) setActiveApp(appParam);
  }, [searchParams]);

  useEffect(() => {
    async function loadAuth() {
      try {
        const supabase = createClient();
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          setUser({ id: authUser.id, email: authUser.email || '' });
          const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', authUser.id).single();
          if (profile?.full_name) {
            setRepName(profile.full_name);
          } else if (authUser.user_metadata?.full_name) {
            setRepName(authUser.user_metadata.full_name);
          }
        } else {
          const fallbackId = (typeof window !== 'undefined' && localStorage.getItem('knocklog_last_user_id')) || '07853cdf-ed2c-4f3b-b713-cde7c40e20a1';
          setUser({ id: fallbackId, email: 'admin@seaofblue.ca' });
          setRepName('Malik');
        }
      } catch (err) {
        console.error('Failed to load user in Sales OS:', err);
        const fallbackId = (typeof window !== 'undefined' && localStorage.getItem('knocklog_last_user_id')) || '07853cdf-ed2c-4f3b-b713-cde7c40e20a1';
        setUser({ id: fallbackId, email: 'admin@seaofblue.ca' });
        setRepName('Malik');
      } finally {
        setAuthLoading(false);
      }
    }
    loadAuth();
  }, []);

  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (user?.id) {
      syncEngine.setUserId(user.id);
      syncEngine.start();
    } else {
      syncEngine.stop();
    }
  }, [user?.id]);

  useEffect(() => {
    async function checkPending() {
      try {
        const items = await getPendingEvents();
        setPendingSyncCount(items.length);
      } catch (e) {}
    }
    checkPending();
    const unsub = syncEngine.subscribe(async () => {
      try {
        const items = await getPendingEvents();
        setPendingSyncCount(items.length);
      } catch (e) {}
    });
    return () => {
      unsub();
    };
  }, []);

  const handleForceSync = async () => {
    setIsSyncing(true);
    try {
      const res = await syncEngine.forceSync();
      setPendingSyncCount(res.pendingCount || 0);
    } catch (e) {
      console.warn('Force sync error:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  const APP_METAS: Record<string, { title: string; badge: string; icon: any; iconColor: string }> = {
    residential: { title: 'KnockLog Residential', badge: 'Field Canvassing', icon: Home, iconColor: 'text-blue-500' },
    commercial: { title: 'KnockLog Commercial', badge: 'Commercial B2B', icon: Building2, iconColor: 'text-purple-400' },
    phone: { title: 'B2B Phone Sales OS', badge: 'Inside CRM Workstation', icon: PhoneCall, iconColor: 'text-emerald-500' },
    map: { title: 'Territory Map Hub', badge: 'Satellite GPS', icon: Map, iconColor: 'text-cyan-400' },
  };

  // Handle switching apps & scrolling to top
  const handleSelectApp = (appId: string | null) => {
    setActiveApp(appId);
    if (appId) setFieldTab('KNOCK');
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' });
      const mainEl = document.querySelector('main');
      if (mainEl) mainEl.scrollTo({ top: 0, behavior: 'instant' });
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-pulse text-sm text-muted-foreground font-semibold">Loading Sales OS...</div>
      </div>
    );
  }

  // If on launcher home screen, render SalesLaunchpad
  if (!activeApp) {
    return (
      <SalesLaunchpad
        repName={repName}
        user={user}
        onSelectApp={handleSelectApp}
        onLogout={() => {}}
        isInsideAdmin={true}
      />
    );
  }

  // If active app is Territory Map Hub, render unified DispatchMap with sales preset
  if (activeApp === 'map') {
    return (
      <div className="relative w-full h-[calc(100vh-56px)] lg:h-screen -m-0 md:-m-6 lg:-m-8 overflow-hidden bg-black">
        <DispatchMap initialPreset="sales" onBack={() => handleSelectApp(null)} />
      </div>
    );
  }

  const currentMeta = APP_METAS[activeApp] || { title: 'Sales OS', badge: 'App', icon: LayoutGrid, iconColor: 'text-blue-500' };
  const MetaIcon = currentMeta.icon;

  return (
    <div className="space-y-2 sm:space-y-3 font-sans min-w-0">
      {/* Unified Compact Navigation Bar */}
      <div className="flex items-center justify-between gap-1.5 px-2 pt-1 pb-2 sm:px-0 sm:pt-0 sm:pb-2.5 border-b border-border">
        {/* Left: Back to Suite + App Title */}
        <div className="flex items-center gap-1.5 min-w-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSelectApp(null)}
            className="h-8 px-2 text-xs font-semibold gap-1 shadow-xs bg-card hover:bg-muted shrink-0"
            title="Return to Sales OS Suite"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Suite</span>
          </Button>

          <div className="flex items-center gap-1.5 min-w-0">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-card border border-border shrink-0 ${currentMeta.iconColor}`}>
              <MetaIcon className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 truncate">
              <span className="text-xs sm:text-sm font-bold text-foreground truncate block leading-tight">
                {currentMeta.title}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Sub-tabs for Field KnockLog or Rep Badge */}
        {(activeApp === 'residential' || activeApp === 'commercial') ? (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleForceSync}
              disabled={isSyncing}
              title={pendingSyncCount > 0 ? `${pendingSyncCount} offline knocks waiting to sync. Click to sync now.` : "All knocks synced to cloud"}
              className={`h-7 px-2 flex items-center gap-1 rounded-md text-[11px] font-medium border transition-colors ${
                pendingSyncCount > 0
                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20 animate-pulse'
                  : 'bg-card text-muted-foreground border-border/60 hover:text-foreground'
              }`}
            >
              <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin text-primary' : pendingSyncCount > 0 ? 'text-amber-400' : 'text-emerald-500'}`} />
              <span className="hidden sm:inline">
                {isSyncing ? 'Syncing...' : pendingSyncCount > 0 ? `${pendingSyncCount} unsynced` : 'Synced'}
              </span>
            </button>

            <div className="flex items-center gap-0.5 sm:gap-1 bg-muted/40 p-0.5 rounded-lg border border-border/50 shrink-0">
              {(['KNOCK', 'MAP', 'TEAM', 'HISTORY'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setFieldTab(tab)}
                  className={`px-2 sm:px-2.5 py-1 rounded-md text-[11px] sm:text-xs font-semibold transition-all ${
                    fieldTab === tab ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab === 'KNOCK' ? 'Knock' : tab === 'MAP' ? 'Map' : tab === 'TEAM' ? 'Team' : 'Hist'}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="h-7 px-2 text-[11px] gap-1.5 border-border bg-card font-sans">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
              <span className="text-muted-foreground hidden sm:inline">Rep:</span>
              <span className="font-bold text-foreground">{repName}</span>
            </Badge>
          </div>
        )}
      </div>

      {/* RENDER ACTIVE APP */}
      {(activeApp === 'residential' || activeApp === 'commercial') && (
        <div className="w-full">
          {/* Centered Card Canvas without Redundant Headers */}
          <div className={`max-w-xl mx-auto bg-card sm:border sm:border-border sm:rounded-2xl sm:shadow-xs overflow-hidden ${fieldTab === 'MAP' ? 'p-0' : 'p-0 sm:p-3'}`}>
            <div style={{ display: fieldTab === 'KNOCK' ? 'block' : 'none', minHeight: '520px' }}>
              <Logger
                user={user}
                repName={repName}
                onLogout={() => {}}
                isActive={fieldTab === 'KNOCK'}
                mode={activeApp === 'commercial' ? 'COMMERCIAL' : 'RESIDENTIAL'}
                onModeChange={(newMode) => setActiveApp(newMode === 'COMMERCIAL' ? 'commercial' : 'residential')}
                initialSalesMode={activeApp === 'commercial' ? 'commercial' : 'residential'}
                hideHeader={true}
              />
            </div>
            <div style={{ display: fieldTab === 'MAP' ? 'block' : 'none', height: '560px', width: '100%', position: 'relative' }} className="overflow-hidden sm:rounded-xl">
              <MapTab user={user} repName={repName} isActive={fieldTab === 'MAP'} salesMode={activeApp} />
            </div>
            <div style={{ display: fieldTab === 'TEAM' ? 'block' : 'none', minHeight: '520px', width: '100%' }}>
              <TeamTab user={user} repName={repName} isActive={fieldTab === 'TEAM'} salesMode={activeApp} />
            </div>
            <div style={{ display: fieldTab === 'HISTORY' ? 'block' : 'none', minHeight: '520px' }}>
              <HistoryTab user={user} repName={repName} isActive={fieldTab === 'HISTORY'} salesMode={activeApp} />
            </div>
          </div>
        </div>
      )}

      {activeApp === 'phone' && (
        <div className="w-full">
          <PhoneTab user={user} repName={repName} isActive={activeApp === 'phone'} />
        </div>
      )}
    </div>
  );
}
