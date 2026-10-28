'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Logger from '@/components/sales/Logger';
import PhoneTab from '@/components/sales/phone/PhoneTab';
import HistoryTab from '@/components/sales/history/HistoryTab';
import MapTab from '@/components/sales/map/MapTab';
import TeamTab from '@/components/sales/team/TeamTab';
import {
  Home,
  Building2,
  Compass,
  Clock,
  Users,
  RefreshCw,
  MapPin,
} from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@/components/sales/styles/knocklog.css';
import '@/components/sales/mapStyles.css';
import '@/components/sales/team/teamStyles.css';
import '@/components/sales/historyStyles.css';
import '@/components/sales/salesLayout.css';
import '@/components/sales/phone/phoneStyles.css';

import { createClient } from '@/lib/supabase/client';
import { syncEngine } from '@/lib/sales/syncEngine';
import { getPendingEvents } from '@/lib/sales/db';

export default function AdminSalesOSPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawApp = searchParams.get('app') || searchParams.get('mode') || 'phone';
  const [activeApp, setActiveApp] = useState<string>(rawApp);
  const [fieldTab, setFieldTab] = useState<'KNOCK' | 'MAP' | 'TEAM' | 'HISTORY'>('KNOCK');
  const [user, setUser] = useState<{
    id: string;
    email: string;
    full_name?: string;
    title?: string;
  } | null>(null);
  const [repName, setRepName] = useState('Sales Rep');
  const [repTitle, setRepTitle] = useState('Account Executive');
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const appParam = searchParams.get('app') || searchParams.get('mode') || 'phone';
    setActiveApp(appParam);
    setFieldTab('KNOCK');
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 60);
    }
  }, [searchParams]);

  useEffect(() => {
    async function loadAuth() {
      try {
        const supabase = createClient();
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();
        if (authUser) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, title, role')
            .eq('id', authUser.id)
            .maybeSingle();

          const name =
            profile?.full_name ||
            authUser.user_metadata?.full_name ||
            authUser.email?.split('@')[0] ||
            'Sales Rep';
          const title =
            profile?.title ||
            (profile?.role === 'admin' ? 'Managing Partner' : 'Account Executive');

          setUser({
            id: authUser.id,
            email: authUser.email || '',
            full_name: name,
            title: title,
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
      } catch {}
    }
    checkPending();
    const unsub = syncEngine.subscribe(async () => {
      try {
        const items = await getPendingEvents();
        setPendingSyncCount(items.length);
      } catch {}
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
      <div className="flex flex-1 h-full w-full items-center justify-center bg-[#001326] text-[#fffcf6] font-sans dark">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          <div className="text-sm text-[#88a2c0] font-semibold">Loading Sales OS...</div>
        </div>
      </div>
    );
  }

  const isFieldApp = activeApp === 'residential' || activeApp === 'commercial';

  return (
    <div className="flex-1 w-full h-full min-h-0 overflow-hidden relative flex flex-col bg-[#001326] text-[#fffcf6] font-sans dark">
      {/* Sub-navigation bar ONLY for KnockLog Field Canvassing (Knock | Map | Team | History + Offline Sync) */}
      {isFieldApp && (
        <div className="h-11 px-3 sm:px-5 bg-[#001021] border-b border-[#3c6ca8]/25 flex items-center justify-between gap-2 shrink-0 select-none">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border ${
                activeApp === 'commercial'
                  ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                  : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
              }`}
            >
              {activeApp === 'commercial' ? (
                <>
                  <Building2 className="w-3.5 h-3.5" />
                  <span>KnockLog Commercial</span>
                </>
              ) : (
                <>
                  <Home className="w-3.5 h-3.5" />
                  <span>KnockLog Residential</span>
                </>
              )}
            </span>

            {/* Knock | Map | Team | History */}
            <div className="flex items-center gap-0.5 sm:gap-1 bg-[#001b38] p-0.5 rounded-lg border border-[#3c6ca8]/30">
              {(
                [
                  { id: 'KNOCK', label: 'Knock', icon: MapPin },
                  { id: 'MAP', label: 'Map', icon: Compass },
                  { id: 'TEAM', label: 'Team', icon: Users },
                  { id: 'HISTORY', label: 'History', icon: Clock },
                ] as const
              ).map(({ id, label, icon: TabIcon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleSelectFieldTab(id)}
                  className={`px-2.5 sm:px-3 py-1 rounded-md text-[11px] sm:text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                    fieldTab === id
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-[#88a2c0] hover:text-white hover:bg-[#00244c]'
                  }`}
                >
                  <TabIcon className="w-3.5 h-3.5 hidden sm:inline" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Offline Sync Status Button */}
          <button
            type="button"
            onClick={handleForceSync}
            disabled={isSyncing}
            title={
              pendingSyncCount > 0
                ? `${pendingSyncCount} offline events waiting to sync. Click to sync now.`
                : 'All events synced to cloud'
            }
            className={`h-7 px-2.5 flex items-center gap-1.5 rounded-md text-[11px] font-semibold border transition cursor-pointer ${
              pendingSyncCount > 0
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25 animate-pulse'
                : 'bg-[#001b38] text-[#88a2c0] border-[#3c6ca8]/25 hover:text-white'
            }`}
          >
            <RefreshCw
              className={`w-3 h-3 ${
                isSyncing
                  ? 'animate-spin text-blue-400'
                  : pendingSyncCount > 0
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            />
            <span>
              {isSyncing
                ? 'Syncing...'
                : pendingSyncCount > 0
                ? `${pendingSyncCount} unsynced`
                : 'Cloud Synced'}
            </span>
          </button>
        </div>
      )}

      {/* 1. KNOCKLOG RESIDENTIAL & COMMERCIAL WORKSTATIONS */}
      {isFieldApp && (
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
              onModeChange={(newMode: string) => {
                const nextApp = newMode === 'COMMERCIAL' ? 'commercial' : 'residential';
                setActiveApp(nextApp);
                router.replace(`/sobadmin/sales?app=${nextApp}`);
              }}
              initialSalesMode={activeApp === 'commercial' ? 'commercial' : 'residential'}
              hideHeader={true}
            />
          </div>

          {/* MAP TAB */}
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

          {/* TEAM TAB */}
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

          {/* HISTORY TAB */}
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

      {/* 2. B2B PHONE SALES OS WORKSTATION */}
      {!isFieldApp && (
        <div className="flex-1 w-full h-full min-h-0 overflow-y-auto bg-[#001326]">
          <PhoneTab
            user={user}
            repName={repName}
            repTitle={repTitle}
            isActive={!isFieldApp}
          />
        </div>
      )}
    </div>
  );
}
