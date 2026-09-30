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
    <div className="space-y-3 font-sans min-w-0">
      {/* Unified Compact Navigation Bar */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-border">
        {/* Left: Back to Suite + App Title */}
        <div className="flex items-center gap-2 min-w-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleSelectApp(null)}
            className="h-8 px-2.5 text-xs font-semibold gap-1.5 shadow-xs bg-card hover:bg-muted shrink-0"
            title="Return to Sales OS Suite"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Suite</span>
          </Button>

          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-card border border-border shrink-0 ${currentMeta.iconColor}`}>
              <MetaIcon className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0 truncate">
              <span className="text-sm font-bold text-foreground truncate block leading-tight">
                {currentMeta.title}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Sub-tabs for Field KnockLog or Rep Badge */}
        {(activeApp === 'residential' || activeApp === 'commercial') ? (
          <div className="flex items-center gap-1 bg-muted/40 p-0.5 rounded-lg border border-border/50 shrink-0">
            {(['KNOCK', 'MAP', 'TEAM', 'HISTORY'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFieldTab(tab)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                  fieldTab === tab ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab === 'KNOCK' ? 'Knock' : tab === 'MAP' ? 'Map' : tab === 'TEAM' ? 'Team' : 'History'}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="outline" className="h-7 px-2 text-[11px] gap-1.5 border-border bg-card font-sans">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse" />
              <span className="text-muted-foreground">Rep:</span>
              <span className="font-bold text-foreground">{repName}</span>
            </Badge>
          </div>
        )}
      </div>

      {/* RENDER ACTIVE APP */}
      {(activeApp === 'residential' || activeApp === 'commercial') && (
        <div className="w-full">
          {/* Centered Card Canvas without Redundant Headers */}
          <div className="max-w-xl mx-auto bg-card sm:border sm:border-border sm:rounded-2xl sm:shadow-xs overflow-hidden p-1 sm:p-3">
            <div style={{ display: fieldTab === 'KNOCK' ? 'block' : 'none', minHeight: '520px' }}>
              <Logger
                user={user}
                repName={repName}
                onLogout={() => {}}
                isActive={fieldTab === 'KNOCK'}
                initialSalesMode={activeApp === 'commercial' ? 'commercial' : 'residential'}
                hideHeader={true}
              />
            </div>
            <div style={{ display: fieldTab === 'MAP' ? 'block' : 'none', height: '520px', width: '100%' }}>
              <MapTab user={user} repName={repName} isActive={fieldTab === 'MAP'} />
            </div>
            <div style={{ display: fieldTab === 'TEAM' ? 'block' : 'none', minHeight: '520px', width: '100%' }}>
              <TeamTab user={user} repName={repName} isActive={fieldTab === 'TEAM'} />
            </div>
            <div style={{ display: fieldTab === 'HISTORY' ? 'block' : 'none', minHeight: '520px' }}>
              <HistoryTab user={user} repName={repName} isActive={fieldTab === 'HISTORY'} />
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
        <div className="w-full h-[calc(100vh-140px)] rounded-2xl overflow-hidden border border-border shadow-xs">
          <MapTab user={user} repName={repName} isActive={activeApp === 'map'} />
        </div>
      )}
    </div>
  );
}
