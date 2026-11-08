'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import SalesLaunchpad from '@/components/sales/SalesLaunchpad';

import Logger from '@/components/sales/Logger';
import PhoneTab from '@/components/sales/phone/PhoneTab';
import HistoryTab from '@/components/sales/history/HistoryTab';
import MapTab from '@/components/sales/map/MapTab';
import TeamTab from '@/components/sales/team/TeamTab';
import { Skeleton } from '@/components/ui/skeleton';
import { OsBackdropLayer } from '@/components/shared/OsBackdropLayer';
import { OperatorControlPopover } from '@/components/admin/layout/OperatorControlPopover';
import { 
  LayoutGrid, ArrowLeft, Home, Building2, 
  PhoneCall, Compass, Clock, Users, RefreshCw,
  Maximize2, Minimize2, MapPin, ClipboardList
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
    return () => {
      syncEngine.stop();
    };
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

  const handleSalesLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/sobadmin/login';
  };

  if (authLoading || !user) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col h-dvh w-screen overflow-hidden bg-background text-foreground font-sans">
        <header className="os-dock-bar h-14 sm:h-12 px-4 border-b border-border flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-28 rounded-lg" />
            <Skeleton className="h-8 w-24 rounded-lg" />
            <Skeleton className="h-8 w-28 rounded-lg" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-24 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </div>
        </header>
        <div className="flex-1 p-6 max-w-6xl mx-auto w-full space-y-6">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96 max-w-full" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64 w-full rounded-2xl bg-card border border-border" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col h-dvh w-screen overflow-hidden bg-transparent text-foreground font-sans">
      <OsBackdropLayer />

      {/* =========================================================
          PERSISTENT OS SYSTEM MENU BAR (Top Dock & Status Tray)
         ========================================================= */}
      <header className="os-dock-bar relative h-14 sm:h-12 px-2.5 sm:px-4 border-b flex items-center justify-between gap-2 shrink-0 z-50 select-none safe-top">
        {/* LEFT: Workspace Return + OS Home Launcher + Direct App Dock */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <button
            type="button"
            onClick={() => handleExitToAdmin('/sobadmin')}
            className="os-tray-btn h-8 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition shrink-0 cursor-pointer"
            title="Return to Sea of Blue OS Launchpad (All 4 Workstations)"
          >
            <ArrowLeft className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline">OS Launchpad</span>
          </button>

          {/* Sales & CRM Hub Button */}
          <button
            type="button"
            onClick={() => handleSelectApp(null)}
            className={`h-8 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition shrink-0 cursor-pointer ${
              !activeApp
                ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                : 'os-tray-btn text-muted-foreground hover:text-foreground'
            }`}
            title="Sales & CRM Hub (Inbound & Outbound)"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Sales Hub</span>
          </button>

          {/* INBOUND CRM PILLS */}
          <div className="hidden md:flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-indigo-500/25">
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-indigo-500 dark:text-indigo-300/80 px-1.5 hidden xl:inline">
              Inbound
            </span>
            <button
              type="button"
              onClick={() => handleExitToAdmin('/sobadmin/leads')}
              className="h-7 px-2 sm:px-2.5 rounded-md text-[11px] font-bold flex items-center gap-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/60 transition shrink-0 cursor-pointer"
              title="Open Inbound Leads & Quotes"
            >
              <ClipboardList className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
              <span>Leads</span>
            </button>
            <button
              type="button"
              onClick={() => handleExitToAdmin('/sobadmin/customers')}
              className="h-7 px-2 sm:px-2.5 rounded-md text-[11px] font-bold flex items-center gap-1.5 text-muted-foreground hover:text-foreground hover:bg-accent/60 transition shrink-0 cursor-pointer"
              title="Open Customers & Accounts CRM"
            >
              <Users className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400 shrink-0" />
              <span>Customers</span>
            </button>
          </div>

          <div className="h-4 w-px bg-border hidden sm:block" />

          {/* OUTBOUND SALES OS PILLS */}
          <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-emerald-500/25">
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400/80 px-1.5 hidden xl:inline">
              Outbound
            </span>
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
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
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

        {/* CENTER: Field KnockLog Sub-Workspace Switcher (Desktop: Knock | Map | Team | History) */}
        {(activeApp === 'residential' || activeApp === 'commercial') && (
          <div className="hidden md:flex items-center gap-0.5 sm:gap-1 bg-muted/60 p-1 rounded-xl border border-border shrink-0">
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
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
                }`}
              >
                <TabIcon className="w-3.5 h-3.5 hidden sm:inline" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}

        {/* RIGHT: OS System Tray (Sync Status + Rep Pill Popover + Clock + Fullscreen Toggle) */}
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
                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/40 hover:bg-amber-500/25 animate-pulse'
                : 'os-tray-btn text-muted-foreground hover:text-foreground'
            }`}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${
                isSyncing
                  ? 'animate-spin text-primary'
                  : pendingSyncCount > 0
                  ? 'text-amber-500 dark:text-amber-400'
                  : 'text-emerald-500 dark:text-emerald-400'
              }`}
            />
            <span className="hidden md:inline">
              {isSyncing ? 'Syncing...' : pendingSyncCount > 0 ? `${pendingSyncCount} unsynced` : 'Synced'}
            </span>
          </button>

          {/* Interactive Operator & Glass Studio Pill */}
          <OperatorControlPopover
            operator={{
              name: repName,
              title: repTitle,
              email: user.email,
            }}
            onLogout={handleSalesLogout}
            showTitleBreakpoint="xl"
            className="hidden sm:inline-flex"
          />

          {/* System Clock */}
          {clockTime && (
            <span className="hidden xl:inline-block text-xs font-mono font-semibold text-muted-foreground px-1.5">
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
                ? 'bg-primary/15 text-primary border-primary/40 hover:bg-primary/25'
                : 'os-tray-btn'
            }`}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-primary" />
                <span className="hidden sm:inline">Exit Full</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-primary" />
                <span className="hidden sm:inline">Full Screen</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* =========================================================
          EDGE-TO-EDGE OS WORKSPACE CANVAS (100% Remaining Viewport)
         ========================================================= */}
      <div className="relative z-10 flex-1 w-full h-full min-h-0 overflow-hidden flex flex-col">
        {/* 1. OS DESKTOP LAUNCHPAD */}
        {!activeApp && (
          <SalesLaunchpad
            repName={repName}
            repTitle={repTitle}
            user={user}
            onSelectApp={handleSelectApp}
            onNavigateHref={handleExitToAdmin}
            onLogout={handleSalesLogout}
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
              className="w-full h-full flex-1 overflow-y-auto bg-transparent py-3 px-2 sm:px-6"
            >
              <Logger
                user={user}
                repName={repName}
                onLogout={handleSalesLogout}
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
              className="w-full h-full flex-1 overflow-y-auto bg-transparent"
            >
              <HistoryTab
                user={user}
                repName={repName}
                isActive={fieldTab === 'HISTORY'}
                salesMode={activeApp}
              />
            </div>

            {/* Mobile Bottom Dock for Field KnockLog (< md) */}
            <nav className="os-dock-bar md:hidden shrink-0 z-40 border-t safe-bottom flex items-center justify-around h-14">
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
                  className={`flex-1 flex flex-col items-center justify-center h-full gap-0.5 text-[10px] font-bold transition-colors ${
                    fieldTab === id ? 'text-primary' : 'text-muted-foreground active:text-foreground'
                  }`}
                >
                  <TabIcon className="w-4 h-4" />
                  <span>{label}</span>
                </button>
              ))}
            </nav>
          </div>
        )}

        {/* 3. B2B PHONE SALES OS WORKSTATION */}
        {activeApp === 'phone' && (
          <div className="flex-1 w-full h-full min-h-0 overflow-y-auto bg-transparent">
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
