'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  WORKSPACES,
  WORKSPACE_MAP,
  STORAGE_KEYS,
  resolveWorkspaceFromPath,
  getAllowedWorkspacesForUser,
  type WorkspaceId,
  type UserProfileContext,
  type WorkspaceNavItem,
} from '@/lib/navigation/workspaces';
import { type OperationalCounts } from '@/components/admin/layout/WorkspaceSwitcher';
import { AdminHeader } from '@/components/admin/layout/AdminHeader';
import { SobOsLaunchpad } from '@/components/admin/layout/SobOsLaunchpad';

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfileContext | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [clockTime, setClockTime] = useState('');
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<WorkspaceId>(() =>
    resolveWorkspaceFromPath(pathname || '/sobadmin')
  );
  const [counts, setCounts] = useState<OperationalCounts>({
    unassignedJobs: 0,
    activeJobs: 0,
    newLeads: 0,
    pendingApplications: 0,
  });

  // Track browser Fullscreen state & live system clock
  useEffect(() => {
    if (typeof document === 'undefined') return;

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 80);
    };

    setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    const updateClock = () => {
      setClockTime(
        new Date().toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
        })
      );
    };
    updateClock();
    const timer = setInterval(updateClock, 15000);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      clearInterval(timer);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (typeof document === 'undefined') return;
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (err) {
      console.warn('Fullscreen toggle error:', err);
    }
  }, []);

  // Load user & profile from Supabase
  useEffect(() => {
    const supabase = createClient();

    async function checkUser() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, role, title')
            .eq('id', user.id)
            .maybeSingle();

          setUserProfile({
            id: user.id,
            email: user.email,
            full_name:
              profile?.full_name ||
              user.user_metadata?.full_name ||
              user.email?.split('@')[0] ||
              'Operator',
            role: profile?.role || 'admin',
            title:
              profile?.title ||
              (profile?.role === 'admin' ? 'Managing Partner' : 'Operations'),
          });
        } else {
          setUserProfile(null);
        }
      } catch {
        setUserProfile(null);
      } finally {
        setAuthChecked(true);
      }
    }
    checkUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUserProfile(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Fetch operational counts for badges
  const refreshOperationalCounts = useCallback(async () => {
    if (
      pathname === '/sobadmin/login' ||
      pathname === '/sobadmin/forgot-password'
    ) {
      return;
    }
    try {
      const [jobsRes, leadsRes, appsRes] = await Promise.allSettled([
        fetch('/api/jobs'),
        fetch('/api/leads'),
        fetch('/api/sobadmin/employee-applications'),
      ]);

      let unassignedJobs = 0;
      let activeJobs = 0;
      let newLeads = 0;
      let pendingApplications = 0;

      if (jobsRes.status === 'fulfilled' && jobsRes.value.ok) {
        const jobs = await jobsRes.value.json();
        if (Array.isArray(jobs)) {
          unassignedJobs = jobs.filter(
            (j: any) =>
              ['confirmed', 'lead_received', 'quoted'].includes(j.status) &&
              !j.assigned_employee_id
          ).length;
          activeJobs = jobs.filter((j: any) =>
            ['on_the_way', 'in_progress'].includes(j.status)
          ).length;
        }
      }

      if (leadsRes.status === 'fulfilled' && leadsRes.value.ok) {
        const leads = await leadsRes.value.json();
        if (Array.isArray(leads)) {
          newLeads = leads.filter((l: any) => l.status === 'new').length;
        }
      }

      if (appsRes.status === 'fulfilled' && appsRes.value.ok) {
        const apps = await appsRes.value.json();
        if (Array.isArray(apps)) {
          pendingApplications = apps.filter(
            (a: any) => !a.status || a.status === 'New' || a.status === 'Under Review'
          ).length;
        }
      }

      setCounts({ unassignedJobs, activeJobs, newLeads, pendingApplications });
    } catch {
      // Ignore background count errors
    }
  }, [pathname]);

  useEffect(() => {
    refreshOperationalCounts();
  }, [refreshOperationalCounts]);

  // Synchronize activeWorkspaceId with URL
  useEffect(() => {
    if (!pathname) return;
    const matchedWorkspace = resolveWorkspaceFromPath(pathname);
    setActiveWorkspaceId(matchedWorkspace);
  }, [pathname, searchParams]);

  const allowedWorkspaces = useMemo(
    () => getAllowedWorkspacesForUser(userProfile),
    [userProfile]
  );

  const activeWorkspace = useMemo(
    () =>
      allowedWorkspaces.find((w) => w.id === activeWorkspaceId) ||
      WORKSPACE_MAP[activeWorkspaceId] ||
      WORKSPACES[0],
    [allowedWorkspaces, activeWorkspaceId]
  );

  // Switch workstation handler
  const handleSelectWorkspace = useCallback(
    (workspaceId: WorkspaceId) => {
      const targetWs = WORKSPACE_MAP[workspaceId];
      if (!targetWs) return;
      setActiveWorkspaceId(workspaceId);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEYS.ACTIVE_WORKSPACE, workspaceId);
      }
      router.push(targetWs.defaultHref);
    },
    [router]
  );

  const handleOpenLaunchpad = useCallback(() => {
    router.push('/sobadmin');
  }, [router]);

  // Keyboard shortcuts: ⌘1–⌘4 to jump directly to a workstation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
        const idx = ['1', '2', '3', '4'].indexOf(e.key);
        if (idx !== -1 && allowedWorkspaces[idx]) {
          e.preventDefault();
          handleSelectWorkspace(allowedWorkspaces[idx].id);
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [allowedWorkspaces, handleSelectWorkspace]);

  // Don't show OS top bar on login, forgot-password, or Sales OS (Sales OS renders its own integrated OS top bar)
  if (
    pathname === '/sobadmin/login' ||
    pathname === '/sobadmin/forgot-password' ||
    pathname?.startsWith('/sobadmin/sales')
  ) {
    return <>{children}</>;
  }

  if (!authChecked) {
    return (
      <div className="fixed inset-0 z-50 flex h-dvh w-screen items-center justify-center bg-[#001326] text-[#fffcf6] font-sans dark">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          <div className="text-sm text-[#88a2c0] font-semibold">
            Booting Sea of Blue OS...
          </div>
        </div>
      </div>
    );
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/sobadmin/login';
  }

  // Determine if we are on the root OS Launchpad (/sobadmin with no ?app= or ?view= or ?timeframe= query param)
  const isLaunchpadView =
    pathname === '/sobadmin' &&
    !searchParams?.get('app') &&
    !searchParams?.get('view') &&
    !searchParams?.get('timeframe');

  function isNavItemActive(item: WorkspaceNavItem): boolean {
    if (item.id === 'command-center') {
      return (
        pathname === '/sobadmin' &&
        !isLaunchpadView &&
        searchParams?.get('view') !== 'map'
      );
    }

    if (item.id === 'live-map') {
      return pathname === '/sobadmin' && searchParams?.get('view') === 'map';
    }

    if (item.exact) {
      return pathname === item.href;
    }

    return pathname.startsWith(item.href);
  }

  function getItemBadgeCount(item: WorkspaceNavItem): number {
    if (!item.badgeKey) return 0;
    return counts[item.badgeKey] || 0;
  }

  return (
    <div className="fixed inset-0 flex flex-col h-dvh w-screen overflow-hidden bg-background text-foreground dark">
      {/* Persistent Top OS Dock Bar (Matches Sales OS) */}
      <AdminHeader
        workspaces={allowedWorkspaces}
        activeWorkspace={activeWorkspace}
        isLaunchpadView={isLaunchpadView}
        onOpenLaunchpad={handleOpenLaunchpad}
        onSelectWorkspace={handleSelectWorkspace}
        isNavItemActive={isNavItemActive}
        getItemBadgeCount={getItemBadgeCount}
        counts={counts}
        userProfile={userProfile}
        clockTime={clockTime}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleFullscreen}
        onLogout={handleLogout}
        onRefreshCounts={refreshOperationalCounts}
      />

      {/* Edge-to-Edge OS Workspace Canvas (100% Remaining Viewport) */}
      <main className="flex-1 w-full h-full min-h-0 overflow-y-auto relative">
        {isLaunchpadView ? (
          <SobOsLaunchpad
            userProfile={userProfile}
            counts={counts}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            onLogout={handleLogout}
          />
        ) : (
          <div
            className={
              pathname === '/sobadmin'
                ? 'p-0 min-w-0'
                : 'p-4 md:p-6 lg:p-8 max-w-7xl mx-auto min-w-0'
            }
          >
            {children}
          </div>
        )}
      </main>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 flex h-dvh w-screen items-center justify-center bg-[#001326] dark" />
      }
    >
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </Suspense>
  );
}
