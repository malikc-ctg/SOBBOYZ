'use client';

import React, { useEffect, useState } from 'react';
import {
  Home,
  Building2,
  PhoneCall,
  ClipboardList,
  Users,
  ArrowRight,
  Waves,
  Inbox,
  Send,
} from 'lucide-react';

export default function SalesLaunchpad({
  repName,
  repTitle = 'Account Executive',
  user,
  onSelectApp,
  onNavigateHref,
  onLogout,
  isFullscreen = false,
  onToggleFullscreen,
  pendingSyncCount = 0,
}) {
  const [inboundCount, setInboundCount] = useState(0);
  const [customerCount, setCustomerCount] = useState(0);

  useEffect(() => {
    async function loadCrmCounts() {
      try {
        const [leadsRes, custRes] = await Promise.allSettled([
          fetch('/api/leads'),
          fetch('/api/customers'),
        ]);

        if (leadsRes.status === 'fulfilled' && leadsRes.value.ok) {
          const leads = await leadsRes.value.json();
          if (Array.isArray(leads)) {
            const newInbound = leads.filter((l) => {
              const src = String(l.source || '').toLowerCase();
              if (
                src === 'quo_telephony' ||
                src.includes('quo') ||
                src === 'contact_import' ||
                src === 'phone_sales_os'
              ) {
                return false;
              }
              return l.status === 'new';
            }).length;
            setInboundCount(newInbound);
          }
        }

        if (custRes.status === 'fulfilled' && custRes.value.ok) {
          const customers = await custRes.value.json();
          if (Array.isArray(customers)) {
            setCustomerCount(customers.length);
          }
        }
      } catch {
        // Ignore background fetch errors
      }
    }
    loadCrmCounts();
  }, []);

  const INBOUND_MODULES = [
    {
      id: 'inbound-leads',
      href: '/sobadmin/leads',
      title: 'Inbound Leads & Quotes',
      badge:
        inboundCount > 0
          ? `${inboundCount} New Inbound`
          : 'Website • LSA • Calls',
      badgeColor:
        inboundCount > 0
          ? 'text-indigo-300 border-indigo-500/40 bg-indigo-500/15'
          : 'text-indigo-300 border-indigo-500/30 bg-indigo-500/10',
      iconBg: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30',
      accentBorder: 'hover:border-indigo-500/60',
      icon: <ClipboardList className="w-6 h-6" />,
      desc: 'Incoming inquiries from Google Local Service Ads, website forms, referrals, and inbound calls. Includes the Instant Pricing Calculator and 1-click job conversion.',
      features: [
        'Website & LSA Leads',
        'Instant Quote Calculator',
        'Scope of Work Generator',
        '1-Click Job Conversion',
      ],
      actionLabel: 'Open Inbound Leads',
    },
    {
      id: 'customers-crm',
      href: '/sobadmin/customers',
      title: 'Customer Accounts CRM',
      badge:
        customerCount > 0
          ? `${customerCount} Active Accounts`
          : 'Enterprise CRM',
      badgeColor: 'text-cyan-300 border-cyan-500/30 bg-cyan-500/10',
      iconBg: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30',
      accentBorder: 'hover:border-cyan-500/60',
      icon: <Users className="w-6 h-6" />,
      desc: 'Active residential and commercial client directory. Track recurring VIP subscriptions, monthly recurring revenue (MRR), service history, and open balances.',
      features: [
        'Residential & Commercial',
        'Recurring MRR Contracts',
        'At-Risk Client Radar',
        'Service & Billing History',
      ],
      actionLabel: 'Open Customer Accounts',
    },
  ];

  const OUTBOUND_APPS = [
    {
      id: 'phone',
      title: 'B2B Phone Sales OS',
      badge: 'Inside Cold Outreach',
      badgeColor: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
      iconBg: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
      accentBorder: 'hover:border-emerald-500/60',
      icon: <PhoneCall className="w-6 h-6" />,
      desc: 'Full-screen inside tele-sales workstation for commercial property managers & general contractors. Apollo CSV imports, multi-sector Kanban pipeline, Touch Centre, and Quo AI sync.',
      features: [
        'Sector Kanban Board',
        'Touch Centre Cadence',
        'Quo Call & AI Sync',
        'Apollo CSV Importer',
      ],
      actionLabel: 'Launch B2B Phone OS',
    },
    {
      id: 'residential',
      title: 'KnockLog Residential',
      badge: 'D2D Field Canvassing',
      badgeColor: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
      iconBg: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
      accentBorder: 'hover:border-blue-500/60',
      icon: <Home className="w-6 h-6" />,
      desc: 'Door-to-door residential territory canvassing, automated house number stepping, soft-wash & bin pitch scripts, and instant GPS pin logging.',
      features: [
        'Auto House # Step',
        'Live Territory Map',
        'Offline Sync Queue',
        'Team Leaderboard',
      ],
      actionLabel: 'Launch Residential OS',
    },
    {
      id: 'commercial',
      title: 'KnockLog Commercial',
      badge: 'B2B Field Canvassing',
      badgeColor: 'text-purple-300 border-purple-500/30 bg-purple-500/10',
      iconBg: 'bg-purple-500/15 text-purple-300 border border-purple-500/30',
      accentBorder: 'hover:border-purple-500/60',
      icon: <Building2 className="w-6 h-6" />,
      desc: 'Plaza & storefront field canvassing. Track company names, suite numbers, facility types, decision-maker status, and on-site walkthrough bookings.',
      features: [
        'Plaza & Suite Logging',
        'Decision-Maker Radar',
        'Walkthrough Booking',
        'Follow-Up Alerts',
      ],
      actionLabel: 'Launch Commercial OS',
    },
  ];

  const handleOpenInbound = (href) => {
    if (onNavigateHref) {
      onNavigateHref(href);
    } else if (typeof window !== 'undefined') {
      window.location.href = href;
    }
  };

  const handleLaunchOutbound = (appId) => {
    onSelectApp(appId);
  };

  return (
    <div className="h-full w-full overflow-y-auto flex flex-col justify-between px-4 py-6 sm:px-8 sm:py-8 bg-[#001326] text-[#fffcf6] font-sans select-none">
      <div className="max-w-7xl w-full mx-auto my-auto space-y-7">
        {/* OS Workspace Hero Banner */}
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between border-b border-[#3c6ca8]/25 pb-5">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 mb-2">
              <Waves className="h-3.5 w-3.5" />
              <span className="text-[11px] font-bold uppercase tracking-widest">
                Sales OS & CRM Workstation
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white font-display">
              Inbound CRM & Outbound Sales OS
            </h1>
            <p className="text-xs sm:text-sm text-[#88a2c0] mt-1 max-w-2xl">
              Manage incoming quote inquiries & active client accounts in{' '}
              <strong className="text-indigo-300 font-semibold">Inbound CRM</strong>, or launch an{' '}
              <strong className="text-emerald-400 font-semibold">Outbound Sales OS</strong> engine for B2B cold calling and field canvassing.
            </p>
          </div>
        </div>

        {/* SECTION 1: INBOUND CRM & ACCOUNTS */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-300">
                <Inbox className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-300">
                Inbound CRM & Client Accounts
              </span>
              <span className="text-[11px] text-[#5a738e] hidden sm:inline">
                — Website, Google LSA, Inbound Calls, Instant Quotes & Active Customers
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
            {INBOUND_MODULES.map((mod) => (
              <div
                key={mod.id}
                onClick={() => handleOpenInbound(mod.href)}
                className={`bg-[#001b38] border border-[#3c6ca8]/30 ${mod.accentBorder} rounded-2xl p-5 sm:p-6 shadow-lg hover:bg-[#002145] transition-all duration-150 cursor-pointer group flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div
                      className={`w-11 h-11 p-2.5 rounded-xl flex items-center justify-center ${mod.iconBg} transition-transform duration-150 group-hover:scale-105`}
                    >
                      {mod.icon}
                    </div>
                    <span
                      className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border ${mod.badgeColor}`}
                    >
                      {mod.badge}
                    </span>
                  </div>

                  <h2 className="text-lg sm:text-xl font-extrabold text-white group-hover:text-indigo-300 transition-colors tracking-tight">
                    {mod.title}
                  </h2>
                  <p className="text-xs text-[#88a2c0] mt-2 leading-relaxed">
                    {mod.desc}
                  </p>

                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {mod.features.map((feat) => (
                      <span
                        key={feat}
                        className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-[#001326]/90 border border-[#3c6ca8]/25 text-slate-300"
                      >
                        {feat}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 mt-5 border-t border-[#3c6ca8]/20">
                  <span className="text-xs font-bold text-indigo-300 group-hover:text-indigo-200 flex items-center gap-1.5">
                    {mod.actionLabel}
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </span>
                  <span className="text-[11px] font-mono text-[#5a738e] group-hover:text-[#88a2c0]">
                    Inbound CRM
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 2: OUTBOUND SALES OS ENGINES */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-2">
              <span className="w-6 h-6 rounded-md bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <Send className="w-3.5 h-3.5" />
              </span>
              <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                Outbound Sales OS Engines
              </span>
              <span className="text-[11px] text-[#5a738e] hidden sm:inline">
                — B2B Cold Calling, Apollo Lists & Door-to-Door Field Canvassing
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
            {OUTBOUND_APPS.map((app) => (
              <div
                key={app.id}
                onClick={() => handleLaunchOutbound(app.id)}
                className={`bg-[#001b38] border border-[#3c6ca8]/30 ${app.accentBorder} rounded-2xl p-5 sm:p-6 shadow-lg hover:bg-[#002145] transition-all duration-150 cursor-pointer group flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div
                      className={`w-11 h-11 p-2.5 rounded-xl flex items-center justify-center ${app.iconBg} transition-transform duration-150 group-hover:scale-105`}
                    >
                      {app.icon}
                    </div>
                    <span
                      className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border ${app.badgeColor}`}
                    >
                      {app.badge}
                    </span>
                  </div>

                  <h2 className="text-lg sm:text-xl font-extrabold text-white group-hover:text-blue-300 transition-colors tracking-tight">
                    {app.title}
                  </h2>
                  <p className="text-xs text-[#88a2c0] mt-2 leading-relaxed">
                    {app.desc}
                  </p>

                  <div className="flex flex-wrap gap-1.5 mt-4">
                    {app.features.map((feat) => (
                      <span
                        key={feat}
                        className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-[#001326]/90 border border-[#3c6ca8]/25 text-slate-300"
                      >
                        {feat}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 mt-5 border-t border-[#3c6ca8]/20">
                  <span className="text-xs font-bold text-blue-400 group-hover:text-blue-300 flex items-center gap-1.5">
                    {app.actionLabel}
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </span>
                  <span className="text-[11px] font-mono text-[#5a738e] group-hover:text-[#88a2c0]">
                    Outbound OS
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
