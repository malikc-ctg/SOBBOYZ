'use client';

import React from 'react';
import { 
  Home, Building2, PhoneCall, 
  Map, ArrowRight,
  Waves, ShieldCheck,
  Flame, Briefcase
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function SalesLaunchpad({ repName, user, onSelectApp, onLogout, isInsideAdmin = false }) {
  const APPS = [
    {
      id: 'residential',
      title: 'KnockLog Residential',
      badge: 'Field Canvassing',
      badgeColor: 'text-blue-500',
      badgeBg: 'bg-blue-500/10',
      iconBg: 'bg-blue-500/10 text-blue-500',
      icon: <Home className="w-6 h-6" />,
      desc: 'Door-to-door residential canvassing, automated house # stepping, soft-wash & bin pitch, and instant pin logging.',
      features: ['Auto Step #', 'Soft-Wash Pitch', 'GPS Pins'],
      actionLabel: 'Launch Residential'
    },
    {
      id: 'commercial',
      title: 'KnockLog Commercial',
      badge: 'Commercial B2B',
      badgeColor: 'text-purple-400',
      badgeBg: 'bg-purple-500/10',
      iconBg: 'bg-purple-500/10 text-purple-400',
      icon: <Building2 className="w-6 h-6" />,
      desc: 'Plaza & storefront canvassing. Track company name, facility type, decision-maker status, and walkthrough bookings.',
      features: ['Plazas & Stores', 'DM Tracking', 'Walkthroughs'],
      actionLabel: 'Launch Commercial'
    },
    {
      id: 'phone',
      title: 'B2B Phone Sales OS',
      badge: 'B2B Tele-Sales',
      badgeColor: 'text-emerald-500',
      badgeBg: 'bg-emerald-500/10',
      iconBg: 'bg-emerald-500/10 text-emerald-500',
      icon: <PhoneCall className="w-6 h-6" />,
      desc: 'Inside tele-sales workstation for commercial property managers, plaza facilities, 1-click dialer, and objection battle-cards.',
      features: ['B2B Dialer', 'Plaza Cold Calls', 'Objection Cards'],
      actionLabel: 'Launch Workstation'
    },
    {
      id: 'map',
      title: 'Territory Map Hub',
      badge: 'Satellite GPS',
      badgeColor: 'text-cyan-400',
      badgeBg: 'bg-cyan-500/10',
      iconBg: 'bg-cyan-500/10 text-cyan-400',
      icon: <Map className="w-6 h-6" />,
      desc: 'Interactive territory map with route tracking, boundary polygons, pinned addresses, heatmaps, and canvassing coverage.',
      features: ['Satellite GPS', 'Zone Boundaries', 'Heatmap Overlay'],
      actionLabel: 'Open Live Map'
    }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto min-w-0 font-sans">
      {/* Header Matching SOB Admin Style */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-blue-500 mb-1">
            <Waves className="h-4 w-4" />
            <span className="text-xs font-bold uppercase tracking-wider font-sans">Operations Command</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground font-display">
            Sales OS Suite
          </h1>
          <p className="text-xs text-muted-foreground mt-1 font-sans">
            Dedicated field canvassing, commercial B2B, and inside tele-sales workstations.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:justify-end">
          {!isInsideAdmin && (
            <a href="/sobadmin">
              <Button size="sm" variant="outline" className="h-9 px-3 text-xs font-semibold gap-1.5 shadow-xs">
                ← SOB Admin
              </Button>
            </a>
          )}
          <Badge variant="outline" className="h-9 px-3 text-xs gap-2 border-border bg-card font-sans">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse" />
            <span className="text-muted-foreground">Rep:</span>
            <span className="font-bold text-foreground">{repName || 'Malik'}</span>
          </Badge>
        </div>
      </div>

      {/* Metrics Grid Matching SOB Admin Dashboard 1:1 */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {/* Metric 1: B2B Phone Pipeline */}
        <div
          onClick={() => onSelectApp('phone')}
          className="bg-card border border-border rounded-2xl p-4 md:p-5 shadow-xs transition-all hover:border-primary/50 hover:shadow-sm cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-500/10 text-emerald-500">
              <Briefcase className="w-4 h-4" />
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
          </div>
          <div className="text-2xl md:text-3xl font-black tracking-tight text-foreground font-display">
            0
          </div>
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mt-1 font-sans">
            B2B Phone Pipeline
          </div>
          <div className="text-[11px] text-muted-foreground/80 mt-0.5 font-sans">
            Commercial tele-sales queue
          </div>
        </div>

        {/* Metric 2: Doors Canvassed */}
        <div
          onClick={() => onSelectApp('residential')}
          className="bg-card border border-border rounded-2xl p-4 md:p-5 shadow-xs transition-all hover:border-primary/50 hover:shadow-sm cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-500/10 text-blue-500">
              <Home className="w-4 h-4" />
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
          </div>
          <div className="text-2xl md:text-3xl font-black tracking-tight text-foreground font-display">
            986
          </div>
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mt-1 font-sans">
            Doors Canvassed
          </div>
          <div className="text-[11px] text-muted-foreground/80 mt-0.5 font-sans">
            All-time field knock telemetry
          </div>
        </div>

        {/* Metric 3: Total Knock Sales */}
        <div
          onClick={() => onSelectApp('residential')}
          className="bg-card border border-border rounded-2xl p-4 md:p-5 shadow-xs transition-all hover:border-primary/50 hover:shadow-sm cursor-pointer group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-500/10 text-amber-500">
              <Flame className="w-4 h-4" />
            </div>
            <ArrowRight className="w-4 h-4 text-muted-foreground/40 group-hover:text-foreground transition-colors" />
          </div>
          <div className="text-2xl md:text-3xl font-black tracking-tight text-foreground font-display">
            53
          </div>
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mt-1 font-sans">
            Total Knock Sales
          </div>
          <div className="text-[11px] text-muted-foreground/80 mt-0.5 font-sans">
            $3,249 Accrued Commission
          </div>
        </div>

        {/* Metric 4: Offline Engine */}
        <div
          className="bg-card border border-border rounded-2xl p-4 md:p-5 shadow-xs"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-purple-500/10 text-purple-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <Badge variant="secondary" className="text-[10px] bg-emerald-500/15 text-emerald-400 border-0 font-bold">
              100% ONLINE
            </Badge>
          </div>
          <div className="text-2xl md:text-3xl font-black tracking-tight text-foreground font-display">
            100%
          </div>
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mt-1 font-sans">
            IndexedDB Sync
          </div>
          <div className="text-[11px] text-muted-foreground/80 mt-0.5 font-sans">
            Auto-synced with Supabase
          </div>
        </div>
      </div>

      {/* 4 Dedicated Application Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5">
        {APPS.map((app) => (
          <div
            key={app.id}
            onClick={() => onSelectApp(app.id)}
            className="bg-card border border-border rounded-2xl p-5 md:p-6 shadow-xs hover:border-primary/60 hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${app.iconBg} transition-transform group-hover:scale-105`}>
                  {app.icon}
                </div>
                <Badge variant="secondary" className="text-[11px] font-semibold font-sans">
                  {app.badge}
                </Badge>
              </div>

              <div className="text-base md:text-lg font-bold text-foreground font-sans group-hover:text-primary transition-colors tracking-tight">
                {app.title}
              </div>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed font-sans">
                {app.desc}
              </p>

              {/* Feature Chips */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {app.features.map((f) => (
                  <span
                    key={f}
                    className="text-[10px] font-medium bg-muted/60 text-muted-foreground px-2 py-0.5 rounded-md border border-border/40 font-sans"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 mt-4 border-t border-border/50">
              <span className="text-xs font-bold text-blue-500 group-hover:text-blue-400 flex items-center gap-1 font-sans">
                {app.actionLabel}
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
