'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function RoleGuard({ role, children }: { role: 'teacher' | 'student'; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    fetch('/api/profile')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!data?.profile) {
          router.replace('/login');
        } else if (data.profile.role !== role) {
          router.replace(
            data.profile.role === 'teacher' ? '/dashboard/teacher' : '/dashboard/student',
          );
        }
      })
      .catch(() => router.replace('/login'));
  }, [role, router, pathname]);

  return <>{children}</>;
}
