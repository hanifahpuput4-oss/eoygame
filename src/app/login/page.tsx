'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      router.push(data.user.role === 'teacher' ? '/dashboard/teacher' : '/dashboard/student');
      router.refresh();
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
            <label htmlFor="email" className="label-field">Email atau Username</label>
            <input
              id="email"
              type="text"
              required
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="input-field lowercase"
              value={email}
              onChange={(e) => setEmail(e.target.value.toLowerCase())}
              placeholder="username atau email (huruf kecil)"
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

        <p className="mt-4 text-center text-sm">
          Belum punya akun?{' '}
          <Link href="/register" className="font-semibold text-[var(--blue-info)] underline">
            Daftar di sini
          </Link>
        </p>
      </div>
    </main>
  );
}
