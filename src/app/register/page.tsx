'use client';

import Link from 'next/link';

export default function RegisterPage() {
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

        <div className="rounded-xl bg-[var(--cream-soft)] px-4 py-5 text-center text-sm text-[var(--wood-text)]">
          Pendaftaran akun baru sedang dinonaktifkan.
          <br />
          Masuk langsung lewat akun Siakad di halaman login.
        </div>

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
