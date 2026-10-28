'use client';

import { useState } from 'react';
import { ChevronsUpDown, Check, Sparkles, Maximize2 } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  type WorkspaceConfig,
  type WorkspaceId,
} from '@/lib/navigation/workspaces';

export interface OperationalCounts {
  unassignedJobs: number;
  activeJobs: number;
  newLeads: number;
  pendingApplications: number;
}

interface WorkspaceSwitcherProps {
  workspaces: WorkspaceConfig[];
  activeWorkspace: WorkspaceConfig;
  onSelectWorkspace: (workspaceId: WorkspaceId) => void;
  collapsed?: boolean;
  counts: OperationalCounts;
}

export function WorkspaceSwitcher({
  workspaces,
  activeWorkspace,
  onSelectWorkspace,
  collapsed = false,
  counts,
}: WorkspaceSwitcherProps) {
  const [open, setOpen] = useState(false);
  const ActiveIcon = activeWorkspace.icon;

  function getWorkspaceSummaryBadge(wsId: WorkspaceId): { label: string; tone: string } | null {
    if (wsId === 'dispatch' && counts.unassignedJobs > 0) {
      return {
        label: `${counts.unassignedJobs} unassigned`,
        tone: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      };
    }
    if (wsId === 'dispatch' && counts.activeJobs > 0) {
      return {
        label: `${counts.activeJobs} live`,
        tone: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      };
    }
    if (wsId === 'sales' && counts.newLeads > 0) {
      return {
        label: `${counts.newLeads} new`,
        tone: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      };
    }
    if (wsId === 'workforce' && counts.pendingApplications > 0) {
      return {
        label: `${counts.pendingApplications} review`,
        tone: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      };
    }
    return null;
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {collapsed ? (
          <button
            type="button"
            title={`${activeWorkspace.name} (Switch Workspace)`}
            className="w-10 h-10 mx-auto rounded-xl border border-border/80 bg-muted/40 hover:bg-muted flex items-center justify-center transition-colors relative cursor-pointer"
          >
            <ActiveIcon className="h-4 w-4 text-primary" />
            {(counts.unassignedJobs > 0 || counts.newLeads > 0) && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 ring-2 ring-card" />
            )}
          </button>
        ) : (
          <button
            type="button"
            className="w-full flex items-center justify-between gap-2.5 p-2 rounded-xl border border-border/80 bg-muted/30 hover:bg-muted/60 transition-colors text-left group cursor-pointer"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${activeWorkspace.accentClass}`}
              >
                <ActiveIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Sea of Blue OS
                  </span>
                </div>
                <p className="text-sm font-bold text-foreground truncate leading-tight">
                  {activeWorkspace.name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground bg-background/70 border border-border rounded">
                ⌘{activeWorkspace.shortcut}
              </kbd>
              <ChevronsUpDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
          </button>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-80 p-2 bg-card border-border text-foreground shadow-xl rounded-xl z-50 dark"
      >
        <div className="px-2 py-1.5 flex items-center justify-between border-b border-border/60 mb-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Switch Workspace
          </span>
          <span className="text-[10px] font-mono text-muted-foreground">⌘1 – ⌘4</span>
        </div>

        <div className="space-y-1">
          {workspaces.map((ws) => {
            const Icon = ws.icon;
            const isSelected = ws.id === activeWorkspace.id;
            const summaryBadge = getWorkspaceSummaryBadge(ws.id);

            return (
              <button
                key={ws.id}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onSelectWorkspace(ws.id);
                }}
                className={`w-full flex items-start gap-3 p-2.5 rounded-lg text-left transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-primary/15 border border-primary/30'
                    : 'hover:bg-muted/60 border border-transparent'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 mt-0.5 ${ws.accentClass}`}
                >
                  <Icon className="h-4 w-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-foreground truncate">
                      {ws.name}
                    </span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {summaryBadge && (
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${summaryBadge.tone}`}
                        >
                          {summaryBadge.label}
                        </span>
                      )}
                      <kbd className="text-[10px] font-mono text-muted-foreground px-1 py-0.5 rounded bg-background/60 border border-border/60">
                        ⌘{ws.shortcut}
                      </kbd>
                      {isSelected && <Check className="h-3.5 w-3.5 text-primary" />}
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                    {ws.tagline}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-2 pt-2 border-t border-border/60 flex items-center justify-between px-2 py-1 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Sparkles className="h-3 w-3 text-blue-400" />
            Role-aware navigation active
          </span>
          <a
            href="/sobadmin/sales"
            className="text-blue-400 hover:underline font-semibold flex items-center gap-1"
          >
            Sales OS
            <Maximize2 className="h-2.5 w-2.5" />
          </a>
        </div>
      </PopoverContent>
    </Popover>
  );
}
