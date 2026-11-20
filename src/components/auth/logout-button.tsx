'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { clearCachedData } from '@/lib/client-cache';

export default function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function onLogout() {
    setLoading(true);
    clearCachedData();
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <button
      onClick={onLogout}
      disabled={loading}
      className="rounded-xl bg-white/10 px-3 py-1.5 font-semibold hover:bg-white/20 disabled:opacity-60"
    >
      {loading ? 'Keluar...' : 'Logout'}
    </button>
  );
}

