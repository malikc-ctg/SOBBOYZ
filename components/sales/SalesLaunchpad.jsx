'use client';

import React from 'react';
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
  onSelectApp,
  onNavigateHref,
}) {
  const INBOUND_MODULES = [
    {
      id: 'inbound-leads',
      href: '/sobadmin/leads',
      title: 'Inbound Leads & Quotes',
      iconBg: 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30',
      accentBorder: 'hover:border-indigo-500/60',
      icon: <ClipboardList className="w-6 h-6" />,
      desc: 'Manage incoming quote inquiries from website forms, Google LSA, referrals, and inbound calls.',
      actionLabel: 'Open Inbound Leads',
    },
    {
      id: 'customers-crm',
      href: '/sobadmin/customers',
      title: 'Customer Accounts CRM',
      iconBg: 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30',
      accentBorder: 'hover:border-cyan-500/60',
      icon: <Users className="w-6 h-6" />,
      desc: 'View active residential and commercial clients, recurring contracts, service history, and billing.',
      actionLabel: 'Open Customer Accounts',
    },
  ];

  const OUTBOUND_APPS = [
    {
      id: 'phone',
      title: 'B2B Phone Sales OS',
      iconBg: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
      accentBorder: 'hover:border-emerald-500/60',
      icon: <PhoneCall className="w-6 h-6" />,
      desc: 'Inside cold calling workstation with sector Kanban boards, Touch Centre cadences, and Quo call sync.',
      actionLabel: 'Launch B2B Phone OS',
    },
    {
      id: 'residential',
      title: 'KnockLog Residential',
      iconBg: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
      accentBorder: 'hover:border-blue-500/60',
      icon: <Home className="w-6 h-6" />,
      desc: 'Door-to-door residential canvassing with auto house stepping, live territory maps, and GPS pin logging.',
      actionLabel: 'Launch Residential OS',
    },
    {
      id: 'commercial',
      title: 'KnockLog Commercial',
      iconBg: 'bg-purple-500/15 text-purple-300 border border-purple-500/30',
      accentBorder: 'hover:border-purple-500/60',
      icon: <Building2 className="w-6 h-6" />,
      desc: 'Field canvassing for commercial plazas and storefronts to log suites, decision-makers, and walkthroughs.',
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
          <div className="inline-flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center text-indigo-300">
              <Inbox className="w-3.5 h-3.5" />
            </span>
            <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-300">
              Inbound CRM
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
            {INBOUND_MODULES.map((mod) => (
              <div
                key={mod.id}
                onClick={() => handleOpenInbound(mod.href)}
                className={`bg-[#001b38] border border-[#3c6ca8]/30 ${mod.accentBorder} rounded-2xl p-5 sm:p-6 shadow-lg hover:bg-[#002145] transition-all duration-150 cursor-pointer group flex flex-col justify-between`}
              >
                <div>
                  <div
                    className={`w-12 h-12 p-3 rounded-xl flex items-center justify-center mb-5 ${mod.iconBg} transition-transform duration-150 group-hover:scale-105`}
                  >
                    {mod.icon}
                  </div>

                  <h2 className="text-xl font-extrabold text-white group-hover:text-indigo-300 transition-colors tracking-tight">
                    {mod.title}
                  </h2>
                  <p className="text-xs text-[#88a2c0] mt-2 leading-relaxed">
                    {mod.desc}
                  </p>
                </div>

                <div className="flex items-center pt-5 mt-6 border-t border-[#3c6ca8]/20">
                  <span className="text-xs font-bold text-indigo-300 group-hover:text-indigo-200 flex items-center gap-1.5">
                    {mod.actionLabel}
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* SECTION 2: OUTBOUND SALES OS ENGINES */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2">
            <span className="w-6 h-6 rounded-md bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Send className="w-3.5 h-3.5" />
            </span>
            <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
              Outbound Sales OS
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
            {OUTBOUND_APPS.map((app) => (
              <div
                key={app.id}
                onClick={() => handleLaunchOutbound(app.id)}
                className={`bg-[#001b38] border border-[#3c6ca8]/30 ${app.accentBorder} rounded-2xl p-5 sm:p-6 shadow-lg hover:bg-[#002145] transition-all duration-150 cursor-pointer group flex flex-col justify-between`}
              >
                <div>
                  <div
                    className={`w-12 h-12 p-3 rounded-xl flex items-center justify-center mb-5 ${app.iconBg} transition-transform duration-150 group-hover:scale-105`}
                  >
                    {app.icon}
                  </div>

                  <h2 className="text-xl font-extrabold text-white group-hover:text-blue-300 transition-colors tracking-tight">
                    {app.title}
                  </h2>
                  <p className="text-xs text-[#88a2c0] mt-2 leading-relaxed">
                    {app.desc}
                  </p>
                </div>

                <div className="flex items-center pt-5 mt-6 border-t border-[#3c6ca8]/20">
                  <span className="text-xs font-bold text-blue-400 group-hover:text-blue-300 flex items-center gap-1.5">
                    {app.actionLabel}
                    <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
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
