'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import {
  Radio,
  Waves,
  UserCheck,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';
import { type OperationalCounts } from './WorkspaceSwitcher';
import { type UserProfileContext, isLeadershipProfile } from '@/lib/navigation/workspaces';

interface SobOsLaunchpadProps {
  userProfile: UserProfileContext | null;
  counts: OperationalCounts;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onLogout: () => void;
}

export function SobOsLaunchpad({
  userProfile,
}: SobOsLaunchpadProps) {
  const router = useRouter();

  const canViewFinance = isLeadershipProfile(userProfile);

  const WORKSTATIONS = [
    {
      id: 'dispatch',
      href: '/sobadmin?app=dispatch',
      title: 'Dispatch & Field Ops',
      iconBg: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
      accentBorder: 'hover:border-blue-500/60',
      icon: <Radio className="w-6 h-6" />,
      desc: 'Manage live job dispatch, GPS crew tracking, scheduling, and recurring routes.',
      actionLabel: 'Launch Dispatch OS',
      visible: true,
    },
    {
      id: 'sales',
      href: '/sobadmin/sales',
      title: 'Sales OS & CRM',
      iconBg: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30',
      accentBorder: 'hover:border-indigo-500/60',
      icon: <Waves className="w-6 h-6" />,
      desc: 'Handle inbound leads, customer accounts, B2B cold calling, and field canvassing.',
      actionLabel: 'Launch Sales OS',
      visible: true,
    },
    {
      id: 'workforce',
      href: '/sobadmin/employees',
      title: 'Workforce & Supply',
      iconBg: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
      accentBorder: 'hover:border-emerald-500/60',
      icon: <UserCheck className="w-6 h-6" />,
      desc: 'Oversee active cleaning crews, contractor applications, timesheets, and supply kits.',
      actionLabel: 'Launch Workforce OS',
      visible: true,
    },
    {
      id: 'finance',
      href: '/sobadmin/finance',
      title: 'Finance & Executive',
      iconBg: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
      accentBorder: 'hover:border-amber-500/60',
      icon: <TrendingUp className="w-6 h-6" />,
      desc: 'Track executive P&L, QuickBooks sync, payroll payouts, audit logs, and system settings.',
      actionLabel: 'Launch Finance OS',
      visible: canViewFinance,
    },
  ].filter((w) => w.visible);

  const handleLaunchWorkstation = (href: string) => {
    router.push(href);
  };

  return (
    <div className="h-full w-full overflow-y-auto flex flex-col justify-between px-4 py-6 sm:px-8 sm:py-10 bg-[#001326] text-[#fffcf6] font-sans select-none">
      <div className="max-w-7xl w-full mx-auto my-auto space-y-7">
        {/* OS Workspace Hero Banner */}
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between border-b border-[#3c6ca8]/25 pb-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#001b38] border border-[#3c6ca8]/40 p-2 flex items-center justify-center shrink-0 shadow-md">
              <img
                src="/logo.png"
                alt="Sea of Blue"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/25 text-blue-400 mb-2">
                <Waves className="h-3.5 w-3.5" />
                <span className="text-[11px] font-bold uppercase tracking-widest">
                  Sea of Blue Operating System
                </span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-black tracking-tight text-white">
                Select Workstation
              </h1>
              <p className="text-xs sm:text-sm text-[#88a2c0] mt-1 max-w-2xl">
                Choose an operational environment below. Use the persistent top OS dock bar inside any workstation to switch modules or return here anytime.
              </p>
            </div>
          </div>
        </div>

        {/* 4 Big Visual OS Workstation Tiles */}
        <div
          className={`grid grid-cols-1 md:grid-cols-2 ${
            WORKSTATIONS.length === 4 ? 'xl:grid-cols-4' : 'xl:grid-cols-3'
          } gap-5`}
        >
          {WORKSTATIONS.map((ws) => (
            <div
              key={ws.id}
              onClick={() => handleLaunchWorkstation(ws.href)}
              className={`bg-[#001b38] border border-[#3c6ca8]/30 ${ws.accentBorder} rounded-2xl p-6 shadow-lg hover:bg-[#002145] transition-all duration-150 cursor-pointer group flex flex-col justify-between`}
            >
              <div>
                <div
                  className={`w-12 h-12 p-3 rounded-xl flex items-center justify-center mb-5 ${ws.iconBg} transition-transform duration-150 group-hover:scale-105`}
                >
                  {ws.icon}
                </div>

                <h2 className="text-xl font-extrabold text-white group-hover:text-blue-300 transition-colors tracking-tight">
                  {ws.title}
                </h2>
                <p className="text-xs text-[#88a2c0] mt-2 leading-relaxed">
                  {ws.desc}
                </p>
              </div>

              <div className="flex items-center pt-5 mt-6 border-t border-[#3c6ca8]/20">
                <span className="text-xs font-bold text-blue-400 group-hover:text-blue-300 flex items-center gap-1.5">
                  {ws.actionLabel}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
