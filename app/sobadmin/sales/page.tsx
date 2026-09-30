'use client';

import React, { useState } from 'react';
import SalesLaunchpad from '@/components/sales/SalesLaunchpad';
import Logger from '@/components/sales/Logger';
import PhoneTab from '@/components/sales/phone/PhoneTab';
import HistoryTab from '@/components/sales/history/HistoryTab';
import MapTab from '@/components/sales/map/MapTab';
import TeamTab from '@/components/sales/team/TeamTab';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  LayoutGrid, ArrowLeft, Home, Building2, 
  PhoneCall, Map, Trophy, Compass, Clock, Users
} from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';
import '@/components/sales/styles/knocklog.css';
import '@/components/sales/mapStyles.css';
import '@/components/sales/team/teamStyles.css';
import '@/components/sales/historyStyles.css';
import '@/components/sales/salesLayout.css';
import '@/components/sales/phone/phoneStyles.css';
import '@/components/sales/launchpadStyles.css';

export default function AdminSalesOSPage() {
  const [activeApp, setActiveApp] = useState<string | null>(null);
  const [fieldTab, setFieldTab] = useState<'KNOCK' | 'MAP' | 'TEAM' | 'HISTORY'>('KNOCK');

  const user = {
    id: '07853cdf-ed2c-4f3b-b713-cde7c40e20a1',
    email: 'malik@seaofblue.ca'
  };
  const repName = 'Malik';

  const APP_METAS: Record<string, { title: string; badge: string; icon: any; iconColor: string }> = {
    residential: { title: 'KnockLog Residential', badge: 'Field Canvassing', icon: Home, iconColor: 'text-blue-500' },
    commercial: { title: 'KnockLog Commercial', badge: 'Commercial B2B', icon: Building2, iconColor: 'text-purple-400' },
    phone: { title: 'Phone Sales OS', badge: 'Inside CRM Workstation', icon: PhoneCall, iconColor: 'text-emerald-500' },
    map: { title: 'Territory Map Hub', badge: 'Satellite GPS', icon: Map, iconColor: 'text-cyan-400' },
    team: { title: 'Team Leaderboard', badge: 'Rep Rankings', icon: Trophy, iconColor: 'text-amber-500' },
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

  const currentMeta = APP_METAS[activeApp] || { title: 'Sales OS', badge: 'App', icon: LayoutGrid, iconColor: 'text-blue-500' };
  const MetaIcon = currentMeta.icon;

  return (
    <div className="space-y-5 font-sans min-w-0">
      {/* Top Header inside SOB Admin */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-border">
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSelectApp(null)}
            className="h-9 px-3 text-xs font-semibold gap-2 shadow-xs bg-card hover:bg-muted"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Sales OS Suite</span>
          </Button>

          <div className="flex items-center gap-2.5 pl-2 border-l border-border">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-card border border-border ${currentMeta.iconColor}`}>
              <MetaIcon className="w-4 h-4" />
            </div>
            <div>
              <div className="text-base font-bold text-foreground font-sans leading-tight">
                {currentMeta.title}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {currentMeta.badge}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="h-8 px-3 text-xs gap-1.5 border-border bg-card font-sans">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
            <span className="text-muted-foreground">Rep:</span>
            <span className="font-bold text-foreground">{repName}</span>
          </Badge>
        </div>
      </div>

      {/* RENDER ACTIVE APP */}
      {(activeApp === 'residential' || activeApp === 'commercial') && (
        <div className="w-full">
          {/* Centered Desktop Card Wrapper */}
          <div className="max-w-xl mx-auto bg-card border border-border rounded-2xl shadow-sm overflow-hidden relative">
            {/* Top Sub-navigation for Field Knocking */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/60 backdrop-blur-xs">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[11px] font-semibold">
                  {activeApp === 'commercial' ? '🏢 Commercial Mode' : '🏡 Residential Mode'}
                </Badge>
              </div>

              {/* Sub-tab pills */}
              <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-xl border border-border/50">
                <button
                  onClick={() => setFieldTab('KNOCK')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    fieldTab === 'KNOCK' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Knock
                </button>
                <button
                  onClick={() => setFieldTab('MAP')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    fieldTab === 'MAP' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Map
                </button>
                <button
                  onClick={() => setFieldTab('TEAM')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    fieldTab === 'TEAM' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Team
                </button>
                <button
                  onClick={() => setFieldTab('HISTORY')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    fieldTab === 'HISTORY' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  History
                </button>
              </div>
            </div>

            {/* Field App Content Canvas */}
            <div className="p-4 min-h-[580px]">
              <div style={{ display: fieldTab === 'KNOCK' ? 'block' : 'none', height: '100%' }}>
                <Logger
                  user={user}
                  repName={repName}
                  onLogout={() => {}}
                  isActive={fieldTab === 'KNOCK'}
                  initialSalesMode={activeApp === 'commercial' ? 'commercial' : 'residential'}
                />
              </div>
              <div style={{ display: fieldTab === 'MAP' ? 'block' : 'none', height: '520px', width: '100%' }}>
                <MapTab user={user} repName={repName} isActive={fieldTab === 'MAP'} />
              </div>
              <div style={{ display: fieldTab === 'TEAM' ? 'block' : 'none', height: '100%', width: '100%' }}>
                <TeamTab user={user} repName={repName} isActive={fieldTab === 'TEAM'} />
              </div>
              <div style={{ display: fieldTab === 'HISTORY' ? 'block' : 'none', height: '100%' }}>
                <HistoryTab user={user} repName={repName} isActive={fieldTab === 'HISTORY'} />
              </div>
            </div>
          </div>
        </div>
      )}

      {activeApp === 'phone' && (
        <div className="w-full">
          <PhoneTab user={user} repName={repName} isActive={activeApp === 'phone'} />
        </div>
      )}

      {activeApp === 'map' && (
        <div className="w-full h-[calc(100vh-160px)] rounded-2xl overflow-hidden border border-border shadow-xs">
          <MapTab user={user} repName={repName} isActive={activeApp === 'map'} />
        </div>
      )}

      {activeApp === 'team' && (
        <div className="max-w-4xl mx-auto py-2">
          <TeamTab user={user} repName={repName} isActive={activeApp === 'team'} />
        </div>
      )}
    </div>
  );
}
