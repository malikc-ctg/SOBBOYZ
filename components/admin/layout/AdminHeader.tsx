'use client';

import Link from 'next/link';
import {
  LayoutGrid,
  Plus,
  Maximize2,
  Minimize2,
  LogOut,
} from 'lucide-react';
import {
  type WorkspaceConfig,
  type WorkspaceId,
  type WorkspaceNavItem,
  type UserProfileContext,
} from '@/lib/navigation/workspaces';
import type { OperationalCounts } from './WorkspaceSwitcher';
import { OperatorControlPopover } from './OperatorControlPopover';

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

export function AdminHeader({
  activeWorkspace,
  isLaunchpadView,
  onOpenLaunchpad,
  isNavItemActive,
  getItemBadgeCount,
  userProfile,
  clockTime,
  isFullscreen,
  onToggleFullscreen,
  onLogout,
}: AdminHeaderProps) {
  return (
    <div className="os-dock-bar relative shrink-0 z-40 select-none border-b text-foreground safe-top">
      {/* Primary Top OS Menu Bar */}
      <header className="h-14 md:h-12 px-3 sm:px-4 flex items-center justify-between gap-2">
        {/* LEFT: OS Launchpad Home Button */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenLaunchpad}
            aria-label="Open OS Launchpad"
            className={`h-10 w-10 justify-center md:w-auto md:justify-start md:h-8 px-0 md:px-2.5 rounded-lg text-xs font-bold flex items-center gap-1.5 border transition shrink-0 cursor-pointer ${
              isLaunchpadView
                ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                : 'os-tray-btn'
            }`}
            title="Sea of Blue OS Launchpad (All Workstations)"
          >
            <LayoutGrid
              className={`h-4 w-4 md:h-3.5 md:w-3.5 ${
                isLaunchpadView ? 'text-primary-foreground' : 'text-primary'
              }`}
            />
            <span className="hidden md:inline">OS Launchpad</span>
          </button>

          {/* Phone: current location label (desktop shows module tabs instead) */}
          <div className="md:hidden min-w-0 leading-tight">
            {isLaunchpadView ? (
              <p className="text-sm font-bold text-foreground truncate">Sea of Blue OS</p>
            ) : (
              <>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">
                  {activeWorkspace.shortName}
                </p>
                <p className="text-sm font-bold text-foreground truncate">
                  {(activeWorkspace.items.find((item) => isNavItemActive(item))?.label) ||
                    activeWorkspace.name}
                </p>
              </>
            )}
          </div>
        </div>

        {/* CENTER: Active Workstation Module Tabs (Desktop) */}
        {!isLaunchpadView && (
          <div className="hidden xl:flex flex-1 min-w-0 items-center justify-center px-2">
            <nav className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border overflow-x-auto scrollbar-none max-w-full">
              {activeWorkspace.items.map((item, idx) => {
                const TabIcon = item.icon;
                const active = isNavItemActive(item);
                const badgeCount = getItemBadgeCount(item);
                const prevGroup = idx > 0 ? activeWorkspace.items[idx - 1].group : item.group;
                const showGroupDivider = idx > 0 && item.group !== prevGroup;

                return (
                  <div key={item.id} className="flex items-center gap-1">
                    {showGroupDivider && (
                      <div className="h-4 w-px bg-border mx-0.5" />
                    )}
                    {item.group === 'Inbound CRM' && prevGroup !== 'Inbound CRM' && (
                      <span className="text-[9px] font-extrabold uppercase tracking-wider text-indigo-500 dark:text-indigo-300/80 px-1.5 hidden 2xl:inline">
                        Inbound
                      </span>
                    )}
                    {item.group === 'Outbound Sales OS' && prevGroup !== 'Outbound Sales OS' && (
                      <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400/80 px-1.5 hidden 2xl:inline">
                        Outbound
                      </span>
                    )}
                    <Link
                      href={item.href}
                      className={`px-2.5 xl:px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition whitespace-nowrap ${
                        active
                          ? 'bg-primary text-primary-foreground shadow-xs'
                          : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
                      }`}
                      title={item.description}
                    >
                      <TabIcon className="w-3.5 h-3.5 shrink-0" />
                      <span>{item.shortLabel || item.label}</span>
                      {badgeCount > 0 && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full ${
                            active
                              ? 'bg-black/25 text-white'
                              : 'bg-amber-500/20 text-amber-600 dark:text-amber-300'
                          }`}
                        >
                          {badgeCount}
                        </span>
                      )}
                    </Link>
                  </div>
                );
              })}
            </nav>
          </div>
        )}

        {/* RIGHT: OS System Tray (Quick Actions + Operator Pill Popover + Clock + Fullscreen + Logout) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {!isLaunchpadView && (
            <div className="flex items-center gap-1.5">
              <Link
                href="/sobadmin/jobs/new"
                aria-label="New Job"
                className="h-10 w-10 justify-center md:w-auto md:h-8 px-0 md:px-2.5 rounded-lg text-xs font-bold flex items-center gap-1 bg-primary hover:opacity-90 text-primary-foreground transition"
              >
                <Plus className="w-4 h-4 md:w-3.5 md:h-3.5" />
                <span className="hidden xl:inline">New Job</span>
              </Link>
            </div>
          )}

          {/* Interactive Operator & Glass Studio Pill */}
          {userProfile && (
            <OperatorControlPopover
              operator={{
                name: userProfile.full_name || 'Operator',
                title: userProfile.title,
                email: userProfile.email,
              }}
              onLogout={onLogout}
              showTitleBreakpoint="2xl"
              className={isLaunchpadView ? 'inline-flex' : 'hidden md:inline-flex'}
            />
          )}

          {/* System Clock */}
          {clockTime && (
            <span className="hidden 2xl:inline-block text-xs font-mono font-semibold text-muted-foreground px-1">
              {clockTime}
            </span>
          )}

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={onToggleFullscreen}
            title={isFullscreen ? 'Exit Full Screen (Esc)' : 'Enter Full Screen OS Mode'}
            className={`hidden md:flex h-8 px-2.5 rounded-lg text-xs font-bold items-center gap-1.5 border transition cursor-pointer ${
              isFullscreen
                ? 'bg-primary/15 text-primary border-primary/40 hover:bg-primary/25'
                : 'os-tray-btn'
            }`}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5 text-primary" />
                <span className="hidden md:inline">Exit Full</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5 text-primary" />
                <span className="hidden md:inline">Full Screen</span>
              </>
            )}
          </button>

          {/* Sign Out */}
          <button
            type="button"
            onClick={onLogout}
            title="Sign Out"
            aria-label="Sign Out"
            className={`${isLaunchpadView ? 'flex' : 'hidden md:flex'} h-10 w-10 justify-center md:w-auto md:h-8 px-0 md:px-2.5 rounded-lg text-xs font-semibold items-center gap-1.5 bg-red-500/15 hover:bg-red-500/25 text-red-600 dark:text-red-300 border border-red-500/40 hover:border-red-500/60 transition cursor-pointer`}
          >
            <LogOut className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
            <span className="hidden md:inline">Sign Out</span>
          </button>
        </div>
      </header>

      {/* Tablet Module Tab Bar (shown below top bar on screens md..xl when inside a workstation; phones use MobileBottomNav) */}
      {!isLaunchpadView && (
        <div className="os-subbar hidden md:flex xl:hidden items-center gap-1 px-2.5 py-1.5 border-t overflow-x-auto scrollbar-none">
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
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <TabIcon className="w-3.5 h-3.5 shrink-0" />
                <span>{item.shortLabel || item.label}</span>
                {badgeCount > 0 && (
                  <span className="text-[10px] font-bold px-1.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300">
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
