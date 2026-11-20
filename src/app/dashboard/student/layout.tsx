import { getCurrentUser } from '@/server/auth/session';
import { redirect } from 'next/navigation';
import DashboardPrefetcher from '@/components/dashboard/dashboard-prefetcher';
import DashboardShell, { type NavItem } from '@/components/dashboard/dashboard-shell';

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'student') redirect('/dashboard/teacher');

  const nav: NavItem[] = [
    { href: '/dashboard/student', label: 'Beranda Kelas', icon: 'overview' },
    { href: '/dashboard/student/settings', label: 'Pengaturan', icon: 'settings' },
  ];

  return (
    <>
      <DashboardShell
        role="student"
        title="llysSmart Siswa"
        userFullName={user.fullName}
        totalPoints={user.totalPoints}
        navItems={nav}
      >
        {children}
      </DashboardShell>
      <DashboardPrefetcher role="student" />
    </>
  );
}

