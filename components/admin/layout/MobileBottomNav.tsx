'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { MoreHorizontal, LayoutGrid, Plus, LogOut, Sparkles, ChevronDown } from 'lucide-react';
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
import { AppearanceControlsPanel } from './OperatorControlPopover';

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
 * which opens a bottom sheet with every module, workstation switching, appearance, and sign out.
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
  const [appearanceOpen, setAppearanceOpen] = useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Close the sheet after any navigation
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname, searchParams]);

  const items = activeWorkspace.items;
  const inlineItems = items.slice(0, 4);
  const overflowItems = items.slice(4);
  const overflowActive = overflowItems.some((item) => isNavItemActive(item));
  const overflowBadge = overflowItems.reduce((sum, item) => sum + getItemBadgeCount(item), 0);

  return (
    <>
      <nav
        aria-label={`${activeWorkspace.shortName} modules`}
        className="os-dock-bar md:hidden relative shrink-0 z-40 border-t safe-bottom select-none"
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
                    active ? 'text-foreground' : 'text-muted-foreground active:text-foreground'
                  }`}
                >
                  {active && (
                    <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-primary" />
                  )}
                  <span className="relative">
                    <Icon className={`h-5 w-5 ${active ? 'text-primary' : ''}`} />
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

          <li className="flex-1 min-w-0">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={moreOpen}
              className={`relative flex h-14 w-full flex-col items-center justify-center gap-0.5 px-1 transition-colors cursor-pointer ${
                overflowActive ? 'text-foreground' : 'text-muted-foreground active:text-foreground'
              }`}
            >
              {overflowActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-primary" />
              )}
              <span className="relative">
                <MoreHorizontal className={`h-5 w-5 ${overflowActive ? 'text-primary' : ''}`} />
                {overflowBadge > 0 && (
                  <span className="absolute -top-1 -right-1.5 h-2.5 w-2.5 rounded-full bg-amber-500" />
                )}
              </span>
              <span className="text-[10px] font-semibold leading-tight">More</span>
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          side="bottom"
          className="md:hidden bg-popover border-border text-popover-foreground rounded-t-2xl p-0 max-h-[85dvh] overflow-y-auto safe-bottom"
        >
          <SheetHeader className="px-4 pt-4 pb-2 text-left">
            <SheetTitle className="text-base font-bold text-foreground">
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
                        active ? 'bg-primary/15 text-foreground' : 'text-foreground/90 active:bg-accent'
                      }`}
                    >
                      <Icon className={`h-5 w-5 shrink-0 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold truncate">{item.label}</span>
                        <span className="block text-xs text-muted-foreground truncate">{item.description}</span>
                      </span>
                      {badge > 0 && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600 dark:text-amber-300">
                          {badge}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="border-t border-border px-2 py-2">
            <p className="px-3 pt-1 pb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
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
                        selected ? 'text-foreground bg-accent/50' : 'text-foreground/85 active:bg-accent'
                      }`}
                    >
                      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${ws.accentClass}`}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="flex-1 text-sm font-semibold truncate">{ws.name}</span>
                      {selected && <span className="text-[11px] font-semibold text-primary">Current</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Collapsible Appearance & Glass Customization for Mobile Field Ops */}
          <div className="border-t border-border px-3 py-2">
            <button
              type="button"
              onClick={() => setAppearanceOpen((prev) => !prev)}
              className="flex w-full items-center justify-between py-2 px-1 text-xs font-bold text-foreground cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                <span>Appearance & Glass Studio</span>
              </span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${
                  appearanceOpen ? 'rotate-180' : ''
                }`}
              />
            </button>
            {appearanceOpen && (
              <div className="pt-2 pb-3 px-1">
                <AppearanceControlsPanel compact />
              </div>
            )}
          </div>

          <div className="border-t border-border grid grid-cols-3 gap-2 p-3">
            <button
              type="button"
              onClick={() => {
                setMoreOpen(false);
                onOpenLaunchpad();
              }}
              className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl bg-card border border-border text-xs font-semibold text-foreground cursor-pointer"
            >
              <LayoutGrid className="h-4 w-4 text-primary" />
              Launchpad
            </button>
            <Link
              href="/sobadmin/jobs/new"
              className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl bg-primary text-xs font-semibold text-primary-foreground"
            >
              <Plus className="h-4 w-4" />
              New Job
            </Link>
            <button
              type="button"
              onClick={onLogout}
              className="flex h-12 flex-col items-center justify-center gap-0.5 rounded-xl bg-red-500/15 border border-red-500/40 text-xs font-semibold text-red-600 dark:text-red-300 cursor-pointer"
            >
              <LogOut className="h-4 w-4 text-red-500 dark:text-red-400" />
              Sign Out
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
