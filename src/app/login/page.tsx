'use client';

import { useState, useEffect, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { clearCachedData } from '@/lib/client-cache';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('reason') === 'session_replaced') {
        setError('Sesi Anda di perangkat ini telah keluar otomatis karena akun login di perangkat lain.');
      }
      const ssoError = params.get('sso_error');
      if (ssoError) {
        const messages: Record<string, string> = {
          missing_token: 'Tiket SSO tidak ditemukan. Silakan masuk lewat Siakad lagi.',
          not_configured: 'Login via Siakad belum diaktifkan.',
          siakad_unreachable: 'Tidak bisa menghubungi server Siakad. Coba lagi nanti.',
          invalid_token: 'Tiket SSO tidak valid atau sudah kadaluarsa. Silakan masuk lewat Siakad lagi.',
          bad_response: 'Respons Siakad tidak valid. Silakan coba lagi.',
          bad_role: 'Role akun Siakad tidak dikenali.',
        };
        setError(messages[ssoError] ?? 'Login via Siakad gagal. Silakan coba lagi.');
      }
    }
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Login gagal');
        return;
      }
      clearCachedData();
      router.push(
        data.user.role === 'teacher' || data.user.role === 'admin'
          ? '/dashboard/teacher'
          : '/dashboard/student',
      );
    } catch {
      setError('Tidak dapat terhubung ke server');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[var(--sky-top)] to-[var(--sky-bottom)] px-4">
      <div className="card-panel w-full max-w-md">
        <div className="mb-6 text-center">
          <img
            src="/icons/icon-192.png"
            alt="Logo llysSmart"
            className="mx-auto mb-3 h-16 w-16 rounded-2xl shadow-md"
          />
          <h1 className="font-display text-2xl font-bold">Masuk llysSmart</h1>
          <p className="text-sm text-[var(--wood-text)]/70">Let&apos;s Learn Your Skills</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4" autoComplete='off'>
          <div>
            <label htmlFor="email" className="label-field">Email</label>
            <input
              id="email"
              type="email"
              required
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="input-field lowercase"
              value={email}
              onChange={(e) => setEmail(e.target.value.toLowerCase())}
              placeholder="email akun (huruf kecil)"
            />
          </div>
          <div>
            <label htmlFor="password" className="label-field">Password</label>
            <input
              id="password"
              type="password"
              required
              className="input-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password kamu"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-xl bg-red-100 px-4 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60">
            {loading ? 'Memproses...' : 'Login'}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-gray-200" />
          <span className="text-xs text-gray-400">atau</span>
          <div className="h-px flex-1 bg-gray-200" />
        </div>

        <a
          href="/api/auth/sso"
          className="w-full rounded-xl border-2 border-[var(--blue-info)] bg-white px-4 py-2.5 text-center font-semibold text-[var(--blue-info)] transition hover:bg-[var(--blue-info)] hover:text-white"
        >
          🎓 Masuk via Siakad
        </a>

        <div className="mt-4 text-center text-sm text-[var(--wood-text)]/70">
          Masuk lewat akun Siakad. Belum punya akses? Hubungi admin sekolah.
        </div>
      </div>
    </main>
  );
}
