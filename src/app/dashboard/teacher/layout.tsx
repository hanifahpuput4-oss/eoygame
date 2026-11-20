import { getCurrentUser } from '@/server/auth/session';
import { redirect } from 'next/navigation';
import DashboardPrefetcher from '@/components/dashboard/dashboard-prefetcher';
import DashboardShell, { type NavItem } from '@/components/dashboard/dashboard-shell';

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'teacher') redirect('/dashboard/student');

  const nav: NavItem[] = [
    { href: '/dashboard/teacher', label: 'Ringkasan', icon: 'overview' },
    { href: '/dashboard/teacher/classrooms', label: 'Kelas Saya', icon: 'classrooms' },
    { href: '/dashboard/teacher/subjects', label: 'Manajemen Mapel', icon: 'subjects' },
    { href: '/dashboard/teacher/rooms', label: 'Ruang Game', icon: 'rooms' },
    { href: '/dashboard/teacher/settings', label: 'Pengaturan', icon: 'settings' },
  ];

  return (
    <>
      <DashboardShell
        role="teacher"
        title="llysSmart Guru"
        userFullName={user.fullName}
        navItems={nav}
      >
        {children}
      </DashboardShell>
      <DashboardPrefetcher role="teacher" />
    </>
  );
}

