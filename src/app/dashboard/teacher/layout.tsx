import Link from 'next/link';
import { getCurrentUser } from '@/server/auth/session';
import { redirect } from 'next/navigation';
import LogoutButton from '@/components/auth/logout-button';
import DashboardPrefetcher from '@/components/dashboard/dashboard-prefetcher';

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'teacher') redirect('/dashboard/student');

  const nav = [
    { href: '/dashboard/teacher', label: 'Ringkasan' },
    { href: '/dashboard/teacher/classrooms', label: 'Kelas Saya' },
    { href: '/dashboard/teacher/subjects', label: 'Manajemen Mapel' },
    { href: '/dashboard/teacher/rooms', label: 'Ruang Game' },
    { href: '/dashboard/teacher/settings', label: 'Pengaturan' },
  ];

  return (
    <div className="min-h-screen bg-[var(--cream-bg)]">
      <header className="bg-[var(--navy-panel)] text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-6 py-4">
          <Link href="/dashboard/teacher" className="flex items-center gap-2.5 font-display text-xl font-bold">
            <img src="/icons/icon-192.png" alt="Logo llysSmart" className="h-9 w-9 rounded-xl shadow" />
            <span>llysSmart Guru</span>
          </Link>
          <nav className="flex flex-wrap gap-2">
            {nav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="rounded-xl px-3 py-1.5 text-sm font-semibold text-white/80 hover:bg-white/10 hover:text-white"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span>{user.fullName}</span>
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
      <DashboardPrefetcher role="teacher" />
    </div>
  );
}
