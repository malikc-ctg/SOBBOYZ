'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, PlusCircle, Briefcase, FileText, Settings, Waves } from 'lucide-react';

const navItems = [
  { href: '/partner', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/partner/book', label: 'Book a Job', icon: PlusCircle },
  { href: '/partner/jobs', label: 'Jobs', icon: Briefcase },
  { href: '/partner/invoices', label: 'Invoices', icon: FileText },
  { href: '/partner/account', label: 'Account', icon: Settings },
];

export default function PartnerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col md:flex-row min-h-screen md:h-screen bg-background">
      {/* Mobile Top Header */}
      <header className="md:hidden sticky top-0 z-40 bg-card border-b border-border px-4 h-14 flex items-center justify-between shrink-0">
        <Link href="/partner" className="flex items-center gap-2.5">
          <img src="/logo.png" alt="Sea of Blue Logo" className="h-8 w-auto object-contain" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Partner Portal</span>
        </Link>
        <Link
          href="/partner/book"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium"
        >
          <PlusCircle className="h-3.5 w-3.5" />
          Book
        </Link>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-60 border-r border-border bg-card flex-col shrink-0">
        <div className="flex flex-col items-center justify-center gap-2 px-5 py-5 border-b border-border text-center">
          <img src="/logo.png" alt="Sea of Blue Logo" className="w-44 h-44 object-contain" />
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Partner Portal</p>
          </div>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = item.href === '/partner'
              ? pathname === '/partner'
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

        <div className="px-5 py-4 border-t border-border">
          <p className="text-[10px] text-muted-foreground">Partner Portal v3.0</p>
        </div>
      </aside>

      <main className="flex-1 overflow-auto pb-24 md:pb-0">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-card border-t border-border safe-bottom">
        <div className="flex justify-around py-1 px-1">
          {navItems.map((item) => {
            const isActive = item.href === '/partner'
              ? pathname === '/partner'
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 py-2 px-2 rounded-lg min-h-[48px] min-w-[48px] transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <item.icon className="h-5 w-5" />
                <span className="text-[10px] font-medium truncate max-w-[64px]">
                  {item.label === 'Book a Job' ? 'Book' : item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
