'use client';

import Link from 'next/link';
import {
  LayoutGrid,
  Plus,
  Maximize2,
  Minimize2,
  LogOut,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CRMPricingModal } from '@/components/admin/leads/CRMPricingModal';
import {
  type WorkspaceConfig,
  type WorkspaceId,
  type WorkspaceNavItem,
  type UserProfileContext,
} from '@/lib/navigation/workspaces';
import type { OperationalCounts } from './WorkspaceSwitcher';

interface AdminHeaderProps {
  workspaces: WorkspaceConfig[];
  activeWorkspace: WorkspaceConfig;
  isLaunchpadView: boolean;
  onOpenLaunchpad: () => void;
  onSelectWorkspace: (workspaceId: WorkspaceId) => void;
  isNavItemActive: (item: WorkspaceNavItem) => boolean;
  getItemBadgeCount: (item: WorkspaceNavItem) => number;
  counts: OperationalCounts;
  userProfile: UserProfileContext | null;
  clockTime: string;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onLogout: () => void;
  onRefreshCounts?: () => void;
}

const WORKSTATION_ACTIVE_CLASSES: Record<WorkspaceId, string> = {
  dispatch: 'bg-blue-600 text-white border-blue-500',
  sales: 'bg-indigo-600 text-white border-indigo-500',
  workforce: 'bg-emerald-600 text-white border-emerald-500',
  finance: 'bg-amber-600 text-white border-amber-500',
};

export function AdminHeader({
  workspaces,
  activeWorkspace,
  isLaunchpadView,
  onOpenLaunchpad,
  onSelectWorkspace,
  isNavItemActive,
  getItemBadgeCount,
  counts,
  userProfile,
  clockTime,
  isFullscreen,
  onToggleFullscreen,
  onLogout,
  onRefreshCounts,
}: AdminHeaderProps) {
  return (
    <div className="shrink-0 z-40 select-none bg-[#000d1a]/95 border-b border-[#3c6ca8]/25 text-[#fffcf6]">
      {/* Primary Top OS Menu Bar */}
      <header className="h-12 px-2.5 sm:px-4 flex items-center justify-between gap-2">
        {/* LEFT: OS Launchpad Home Button + Direct Workstation Switcher Pills */}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <button
            type="button"
            onClick={onOpenLaunchpad}
            className={`h-8 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition shrink-0 cursor-pointer ${
              isLaunchpadView
                ? 'bg-blue-600 text-white border-blue-500 shadow-xs'
                : 'bg-[#001b38]/90 hover:bg-[#002855] text-slate-200 hover:text-white border-[#3c6ca8]/30'
            }`}
            title="Sea of Blue OS Launchpad (All Workstations)"
          >
            <LayoutGrid className="h-3.5 w-3.5 text-blue-300" />
            <span className="hidden sm:inline">OS Launchpad</span>
          </button>

          {!isLaunchpadView && (
            <>
              <div className="h-4 w-px bg-[#3c6ca8]/25 hidden sm:block" />

              {/* Direct Workstation Switcher Dock */}
              <div className="flex items-center gap-1 bg-[#001326] p-0.5 rounded-lg border border-[#3c6ca8]/25 overflow-x-auto scrollbar-none">
                {workspaces.map((ws) => {
                  const Icon = ws.icon;
                  const isSelected = activeWorkspace.id === ws.id;
                  return (
                    <button
                      key={ws.id}
                      type="button"
                      onClick={() => onSelectWorkspace(ws.id)}
                      className={`h-7 px-2 sm:px-2.5 rounded-md text-[11px] font-bold flex items-center gap-1.5 transition shrink-0 cursor-pointer ${
                        isSelected
                          ? WORKSTATION_ACTIVE_CLASSES[ws.id]
                          : 'text-[#88a2c0] hover:text-white hover:bg-[#001d40]'
                      }`}
                      title={`Switch to ${ws.name} (⌘${ws.shortcut})`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="hidden md:inline">{ws.shortName}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* CENTER: Active Workstation Module Tabs (Desktop) */}
        {!isLaunchpadView && (
          <nav className="hidden lg:flex items-center gap-1 bg-[#001326] p-1 rounded-xl border border-[#3c6ca8]/30 shrink-0">
            {activeWorkspace.items.map((item) => {
              const TabIcon = item.icon;
              const active = isNavItemActive(item);
              const badgeCount = getItemBadgeCount(item);

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`px-2.5 xl:px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition ${
                    active
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-[#88a2c0] hover:text-white hover:bg-[#001d40]'
                  }`}
                  title={item.description}
                >
                  <TabIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.shortLabel || item.label}</span>
                  {badgeCount > 0 && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                        active
                          ? 'bg-black/30 text-white'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {badgeCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        )}

        {/* RIGHT: OS System Tray (Quick Actions + Operator Pill + Clock + Fullscreen + Logout) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {!isLaunchpadView && (
            <div className="hidden md:flex items-center gap-1.5">
              <CRMPricingModal onSuccess={onRefreshCounts} />
              <Link
                href="/sobadmin/jobs/new"
                className="h-8 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1 bg-blue-600 hover:bg-blue-500 text-white transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">New Job</span>
              </Link>
            </div>
          )}

          {/* Operator Status Badge */}
          {userProfile && (
            <Badge
              variant="outline"
              className="hidden sm:inline-flex h-8 px-2.5 text-[11px] gap-1.5 border-[#3c6ca8]/30 bg-[#001b38] text-slate-200 font-sans"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
              <span className="font-bold text-white truncate max-w-[110px]">
                {userProfile.full_name}
              </span>
              <span className="text-[#88a2c0] hidden 2xl:inline">
                • {userProfile.title}
              </span>
            </Badge>
          )}

          {/* System Clock */}
          {clockTime && (
            <span className="hidden 2xl:inline-block text-xs font-mono font-semibold text-[#88a2c0] px-1">
              {clockTime}
            </span>
          )}

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={onToggleFullscreen}
            title={isFullscreen ? 'Exit Full Screen (Esc)' : 'Enter Full Screen OS Mode'}
            className={`h-8 px-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition cursor-pointer ${
              isFullscreen
                ? 'bg-blue-500/20 text-blue-300 border-blue-500/40 hover:bg-blue-500/30'
                : 'bg-[#001b38] text-slate-200 border-[#3c6ca8]/35 hover:bg-[#002855] hover:text-white'
            }`}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden md:inline">Exit Full</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
                <span className="hidden md:inline">Full Screen</span>
              </>
            )}
          </button>

          {/* Sign Out */}
          <button
            type="button"
            onClick={onLogout}
            title="Sign Out"
            className="h-8 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-300 hover:text-red-200 border border-red-500/40 hover:border-red-500/60 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-red-400" />
            <span className="hidden md:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Mobile / Tablet Module Tab Bar (shown below top bar on screens < lg when inside a workstation) */}
      {!isLaunchpadView && (
        <div className="lg:hidden flex items-center gap-1 px-2.5 py-1.5 bg-[#001326] border-t border-[#3c6ca8]/20 overflow-x-auto scrollbar-none">
          {activeWorkspace.items.map((item) => {
            const TabIcon = item.icon;
            const active = isNavItemActive(item);
            const badgeCount = getItemBadgeCount(item);

            return (
              <Link
                key={item.id}
                href={item.href}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-[#88a2c0] hover:text-white'
                }`}
              >
                <TabIcon className="w-3.5 h-3.5 shrink-0" />
                <span>{item.shortLabel || item.label}</span>
                {badgeCount > 0 && (
                  <span className="text-[10px] font-bold px-1.5 rounded-full bg-amber-500/20 text-amber-300">
                    {badgeCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
