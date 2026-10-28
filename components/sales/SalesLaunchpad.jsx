'use client';

import React, { useState } from 'react';
import { 
  Home, Building2, PhoneCall, 
  ArrowRight, Waves, Maximize2, Minimize2, Sparkles, Monitor
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function SalesLaunchpad({
  repName,
  repTitle = 'Account Executive',
  user,
  onSelectApp,
  onLogout,
  isFullscreen = false,
  onToggleFullscreen,
  pendingSyncCount = 0,
}) {
  const [autoFullscreenOnLaunch, setAutoFullscreenOnLaunch] = useState(true);

  const APPS = [
    {
      id: 'residential',
      title: 'KnockLog Residential',
      badge: 'Field Canvassing OS',
      badgeColor: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
      iconBg: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
      accentBorder: 'hover:border-blue-500/60',
      icon: <Home className="w-6 h-6" />,
      desc: 'Door-to-door residential territory canvassing, automated house number stepping, soft-wash & bin pitch scripts, and instant GPS pin logging.',
      features: ['Auto House # Step', 'Live Territory Map', 'Offline Sync Queue', 'Team Leaderboard'],
      actionLabel: 'Launch Residential OS'
    },
    {
      id: 'commercial',
      title: 'KnockLog Commercial',
      badge: 'Commercial B2B Field',
      badgeColor: 'text-purple-300 border-purple-500/30 bg-purple-500/10',
      iconBg: 'bg-purple-500/15 text-purple-300 border border-purple-500/30',
      accentBorder: 'hover:border-purple-500/60',
      icon: <Building2 className="w-6 h-6" />,
      desc: 'Plaza & storefront field canvassing. Track company names, suite numbers, facility types, decision-maker status, and on-site walkthrough bookings.',
      features: ['Plaza & Suite Logging', 'Decision-Maker Radar', 'Walkthrough Booking', 'Follow-Up Alerts'],
      actionLabel: 'Launch Commercial OS'
    },
    {
      id: 'phone',
      title: 'B2B Phone Sales OS',
      badge: 'Inside CRM Workstation',
      badgeColor: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
      iconBg: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
      accentBorder: 'hover:border-emerald-500/60',
      icon: <PhoneCall className="w-6 h-6" />,
      desc: 'Full-screen inside tele-sales workstation for commercial property managers & general contractors. Multi-sector Kanban pipeline, Touch Centre, and Quo AI sync.',
      features: ['Sector Kanban Board', 'Touch Centre Cadence', 'Quo Call & AI Sync', '1-Click Dialer'],
      actionLabel: 'Launch Phone Workstation'
    }
  ];

  const handleLaunchApp = (appId) => {
    if (
      autoFullscreenOnLaunch &&
      typeof document !== 'undefined' &&
      !document.fullscreenElement &&
      document.documentElement.requestFullscreen
    ) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    onSelectApp(appId);
  };

  return (
    <div className="h-full w-full overflow-y-auto flex flex-col justify-between px-4 py-6 sm:px-8 sm:py-10 bg-[#001326] text-[#fffcf6] font-sans select-none">
      <div className="max-w-7xl w-full mx-auto my-auto space-y-8">
        {/* OS Workspace Hero Banner */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between border-b border-[#3c6ca8]/25 pb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md bg-blue-500/10 border border-blue-500/25 text-blue-400 mb-3">
              <Waves className="h-3.5 w-3.5" />
              <span className="text-[11px] font-bold uppercase tracking-widest">Sea of Blue Operating System</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-white font-display">
              Sales OS Workstation
            </h1>
            <p className="text-sm text-[#88a2c0] mt-1.5 max-w-2xl">
              Select a workspace environment below. All applications run edge-to-edge with real-time cloud telemetry and offline resilience.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => setAutoFullscreenOnLaunch(!autoFullscreenOnLaunch)}
              className={`h-9 px-3 rounded-lg text-xs font-semibold border transition flex items-center gap-2 cursor-pointer ${
                autoFullscreenOnLaunch
                  ? 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                  : 'bg-[#001d40]/80 border-[#3c6ca8]/30 text-[#88a2c0] hover:text-white'
              }`}
              title="Automatically enter native OS Full Screen when launching an app"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Auto Full Screen: {autoFullscreenOnLaunch ? 'ON' : 'OFF'}</span>
            </button>

            {onToggleFullscreen && (
              <Button
                size="sm"
                variant="outline"
                onClick={onToggleFullscreen}
                className="h-9 px-3.5 text-xs font-bold gap-2 bg-[#001d40] hover:bg-[#002855] text-white border-[#3c6ca8]/40 cursor-pointer"
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 className="w-3.5 h-3.5 text-blue-400" />
                    <span>Exit Full Screen</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
                    <span>Enter Full Screen</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* 3 Full-Height OS Application Tiles */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 sm:gap-6">
          {APPS.map((app) => (
            <div
              key={app.id}
              onClick={() => handleLaunchApp(app.id)}
              className={`bg-[#001b38] border border-[#3c6ca8]/30 ${app.accentBorder} rounded-2xl p-6 sm:p-7 shadow-lg hover:bg-[#002145] transition-all duration-150 cursor-pointer group flex flex-col justify-between min-h-[290px]`}
            >
              <div>
                <div className="flex items-center justify-between gap-3 mb-5">
                  <div className={`w-13 h-13 p-3 rounded-xl flex items-center justify-center ${app.iconBg} transition-transform duration-150 group-hover:scale-105`}>
                    {app.icon}
                  </div>
                  <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border ${app.badgeColor}`}>
                    {app.badge}
                  </span>
                </div>

                <h2 className="text-xl font-extrabold text-white group-hover:text-blue-300 transition-colors tracking-tight">
                  {app.title}
                </h2>
                <p className="text-xs sm:text-[13px] text-[#88a2c0] mt-2.5 leading-relaxed">
                  {app.desc}
                </p>

                {/* Feature Pills */}
                <div className="flex flex-wrap gap-1.5 mt-5">
                  {app.features.map((feat) => (
                    <span
                      key={feat}
                      className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-[#001326]/90 border border-[#3c6ca8]/25 text-slate-300"
                    >
                      {feat}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-5 mt-6 border-t border-[#3c6ca8]/20">
                <span className="text-xs font-bold text-blue-400 group-hover:text-blue-300 flex items-center gap-1.5">
                  {app.actionLabel}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </span>
                <span className="text-[11px] font-mono text-[#5a738e] group-hover:text-[#88a2c0]">
                  Click to open
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom OS Dock / Telemetry Strip */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-4 border-t border-[#3c6ca8]/20 text-xs text-[#88a2c0]">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#001b38] border border-[#3c6ca8]/25 text-slate-200 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>Operator: <strong className="text-white">{repName || 'Sales Rep'}</strong> ({repTitle})</span>
            </span>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#001b38] border border-[#3c6ca8]/25">
              <span>Offline Queue: <strong className={pendingSyncCount > 0 ? 'text-amber-400' : 'text-emerald-400'}>{pendingSyncCount === 0 ? 'All Synced' : `${pendingSyncCount} Pending`}</strong></span>
            </span>
          </div>
          <div className="text-[11px] text-[#5a738e]">
            Tip: Use the top OS bar to switch between Residential, Commercial, and B2B Phone workspaces at any time.
          </div>
        </div>
      </div>
    </div>
  );
}
