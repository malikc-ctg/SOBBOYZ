'use client';

import React from 'react';
import { 
  Home, Building2, PhoneCall, 
  Map, ArrowRight,
  Waves
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
    <div className="space-y-4 sm:space-y-6 max-w-7xl mx-auto min-w-0 font-sans px-3 py-2 sm:px-0 sm:py-0">
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

      {/* 4 Dedicated Application Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-5 pt-2">
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
              </div>

              <div className="text-base md:text-lg font-bold text-foreground font-sans group-hover:text-primary transition-colors tracking-tight">
                {app.title}
              </div>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed font-sans">
                {app.desc}
              </p>
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
