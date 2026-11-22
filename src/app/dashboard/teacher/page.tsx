import Link from 'next/link';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { classrooms, levels, rooms, users } from '@/db/schema';
import { getCurrentUser } from '@/server/auth/session';

export default async function TeacherOverview() {
  const user = await getCurrentUser();
  const isAdmin = user?.role === 'admin';

  const [classRows, levelRows, roomRows, userRows] = await Promise.all([
    isAdmin
      ? db.select({ id: classrooms.id }).from(classrooms)
      : db
          .select({ id: classrooms.id })
          .from(classrooms)
          .where(eq(classrooms.teacherId, user?.id ?? '')),
    isAdmin
      ? db.select({ id: levels.id }).from(levels)
      : db
          .select({ id: levels.id })
          .from(levels)
          .where(eq(levels.teacherId, user?.id ?? '')),
    isAdmin
      ? db.select({ id: rooms.id }).from(rooms)
      : db
          .select({ id: rooms.id })
          .from(rooms)
          .where(eq(rooms.hostId, user?.id ?? '')),
    isAdmin ? db.select({ id: users.id }).from(users) : Promise.resolve([]),
  ]);

  const stats = [
    {
      label: isAdmin ? 'Total Kelas Terdaftar' : 'Kelas Saya',
      value: classRows.length,
      href: '/dashboard/teacher/classrooms',
    },
    {
      label: isAdmin ? 'Total Tujuan Pembelajaran' : 'Tujuan Pembelajaran',
      value: levelRows.length,
      href: '/dashboard/teacher/subjects',
    },
    {
      label: isAdmin ? 'Total Sesi Ruang Game' : 'Ruang Game',
      value: roomRows.length,
      href: '/dashboard/teacher/rooms',
    },
    ...(isAdmin
      ? [
          {
            label: 'Total Akun Pengguna',
            value: userRows.length,
            href: '/dashboard/teacher/users',
          },
        ]
      : []),
  ];

  const items = [
    {
      href: '/dashboard/teacher/classrooms',
      title: 'Kelas Saya',
      desc: isAdmin
        ? 'Kelola kelas seluruh guru, filter berdasarkan guru pengampu, dan lihat daftar siswa.'
        : 'Buat kelas, bagikan kode join 6 karakter, dan kelola daftar siswa.',
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
      title: 'Manajemen Mapel & Soal',
      desc: isAdmin
        ? 'Susun mata pelajaran, tujuan pembelajaran, dan import bank soal untuk guru mana pun.'
        : 'Susun mata pelajaran, tujuan pembelajaran, dan import bank soal.',
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      ),
    },
    {
      href: '/dashboard/teacher/rooms',
      title: 'Ruang Game & Rekap Nilai',
      desc: 'Buka sesi permainan kelas, filter status sesi, pantau jalannya game, dan unduh rekap nilai.',
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="6" width="20" height="12" rx="4" />
          <path d="M6 12h4m-2-2v4" />
          <circle cx="15.5" cy="11" r="1" fill="currentColor" />
          <circle cx="17.5" cy="13" r="1" fill="currentColor" />
        </svg>
      ),
    },
    ...(isAdmin
      ? [
          {
            href: '/dashboard/teacher/users',
            title: 'Manajemen User',
            desc: 'Kelola akun Administrator, Guru, dan Siswa, atur hak akses, reset password, dan poin.',
            icon: (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <circle cx="12" cy="10" r="2.5" />
                <path d="M8.5 16.5c.8-1.4 2.1-2 3.5-2s2.7.6 3.5 2" />
              </svg>
            ),
          },
        ]
      : []),
    {
      href: '/dashboard/teacher/settings',
      title: 'Pengaturan Akun',
      desc: 'Perbarui nama lengkap, username in-game, warna karakter, dan password.',
      icon: (
        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-2xl font-bold sm:text-3xl">Halo, {user?.fullName}</h1>
            <span className="rounded-lg bg-[var(--navy-panel)] px-2.5 py-0.5 text-xs font-bold text-white">
              {isAdmin ? 'Administrator' : 'Guru'}
            </span>
          </div>
          <p className="mt-1 text-sm text-[var(--wood-text)]/70">
            Ringkasan data kelas, materi soal, dan pintasan modul pengelolaan pembelajaran.
          </p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className={`grid gap-3.5 sm:grid-cols-2 ${isAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        {stats.map((st) => (
          <Link
            key={st.label}
            href={st.href}
            className="card-panel flex flex-col justify-between transition-colors hover:border-[var(--navy-panel)]/40"
          >
            <span className="text-xs font-bold uppercase tracking-wide text-[var(--wood-text)]/60">
              {st.label}
            </span>
            <span className="mt-2 font-display text-3xl font-bold text-[var(--wood-dark)]">
              {st.value}
            </span>
          </Link>
        ))}
      </div>

      {/* Module Links */}
      <div>
        <h2 className="mb-3 font-display text-lg font-bold">Modul Pengelolaan</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="card-panel group flex items-start gap-4 transition-colors hover:border-[var(--navy-panel)]/40"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--navy-panel)] text-white transition-colors group-hover:bg-[var(--orange-primary)] group-hover:text-[#2e1502]">
                {item.icon}
              </div>
              <div className="min-w-0">
                <h3 className="font-display text-base font-bold sm:text-lg">{item.title}</h3>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--wood-text)]/70 sm:text-sm">
                  {item.desc}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
