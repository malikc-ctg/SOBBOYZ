'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { MoreHorizontal, LayoutGrid, Plus, LogOut } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  type WorkspaceConfig,
  type WorkspaceId,
  type WorkspaceNavItem,
} from '@/lib/navigation/workspaces';

interface MobileBottomNavProps {
  workspaces: WorkspaceConfig[];
  activeWorkspace: WorkspaceConfig;
  onSelectWorkspace: (workspaceId: WorkspaceId) => void;
  onOpenLaunchpad: () => void;
  isNavItemActive: (item: WorkspaceNavItem) => boolean;
  getItemBadgeCount: (item: WorkspaceNavItem) => number;
  onLogout: () => void;
}

const MAX_INLINE_ITEMS = 5;

/**
 * Phone-only (< md) thumb-reach navigation for the active workstation.
 * Shows up to 5 modules inline; larger workstations get 4 modules + "More",
 * which opens a bottom sheet with every module, workstation switching and sign out.
 */
export function MobileBottomNav({
  workspaces,
  activeWorkspace,
  onSelectWorkspace,
  onOpenLaunchpad,
  isNavItemActive,
  getItemBadgeCount,
  onLogout,
}: MobileBottomNavProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Close the sheet after any navigation
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname, searchParams]);

  const items = activeWorkspace.items;
  const needsMore = items.length > MAX_INLINE_ITEMS;
  const inlineItems = needsMore ? items.slice(0, MAX_INLINE_ITEMS - 1) : items;
  const overflowItems = needsMore ? items.slice(MAX_INLINE_ITEMS - 1) : [];
  const overflowActive = overflowItems.some((item) => isNavItemActive(item));
  const overflowBadge = overflowItems.reduce((sum, item) => sum + getItemBadgeCount(item), 0);

  return (
    <>
      <nav
        aria-label={`${activeWorkspace.shortName} modules`}
        className="md:hidden shrink-0 z-40 bg-[#000d1a]/95 border-t border-[#3c6ca8]/25 safe-bottom select-none"
      >
        <ul className="flex items-stretch">
          {inlineItems.map((item) => {
            const Icon = item.icon;
            const active = isNavItemActive(item);
            const badge = getItemBadgeCount(item);
            return (
              <li key={item.id} className="flex-1 min-w-0">
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`relative flex h-14 flex-col items-center justify-center gap-0.5 px-1 transition-colors ${
                    active ? 'text-white' : 'text-[#88a2c0] active:text-white'
                  }`}
                >
                  {active && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-blue-500" />
                  )}
                  <span className="relative">
                    <Icon className={`h-5 w-5 ${active ? 'text-blue-400' : ''}`} />
                    {badge > 0 && (
                      <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-[10px] font-bold leading-4 text-[#001326] text-center">
                        {badge > 99 ? '99+' : badge}
                      </span>
                    )}
                  </span>
                  <span className="max-w-full truncate text-[10px] font-semibold leading-tight">
                    {item.shortLabel || item.label}
                  </span>
                </Link>
              </li>
            );
          })}

          {needsMore && (
            <li className="flex-1 min-w-0">
              <button
                type="button"
                onClick={() => setMoreOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={moreOpen}
                className={`relative flex h-14 w-full flex-col items-center justify-center gap-0.5 px-1 transition-colors cursor-pointer ${
                  overflowActive ? 'text-white' : 'text-[#88a2c0] active:text-white'
                }`}
              >
                {overflowActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-blue-500" />
                )}
                <span className="relative">
                  <MoreHorizontal className={`h-5 w-5 ${overflowActive ? 'text-blue-400' : ''}`} />
                  {overflowBadge > 0 && (
                    <span className="absolute -top-1 -right-1.5 h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-[#000d1a]" />
                  )}
                </span>
                <span className="text-[10px] font-semibold leading-tight">More</span>
              </button>
            </li>
          )}
        </ul>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="dark md:hidden bg-[#001326] border-[#3c6ca8]/30 text-[#fffcf6] rounded-t-2xl p-0 max-h-[85dvh] overflow-y-auto safe-bottom"
        >
          <SheetHeader className="px-4 pt-4 pb-2 text-left">
            <SheetTitle className="text-base font-bold text-white">
              {activeWorkspace.name}
            </SheetTitle>
          </SheetHeader>

          {overflowItems.length > 0 && (
            <ul className="px-2 pb-2">
              {overflowItems.map((item) => {
                const Icon = item.icon;
                const active = isNavItemActive(item);
                const badge = getItemBadgeCount(item);
                return (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className={`flex min-h-[52px] items-center gap-3 rounded-xl px-3 py-2 transition-colors ${
                        active ? 'bg-blue-600/20 text-white' : 'text-slate-200 active:bg-[#002145]'
                      }`}
                    >
                      <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-blue-400' : 'text-[#88a2c0]'}`} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold truncate">{item.label}</span>
                        <span className="block text-xs text-[#88a2c0] truncate">{item.description}</span>
                      </span>
                      {badge > 0 && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                          {badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="border-t border-[#3c6ca8]/20 px-2 py-2">
            <p className="px-3 pt-1 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-[#88a2c0]">
              Switch workstation
            </p>
            <ul>
              {workspaces.map((ws) => {
                const Icon = ws.icon;
                const selected = ws.id === activeWorkspace.id;
                return (
                  <li key={ws.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setMoreOpen(false);
                        onSelectWorkspace(ws.id);
                      }}
                      className={`flex w-full min-h-[48px] items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors cursor-pointer ${
                        selected ? 'text-white' : 'text-slate-200 active:bg-[#002145]'
                      }`}
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${ws.accentClass}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="flex-1 text-sm font-semibold truncate">{ws.name}</span>
                      {selected && <span className="text-[11px] font-semibold text-blue-400">Current</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="border-t border-[#3c6ca8]/20 grid grid-cols-3 gap-2 p-3">
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                onOpenLaunchpad();
              }}
              className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl bg-[#001b38] border border-[#3c6ca8]/30 text-xs font-semibold text-slate-200 cursor-pointer"
            >
              <LayoutGrid className="h-4 w-4 text-blue-300" />
              Launchpad
            </button>
            <Link
              href="/sobadmin/jobs/new"
              className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl bg-blue-600 text-xs font-semibold text-white"
            >
              <Plus className="h-4 w-4" />
              New Job
            </Link>
            <button
              type="button"
              onClick={onLogout}
              className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl bg-red-500/15 border border-red-500/40 text-xs font-semibold text-red-300 cursor-pointer"
            >
              <LogOut className="h-4 w-4 text-red-400" />
              Sign Out
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
