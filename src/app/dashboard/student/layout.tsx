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
      <header className="bg-[var(--navy-panel)] text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-6 py-4">
          <Link href="/dashboard/student" className="font-display text-xl font-bold">
            🎓 llysSmart
          </Link>
          <nav className="flex gap-2">
            <Link href="/dashboard/student" className="rounded-xl px-3 py-1.5 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white">
              Beranda
            </Link>
            <Link href="/dashboard/student/settings" className="rounded-xl px-3 py-1.5 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white">
              Pengaturan
            </Link>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span>⭐ {user.totalPoints} poin</span>
            <span>{user.fullName}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}
