'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Users, Briefcase, UserCheck,
  Settings, ClipboardList, Waves,
  Package,
  TrendingUp, Globe, Shield,
  Menu, X, LogOut,
} from 'lucide-react';

import { ScrollArea } from '@/components/ui/scroll-area';
import { createClient } from '@/lib/supabase/client';

const sidebarItems = [
  { href: '/sobadmin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/sobadmin/leads', label: 'Leads', icon: ClipboardList },
  { href: '/sobadmin/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/sobadmin/customers', label: 'Customers', icon: Users },
  { href: '/sobadmin/employees', label: 'Employees', icon: UserCheck },
  { href: '/sobadmin/supply', label: 'Supply', icon: Package },
  { href: '/sobadmin/zones', label: 'Zones', icon: Globe },
  { href: '/sobadmin/finance', label: 'Finance', icon: TrendingUp },
  { href: '/sobadmin/audit', label: 'Audit Trail', icon: Shield },
  { href: '/sobadmin/settings', label: 'Settings', icon: Settings },
];



export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  // Client-side auth check (secondary guard — middleware handles primary redirect)
  useEffect(() => {
    // Bypass auth check
    setUserEmail('admin@seaofblue.app');
    setAuthChecked(true);
  }, [pathname, router]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  // Close sidebar on escape key
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setSidebarOpen(false);
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  // Don't show layout on login page
  if (pathname === '/sobadmin/login') {
    return <>{children}</>;
  }

  // Show loading skeleton while checking auth
  if (!authChecked) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 animate-pulse">
        </div>
      </div>
    );
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/sobadmin/login';
  }

  const sidebarContent = (
    <>
      <div className="flex flex-col items-center justify-center gap-2 px-6 py-5 border-b border-border text-center">
        <img src="/logo.png" alt="Sea of Blue Logo" className="w-48 h-48 object-contain" />
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Operations</p>
        </div>
      </div>

      {/* Nav */}
      <ScrollArea className="flex-1 py-4">
        <nav className="space-y-1 px-3">
          {sidebarItems.map((item) => {
            const isActive = item.href === '/sobadmin'
              ? pathname === '/sobadmin'
              : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="px-4 py-4 border-t border-border space-y-3">
        {userEmail && (
          <p className="text-[10px] text-muted-foreground truncate px-2" title={userEmail}>
            {userEmail}
          </p>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
        <p className="text-[10px] text-muted-foreground px-2">
          Sea of Blue v3.0
        </p>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-background text-foreground dark">
      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 z-50 flex items-center gap-3 px-4 h-14 border-b border-border bg-card lg:hidden">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 -ml-2 rounded-lg hover:bg-muted transition-colors shrink-0"
          aria-label="Toggle menu"
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <div className="flex items-center gap-2 min-w-0">
          <img src="/logo.png" alt="Sea of Blue Logo" className="w-7 h-7 object-contain shrink-0" />
          <span className="font-bold text-sm truncate">Sea of Blue Ops</span>
        </div>
      </div>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — desktop: always visible; mobile: slide-in drawer */}
      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-72 border-r border-border bg-card flex flex-col
          transition-transform duration-300 ease-in-out
          lg:static lg:w-64 lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {sidebarContent}
      </aside>

      {/* Main content — add top padding on mobile for the top bar */}
      <main className="flex-1 overflow-auto min-w-0 pt-14 lg:pt-0">
        <div className={pathname === '/sobadmin' ? '' : 'p-4 md:p-6 lg:p-8 min-w-0'}>
          {children}
        </div>
      </main>
    </div>
  );
}
