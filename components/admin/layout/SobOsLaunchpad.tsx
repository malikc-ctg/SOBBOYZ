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

interface WorkstationQuickLink {
  label: string;
  href: string;
}

interface WorkstationQuickGroup {
  groupLabel: string;
  groupAccentClass: string;
  links: WorkstationQuickLink[];
}

export function SobOsLaunchpad({
  userProfile,
  counts,
}: SobOsLaunchpadProps) {
  const router = useRouter();

  const canViewFinance = isLeadershipProfile(userProfile);

  const WORKSTATIONS = [
    {
      id: 'dispatch',
      href: '/sobadmin?app=dispatch',
      title: 'Dispatch & Field Ops',
      badge:
        counts.unassignedJobs > 0
          ? `${counts.unassignedJobs} Needs Dispatch`
          : counts.activeJobs > 0
          ? `${counts.activeJobs} Active Now`
          : 'Live Command OS',
      badgeColor:
        counts.unassignedJobs > 0
          ? 'text-amber-300 border-amber-500/40 bg-amber-500/15'
          : 'text-blue-400 border-blue-500/30 bg-blue-500/10',
      iconBg: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
      accentBorder: 'hover:border-blue-500/60',
      icon: <Radio className="w-6 h-6" />,
      desc: 'Real-time dispatch command queue, live GPS crew tracking map, job scheduling, automated recurring service engine, and GTA zone coverage.',
      features: [
        'Command Queue',
        'Live GPS Map',
        'Jobs & Dispatch',
        'Recurring Engine',
        'Service Zones',
      ],
      quickLinks: [
        { label: 'Command Queue', href: '/sobadmin?app=dispatch' },
        { label: 'Live Map', href: '/sobadmin?app=dispatch&view=map' },
        { label: 'Jobs', href: '/sobadmin/jobs' },
        { label: 'Recurring', href: '/sobadmin/recurring' },
      ],
      quickGroups: undefined as WorkstationQuickGroup[] | undefined,
      actionLabel: 'Launch Dispatch OS',
      visible: true,
    },
    {
      id: 'sales',
      href: '/sobadmin/sales',
      title: 'Sales OS & CRM',
      badge:
        counts.newLeads > 0
          ? `${counts.newLeads} New Inbound Leads`
          : 'Inbound & Outbound OS',
      badgeColor: 'text-indigo-300 border-indigo-500/30 bg-indigo-500/10',
      iconBg: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30',
      accentBorder: 'hover:border-indigo-500/60',
      icon: <Waves className="w-6 h-6" />,
      desc: 'Split Inbound CRM (Website/LSA leads, instant quotes & customer accounts) and Outbound Sales OS (B2B Phone cold outreach & KnockLog field canvassing).',
      features: [
        'Inbound Leads',
        'Customer Accounts',
        'B2B Phone OS',
        'KnockLog Residential',
        'KnockLog Commercial',
      ],
      quickLinks: [],
      quickGroups: [
        {
          groupLabel: 'Inbound CRM',
          groupAccentClass: 'text-indigo-300',
          links: [
            { label: 'Inbound Leads', href: '/sobadmin/leads' },
            { label: 'Customers CRM', href: '/sobadmin/customers' },
          ],
        },
        {
          groupLabel: 'Outbound Sales OS',
          groupAccentClass: 'text-emerald-400',
          links: [
            { label: 'B2B Phone', href: '/sobadmin/sales?app=phone' },
            { label: 'Residential', href: '/sobadmin/sales?app=residential' },
            { label: 'Commercial', href: '/sobadmin/sales?app=commercial' },
          ],
        },
      ],
      actionLabel: 'Launch Sales & CRM Hub',
      visible: true,
    },
    {
      id: 'workforce',
      href: '/sobadmin/employees',
      title: 'Workforce & Supply',
      badge:
        counts.pendingApplications > 0
          ? `${counts.pendingApplications} Applicants Waiting`
          : 'Roster & Inventory OS',
      badgeColor: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
      iconBg: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
      accentBorder: 'hover:border-emerald-500/60',
      icon: <UserCheck className="w-6 h-6" />,
      desc: 'Manage active cleaning crews, hourly compensation, timesheet approvals, incoming contractor applications, and chemical/equipment supply kits.',
      features: [
        'Active Cleaner Roster',
        'Timesheet Approvals',
        'Applicant Pipeline',
        'Supply & Equipment OS',
      ],
      quickLinks: [
        { label: 'Cleaners & Roster', href: '/sobadmin/employees' },
        { label: 'Applicants', href: '/sobadmin/employees/applications' },
        { label: 'Supply OS', href: '/sobadmin/supply' },
      ],
      quickGroups: undefined as WorkstationQuickGroup[] | undefined,
      actionLabel: 'Launch Workforce OS',
      visible: true,
    },
    {
      id: 'finance',
      href: '/sobadmin/finance',
      title: 'Finance & Executive',
      badge: 'QBO & Unit Economics',
      badgeColor: 'text-amber-300 border-amber-500/30 bg-amber-500/10',
      iconBg: 'bg-amber-500/15 text-amber-300 border border-amber-500/30',
      accentBorder: 'hover:border-amber-500/60',
      icon: <TrendingUp className="w-6 h-6" />,
      desc: 'Executive P&L suite, QuickBooks Online sync, weekly ad spend ROI, cleaner payroll runs, vendor payouts, compliance vault, and audit trail.',
      features: [
        'Overview & QBO Sync',
        'Cleaner Payroll',
        'Vendor Payouts',
        'Audit & Call Vault',
        'System Settings',
      ],
      quickLinks: [
        { label: 'Finance & P&L', href: '/sobadmin/finance' },
        { label: 'Payouts', href: '/sobadmin/payouts' },
        { label: 'Audit Vault', href: '/sobadmin/audit' },
        { label: 'Settings', href: '/sobadmin/settings' },
      ],
      quickGroups: undefined as WorkstationQuickGroup[] | undefined,
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
              className={`bg-[#001b38] border border-[#3c6ca8]/30 ${ws.accentBorder} rounded-2xl p-6 shadow-lg hover:bg-[#002145] transition-all duration-150 cursor-pointer group flex flex-col justify-between min-h-[320px]`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-5">
                  <div
                    className={`w-12 h-12 p-3 rounded-xl flex items-center justify-center ${ws.iconBg} transition-transform duration-150 group-hover:scale-105`}
                  >
                    {ws.icon}
                  </div>
                  <span
                    className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border ${ws.badgeColor}`}
                  >
                    {ws.badge}
                  </span>
                </div>

                <h2 className="text-xl font-extrabold text-white group-hover:text-blue-300 transition-colors tracking-tight">
                  {ws.title}
                </h2>
                <p className="text-xs text-[#88a2c0] mt-2 leading-relaxed">
                  {ws.desc}
                </p>

                {/* Direct Sub-Module Jump Pills */}
                <div className="mt-5 pt-4 border-t border-[#3c6ca8]/20">
                  {ws.quickGroups ? (
                    <div className="space-y-3">
                      {ws.quickGroups.map((group) => (
                        <div key={group.groupLabel}>
                          <p
                            className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${group.groupAccentClass}`}
                          >
                            {group.groupLabel}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {group.links.map((ql) => (
                              <button
                                key={ql.href}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleLaunchWorkstation(ql.href);
                                }}
                                className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-[#001326]/90 hover:bg-blue-600 hover:text-white border border-[#3c6ca8]/30 text-slate-300 transition-colors cursor-pointer"
                              >
                                {ql.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#5a738e] mb-2">
                        Quick Jump Into Module
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {ws.quickLinks.map((ql) => (
                          <button
                            key={ql.href}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLaunchWorkstation(ql.href);
                            }}
                            className="text-[11px] font-semibold px-2.5 py-1 rounded-md bg-[#001326]/90 hover:bg-blue-600 hover:text-white border border-[#3c6ca8]/30 text-slate-300 transition-colors cursor-pointer"
                          >
                            {ql.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-5 mt-5 border-t border-[#3c6ca8]/20">
                <span className="text-xs font-bold text-blue-400 group-hover:text-blue-300 flex items-center gap-1.5">
                  {ws.actionLabel}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </span>
                <span className="text-[11px] font-mono text-[#5a738e] group-hover:text-[#88a2c0]">
                  Open Suite
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
