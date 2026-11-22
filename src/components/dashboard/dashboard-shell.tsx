'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import LogoutButton from '@/components/auth/logout-button';

export type NavIconKey = 'overview' | 'classrooms' | 'subjects' | 'rooms' | 'users' | 'settings';

export type NavItem = {
  href: string;
  label: string;
  icon: NavIconKey;
};

function NavIcon({ name, className = 'h-[18px] w-[18px]' }: { name: NavIconKey; className?: string }) {
  switch (name) {
    case 'overview':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      );
    case 'classrooms':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      );
    case 'subjects':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      );
    case 'rooms':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="6" width="20" height="12" rx="4" />
          <path d="M6 12h4m-2-2v4" />
          <circle cx="15.5" cy="11" r="1" fill="currentColor" />
          <circle cx="17.5" cy="13" r="1" fill="currentColor" />
        </svg>
      );
    case 'users':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <circle cx="12" cy="10" r="2.5" />
          <path d="M8.5 16.5c.8-1.4 2.1-2 3.5-2s2.7.6 3.5 2" />
        </svg>
      );
    case 'settings':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      );
  }
}

type DashboardShellProps = {
  role: 'admin' | 'teacher' | 'student';
  title: string;
  userFullName: string;
  totalPoints?: number;
  navItems: NavItem[];
  children: React.ReactNode;
};

export default function DashboardShell({
  role,
  title,
  userFullName,
  totalPoints,
  navItems,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
    setNavigating(false);
  }, [pathname]);

  const activeItem =
    navItems.find((n) => n.href === pathname) ??
    navItems.find((n) => n.href !== '/dashboard/teacher' && n.href !== '/dashboard/student' && pathname.startsWith(n.href)) ??
    navItems[0];

  function handleNavClick(href: string) {
    setSidebarOpen(false);
    if (href !== pathname) {
      setNavigating(true);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--cream-bg)]">
      {/* Thin top loading line during route transition */}
      {navigating && (
        <div className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden bg-black/10">
          <div className="h-full w-1/2 bg-[var(--orange-primary)] animate-progress-bar" />
        </div>
      )}

      {/* Mobile Header */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-white/10 bg-[var(--navy-panel)] px-4 text-white lg:hidden">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Buka menu"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/85 hover:bg-white/10"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="font-display text-base font-bold truncate">
            {activeItem?.label ?? title}
          </span>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 text-xs">
          {role === 'student' && typeof totalPoints === 'number' && (
            <span className="rounded-md bg-white/10 px-2 py-1 font-semibold text-[var(--yellow-accent)]">
              {totalPoints} poin
            </span>
          )}
          <span className="hidden sm:inline text-white/75 truncate max-w-[140px]">{userFullName}</span>
        </div>
      </header>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-white/10 bg-[var(--navy-panel)] text-white transition-transform duration-200 ease-out lg:z-30 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand */}
        <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
          <Link
            href={role === 'teacher' || role === 'admin' ? '/dashboard/teacher' : '/dashboard/student'}
            onClick={() => setSidebarOpen(false)}
            className="flex items-center gap-2.5"
          >
            <img src="/icons/icon-192.png" alt="llysSmart" className="h-8 w-8 rounded-lg" />
            <span className="font-display text-base font-bold tracking-tight">{title}</span>
          </Link>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label="Tutup menu"
            className="flex h-7 w-7 items-center justify-center rounded-md text-white/60 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Nav List */}
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {navItems.map((item) => {
            const isActive = item.href === pathname;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => handleNavClick(item.href)}
                className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13.5px] transition-colors ${
                  isActive
                    ? 'bg-white/[0.11] font-semibold text-white'
                    : 'font-medium text-white/70 hover:bg-white/[0.05] hover:text-white'
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r bg-[var(--orange-primary)]" />
                )}
                <NavIcon
                  name={item.icon}
                  className={`h-[18px] w-[18px] shrink-0 ${
                    isActive ? 'text-[var(--orange-primary)]' : 'text-white/55'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="border-t border-white/10 p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-white">{userFullName}</div>
              <div className="text-[11px] text-white/50">
                {role === 'admin'
                  ? 'Administrator (Guru)'
                  : role === 'teacher'
                    ? 'Guru'
                    : `Siswa · ${totalPoints ?? 0} poin`}
              </div>
            </div>
            <LogoutButton />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:pl-60">
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div key={pathname} className="animate-page-enter">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
