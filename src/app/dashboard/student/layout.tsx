import Link from 'next/link';
import { getCurrentUser } from '@/server/auth/session';
import { redirect } from 'next/navigation';
import LogoutButton from '@/components/auth/logout-button';

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'student') redirect('/dashboard/teacher');

  return (
    <div className="min-h-screen bg-[var(--cream-bg)]">
      <header className="sticky top-0 z-30 bg-[var(--navy-panel)] text-white shadow-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6 sm:py-4">
          <div className="flex items-center gap-3 sm:gap-6">
            <Link href="/dashboard/student" className="flex items-center gap-2 font-display text-lg font-bold sm:text-xl">
              <img src="/icons/icon-192.png" alt="Logo llysSmart" className="h-8 w-8 rounded-lg shadow" />
              <span>llysSmart</span>
            </Link>
            <nav className="flex items-center gap-1 sm:gap-2">
              <Link
                href="/dashboard/student"
                className="rounded-xl px-2.5 py-1.5 text-xs font-semibold text-white/85 transition hover:bg-white/10 hover:text-white sm:px-3 sm:text-sm"
              >
                Beranda
              </Link>
              <Link
                href="/dashboard/student/settings"
                className="rounded-xl px-2.5 py-1.5 text-xs font-semibold text-white/85 transition hover:bg-white/10 hover:text-white sm:px-3 sm:text-sm"
              >
                Pengaturan
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2.5 text-xs sm:gap-3 sm:text-sm">
            <span className="rounded-xl bg-white/10 px-2.5 py-1 font-semibold text-[var(--yellow-accent)]">
              ⭐ {user.totalPoints} poin
            </span>
            <span className="hidden font-medium text-white/90 sm:inline">{user.fullName}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
