'use client';

import { useEffect } from 'react';
import { clearCachedData, getCachedData, hydrateAllFromSession, setCachedData } from '@/lib/client-cache';

export default function DashboardPrefetcher({ role }: { role: 'admin' | 'teacher' | 'student' }) {
  useEffect(() => {
    hydrateAllFromSession();
    let active = true;

    async function checkSession() {
      if (!active) return;
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
      try {
        const res = await fetch('/api/auth/check', { cache: 'no-store' });
        if (res.status === 401 && active) {
          active = false;
          clearCachedData();
          window.location.replace('/login?reason=session_replaced');
        }
      } catch {
        // network error ignored
      }
    }

    const sessionTimer = setInterval(checkSession, 2500);
    window.addEventListener('focus', checkSession);
    document.addEventListener('visibilitychange', checkSession);

    const timer = setTimeout(() => {
      if (role === 'teacher' || role === 'admin') {
        if (!getCachedData('teacher:rooms') || !getCachedData('teacher:classrooms')) {
          fetch('/api/rooms?bootstrap=1')
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
              if (!d) return;
              if (Array.isArray(d.rooms)) setCachedData('teacher:rooms', d.rooms);
              if (Array.isArray(d.classrooms)) setCachedData('teacher:classrooms', d.classrooms);
              if (Array.isArray(d.levels)) setCachedData('teacher:levels', d.levels);
            })
            .catch(() => {});
        }
        if (!getCachedData('teacher:questions')) {
          fetch('/api/levels?withQuestions=1')
            .then((r) => (r.ok ? r.json() : null))
            .then((d) => {
              if (!d) return;
              if (Array.isArray(d.levels)) setCachedData('teacher:levels', d.levels);
              if (Array.isArray(d.questions)) setCachedData('teacher:questions', d.questions);
            })
            .catch(() => {});
        }
      }
      if (!getCachedData('user:profile')) {
        fetch('/api/profile')
          .then((r) => (r.ok ? r.json() : null))
          .then((d) => {
            if (d?.profile) setCachedData('user:profile', d.profile);
          })
          .catch(() => {});
      }
    }, 50);
    return () => {
      active = false;
      clearTimeout(timer);
      clearInterval(sessionTimer);
      window.removeEventListener('focus', checkSession);
      document.removeEventListener('visibilitychange', checkSession);
    };
  }, [role]);

  return null;
}
