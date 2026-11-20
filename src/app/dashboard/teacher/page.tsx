import Link from 'next/link';
import { getCurrentUser } from '@/server/auth/session';

export default async function TeacherOverview() {
  const user = await getCurrentUser();

  const items = [
    {
      href: '/dashboard/teacher/classrooms',
      title: 'Kelas Saya',
      desc: 'Buat kelas, bagikan kode join 6 karakter, dan kelola daftar siswa.',
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      href: '/dashboard/teacher/subjects',
      title: 'Manajemen Mapel',
      desc: 'Susun mata pelajaran, tujuan pembelajaran, dan import bank soal.',
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      ),
    },
    {
      href: '/dashboard/teacher/rooms',
      title: 'Ruang Game & Rekap',
      desc: 'Buka sesi permainan kelas, pantau jalannya game, dan unduh rekap nilai.',
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="6" width="20" height="12" rx="4" />
          <path d="M6 12h4m-2-2v4" />
          <circle cx="15.5" cy="11" r="1" fill="currentColor" />
          <circle cx="17.5" cy="13" r="1" fill="currentColor" />
        </svg>
      ),
    },
    {
      href: '/dashboard/teacher/settings',
      title: 'Pengaturan Akun',
      desc: 'Perbarui nama lengkap, username in-game, avatar, dan password.',
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
    },
  ];

  return (
    <div>
      <h1 className="font-display text-2xl font-bold sm:text-3xl">Halo, {user?.fullName}</h1>
      <p className="mt-1 text-sm text-[var(--wood-text)]/70">
        Pilih modul di bawah atau gunakan navigasi samping untuk mengelola aktivitas kelas.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="card-panel group flex items-start gap-4 transition-colors hover:border-[var(--navy-panel)]/35"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--navy-panel)] text-white transition-colors group-hover:bg-[var(--orange-primary)] group-hover:text-[#2e1502]">
              {item.icon}
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-lg font-semibold">{item.title}</h2>
              <p className="mt-0.5 text-sm text-[var(--wood-text)]/70">{item.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
