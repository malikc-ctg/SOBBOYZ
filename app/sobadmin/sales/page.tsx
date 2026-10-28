'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import SalesLaunchpad from '@/components/sales/SalesLaunchpad';

import Logger from '@/components/sales/Logger';
import PhoneTab from '@/components/sales/phone/PhoneTab';
import HistoryTab from '@/components/sales/history/HistoryTab';
import MapTab from '@/components/sales/map/MapTab';
import TeamTab from '@/components/sales/team/TeamTab';
import { Badge } from '@/components/ui/badge';
import { 
  LayoutGrid, ArrowLeft, Home, Building2, 
  PhoneCall, Compass, Clock, Users, RefreshCw,
  Maximize2, Minimize2, MapPin
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
  const router = useRouter();
  const initialApp = searchParams.get('app') || searchParams.get('mode') || null;
  const [activeApp, setActiveApp] = useState<string | null>(initialApp);
  const [fieldTab, setFieldTab] = useState<'KNOCK' | 'MAP' | 'TEAM' | 'HISTORY'>('KNOCK');
  const [user, setUser] = useState<{ id: string; email: string; full_name?: string; title?: string } | null>(null);
  const [repName, setRepName] = useState('Sales Rep');
  const [repTitle, setRepTitle] = useState('Account Executive');
  const [authLoading, setAuthLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [clockTime, setClockTime] = useState('');

  useEffect(() => {
    const appParam = searchParams.get('app') || searchParams.get('mode');
    if (appParam) setActiveApp(appParam);
  }, [searchParams]);

  // Track browser Fullscreen state & live system clock
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 80);
    };

    setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    const updateClock = () => {
      setClockTime(
        new Date().toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        })
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 15000);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      clearInterval(timer);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (typeof document === 'undefined') return;
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen toggle error:', err);
    }
  }, []);

  const handleExitToAdmin = useCallback(async (destination = '/sobadmin/leads') => {
    if (typeof document !== 'undefined' && document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {}
    }
    router.push(destination);
  }, [router]);

  useEffect(() => {
    async function loadAuth() {
      try {
        const supabase = createClient();
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (authUser) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, title, role')
            .eq('id', authUser.id)
            .maybeSingle();

          const name = profile?.full_name || authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Sales Rep';
          const title = profile?.title || (profile?.role === 'admin' ? 'Managing Partner' : 'Account Executive');

          setUser({ 
            id: authUser.id, 
            email: authUser.email || '',
            full_name: name,
            title: title
          });
          setRepName(name);
          setRepTitle(title);
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Failed to load user in Sales OS:', err);
        setUser(null);
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

  const OS_APPS = [
    { id: 'residential', label: 'Residential', icon: Home, activeColor: 'bg-blue-600 text-white border-blue-500' },
    { id: 'commercial', label: 'Commercial', icon: Building2, activeColor: 'bg-purple-600 text-white border-purple-500' },
    { id: 'phone', label: 'B2B Phone', icon: PhoneCall, activeColor: 'bg-emerald-600 text-white border-emerald-500' },
  ];

  const handleSelectApp = (appId: string | null) => {
    setActiveApp(appId);
    if (appId) setFieldTab('KNOCK');
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 60);
    }
  };

  const handleSelectFieldTab = (tab: 'KNOCK' | 'MAP' | 'TEAM' | 'HISTORY') => {
    setFieldTab(tab);
    if (tab === 'MAP' && typeof window !== 'undefined') {
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 60);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="fixed inset-0 z-50 flex h-dvh w-screen items-center justify-center bg-[#001326] text-[#fffcf6] font-sans dark">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          <div className="text-sm text-[#88a2c0] font-semibold">Booting Sales OS...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col h-dvh w-screen overflow-hidden bg-[#001326] text-[#fffcf6] font-sans dark">
      {/* =========================================================
          PERSISTENT OS SYSTEM MENU BAR (Top Dock & Status Tray)
         ========================================================= */}
      <header className="h-12 px-2.5 sm:px-4 bg-[#000d1a]/95 border-b border-[#3c6ca8]/25 flex items-center justify-between gap-2 shrink-0 z-50 select-none">
        {/* LEFT: Workspace Return + OS Home Launcher + Direct App Dock */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <button
            type="button"
            onClick={() => handleExitToAdmin('/sobadmin')}
            className="h-8 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-[#001b38] hover:bg-[#002855] text-slate-200 border border-[#3c6ca8]/30 transition shrink-0 cursor-pointer"
            title="Return to Sea of Blue OS Launchpad (All 4 Workstations)"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-blue-400" />
            <span className="hidden sm:inline">OS Launchpad</span>
          </button>

          <button
            type="button"
            onClick={() => handleExitToAdmin('/sobadmin/leads')}
            className="hidden md:flex h-8 px-2.5 rounded-lg text-[11px] font-semibold items-center gap-1 bg-[#001326] hover:bg-[#002855] text-[#88a2c0] hover:text-white border border-[#3c6ca8]/25 transition shrink-0 cursor-pointer"
            title="Open Inbound Leads CRM"
          >
            <span>Leads</span>
          </button>

          <button
            type="button"
            onClick={() => handleExitToAdmin('/sobadmin/customers')}
            className="hidden lg:flex h-8 px-2.5 rounded-lg text-[11px] font-semibold items-center gap-1 bg-[#001326] hover:bg-[#002855] text-[#88a2c0] hover:text-white border border-[#3c6ca8]/25 transition shrink-0 cursor-pointer"
            title="Open Customers & Accounts CRM"
          >
            <span>Customers</span>
          </button>

          <div className="h-4 w-px bg-[#3c6ca8]/25 hidden sm:block" />

          {/* OS Desktop / Suite Home Button */}
          <button
            type="button"
            onClick={() => handleSelectApp(null)}
            className={`h-8 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition shrink-0 cursor-pointer ${
              !activeApp
                ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                : 'bg-[#001b38]/80 hover:bg-[#00244c] text-[#88a2c0] hover:text-white border-[#3c6ca8]/25'
            }`}
            title="Sales OS Desktop Launchpad"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="hidden md:inline">OS Suite</span>
          </button>

          {/* Direct App Switcher Pills */}
          <div className="flex items-center gap-1 bg-[#001326] p-0.5 rounded-lg border border-[#3c6ca8]/25">
            {OS_APPS.map((app) => {
              const Icon = app.icon;
              const isSelected = activeApp === app.id;
              return (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => handleSelectApp(app.id)}
                  className={`h-7 px-2 sm:px-2.5 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition cursor-pointer ${
                    isSelected
                      ? app.activeColor
                      : 'text-[#88a2c0] hover:text-white hover:bg-[#001d40]'
                  }`}
                  title={`Switch to ${app.label}`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="hidden lg:inline">{app.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* CENTER: Field KnockLog Sub-Workspace Switcher (Knock | Map | Team | History) */}
        {(activeApp === 'residential' || activeApp === 'commercial') && (
          <div className="flex items-center gap-0.5 sm:gap-1 bg-[#001326] p-1 rounded-xl border border-[#3c6ca8]/30 shrink-0">
            {([
              { id: 'KNOCK', label: 'Knock', icon: MapPin },
              { id: 'MAP', label: 'Map', icon: Compass },
              { id: 'TEAM', label: 'Team', icon: Users },
              { id: 'HISTORY', label: 'History', icon: Clock },
            ] as const).map(({ id, label, icon: TabIcon }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleSelectFieldTab(id)}
                className={`px-2.5 sm:px-3.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  fieldTab === id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-[#88a2c0] hover:text-white hover:bg-[#001d40]'
                }`}
              >
                <TabIcon className="w-3.5 h-3.5 hidden sm:inline" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}

        {/* RIGHT: OS System Tray (Sync Status + Rep Pill + Clock + Fullscreen Toggle) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Cloud Sync Status */}
          <button
            type="button"
            onClick={handleForceSync}
            disabled={isSyncing}
            title={
              pendingSyncCount > 0
                ? `${pendingSyncCount} offline events waiting to sync. Click to sync now.`
                : 'All events synced to cloud'
            }
            className={`h-8 px-2.5 flex items-center gap-1.5 rounded-lg text-[11px] font-semibold border transition cursor-pointer ${
              pendingSyncCount > 0
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25 animate-pulse'
                : 'bg-[#001b38] text-[#88a2c0] border-[#3c6ca8]/25 hover:text-white'
            }`}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                isSyncing
                  ? 'animate-spin text-blue-400'
                  : pendingSyncCount > 0
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            />
            <span className="hidden md:inline">
              {isSyncing ? 'Syncing...' : pendingSyncCount > 0 ? `${pendingSyncCount} unsynced` : 'Synced'}
            </span>
          </button>

          {/* Operator Badge */}
          <Badge
            variant="outline"
            className="hidden sm:inline-flex h-8 px-2.5 text-[11px] gap-1.5 border-[#3c6ca8]/30 bg-[#001b38] text-slate-200 font-sans"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
            <span className="font-bold text-white truncate max-w-[120px]">{repName}</span>
            <span className="text-[#88a2c0] hidden xl:inline">• {repTitle}</span>
          </Badge>

          {/* System Clock */}
          {clockTime && (
            <span className="hidden xl:inline-block text-xs font-mono font-semibold text-[#88a2c0] px-1.5">
              {clockTime}
            </span>
          )}

          {/* Native OS Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Full Screen (Esc)' : 'Enter Full Screen OS Mode'}
            className={`h-8 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer ${
              isFullscreen
                ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 hover:bg-blue-500/30'
                : 'bg-[#001b38] text-slate-200 border-[#3c6ca8]/35 hover:bg-[#002855] hover:text-white'
            }`}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">Exit Full</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden sm:inline">Full Screen</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* =========================================================
          EDGE-TO-EDGE OS WORKSPACE CANVAS (100% Remaining Viewport)
         ========================================================= */}
      <div className="flex-1 w-full h-full min-h-0 overflow-hidden relative flex flex-col">
        {/* 1. OS DESKTOP LAUNCHPAD */}
        {!activeApp && (
          <SalesLaunchpad
            repName={repName}
            repTitle={repTitle}
            user={user}
            onSelectApp={handleSelectApp}
            onLogout={() => {}}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            pendingSyncCount={pendingSyncCount}
          />
        )}

        {/* 2. KNOCKLOG RESIDENTIAL & COMMERCIAL WORKSTATIONS */}
        {(activeApp === 'residential' || activeApp === 'commercial') && (
          <div className="flex-1 w-full h-full min-h-0 relative overflow-hidden flex flex-col">
            {/* KNOCK TAB */}
            <div
              style={{ display: fieldTab === 'KNOCK' ? 'block' : 'none' }}
              className="w-full h-full flex-1 overflow-y-auto bg-[#001326] py-3 px-2 sm:px-6"
            >
              <Logger
                user={user}
                repName={repName}
                onLogout={() => {}}
                isActive={fieldTab === 'KNOCK'}
                mode={activeApp === 'commercial' ? 'COMMERCIAL' : 'RESIDENTIAL'}
                onModeChange={(newMode: string) =>
                  setActiveApp(newMode === 'COMMERCIAL' ? 'commercial' : 'residential')
                }
                initialSalesMode={activeApp === 'commercial' ? 'commercial' : 'residential'}
                hideHeader={true}
              />
            </div>

            {/* MAP TAB — 100% Edge-to-Edge Full Viewport Mapbox */}
            <div
              style={{ display: fieldTab === 'MAP' ? 'flex' : 'none' }}
              className="w-full h-full flex-1 relative overflow-hidden"
            >
              <MapTab
                user={user}
                repName={repName}
                isActive={fieldTab === 'MAP'}
                salesMode={activeApp}
              />
            </div>

            {/* TEAM TAB — Full Viewport Team Telemetry */}
            <div
              style={{ display: fieldTab === 'TEAM' ? 'flex' : 'none' }}
              className="w-full h-full flex-1 overflow-hidden flex-col"
            >
              <TeamTab
                user={user}
                repName={repName}
                isActive={fieldTab === 'TEAM'}
                salesMode={activeApp}
              />
            </div>

            {/* HISTORY TAB — Full Viewport Session History */}
            <div
              style={{ display: fieldTab === 'HISTORY' ? 'block' : 'none' }}
              className="w-full h-full flex-1 overflow-y-auto bg-[#001326]"
            >
              <HistoryTab
                user={user}
                repName={repName}
                isActive={fieldTab === 'HISTORY'}
                salesMode={activeApp}
              />
            </div>
          </div>
        )}

        {/* 3. B2B PHONE SALES OS WORKSTATION */}
        {activeApp === 'phone' && (
          <div className="flex-1 w-full h-full min-h-0 overflow-y-auto bg-[#001326]">
            <PhoneTab
              user={user}
              repName={repName}
              repTitle={repTitle}
              isActive={activeApp === 'phone'}
            />
          </div>
        )}
      </div>
    </div>
  );
}
