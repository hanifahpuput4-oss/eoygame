'use client';

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<'student' | 'teacher'>('student');
  const [form, setForm] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    inviteCode: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function update(field: keyof typeof form, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Pendaftaran gagal');
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
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-[var(--sky-top)] to-[var(--sky-bottom)] px-4 py-10">
      <div className="card-panel w-full max-w-md">
        <div className="mb-6 text-center">
          <img
            src="/icons/icon-192.png"
            alt="Logo llysSmart"
            className="mx-auto mb-3 h-16 w-16 rounded-2xl shadow-md"
          />
          <h1 className="font-display text-2xl font-bold">Daftar llysSmart</h1>
          <p className="text-sm text-[var(--wood-text)]/70">Let&apos;s Learn Your Skills</p>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-[var(--cream-soft)] p-1">
          {(['student', 'teacher'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`rounded-xl py-2 font-display text-sm font-semibold transition-colors ${
                role === r ? 'bg-[var(--orange-primary)] text-[#2e1502]' : 'text-[var(--wood-text)]/70'
              }`}
            >
              {r === 'student' ? 'Siswa' : 'Guru'}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="fullName" className="label-field">Nama Lengkap</label>
            <input id="fullName" required className="input-field" value={form.fullName}
              onChange={(e) => update('fullName', e.target.value)} placeholder="Nama asli kamu" />
          </div>
          <div>
            <label htmlFor="username" className="label-field">Username</label>
            <input id="username" required className="input-field" value={form.username}
              onChange={(e) => update('username', e.target.value)} placeholder="Nama tampilan" />
          </div>
          <div>
            <label htmlFor="email" className="label-field">Email</label>
            <input id="email" type="email" required className="input-field" value={form.email}
              onChange={(e) => update('email', e.target.value)} placeholder="nama@sekolah.sch.id" />
          </div>
          <div>
            <label htmlFor="password" className="label-field">Password</label>
            <input id="password" type="password" required className="input-field" value={form.password}
              onChange={(e) => update('password', e.target.value)} placeholder="Minimal 8 karakter" />
          </div>
          {role === 'teacher' && (
            <div>
              <label htmlFor="inviteCode" className="label-field">Kode Undangan Guru</label>
              <input id="inviteCode" required className="input-field" value={form.inviteCode}
                onChange={(e) => update('inviteCode', e.target.value)} placeholder="Kode dari admin sekolah" />
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-xl bg-red-100 px-4 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn-primary w-full disabled:opacity-60">
            {loading ? 'Memproses...' : 'Daftar'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm">
          Sudah punya akun?{' '}
          <Link href="/login" className="font-semibold text-[var(--blue-info)] underline">
            Login di sini
          </Link>
        </p>
      </div>
    </main>
  );
}
