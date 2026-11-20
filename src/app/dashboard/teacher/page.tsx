import Link from 'next/link';
import { getCurrentUser } from '@/server/auth/session';

export default async function TeacherOverview() {
  const user = await getCurrentUser();

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">Selamat datang, {user?.fullName} 👋</h1>
      <p className="mt-1 text-[var(--wood-text)]/70">
        Kelola kelas, soal, dan ruang game dari satu tempat.
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/dashboard/teacher/classrooms" className="card-panel transition-transform hover:scale-[1.02]">
          <span className="text-4xl">🏫</span>
          <h2 className="mt-3 font-display text-xl font-semibold">Kelas Saya</h2>
          <p className="mt-1 text-sm text-[var(--wood-text)]/70">Buat kelas, bagikan kode join, dan lihat daftar siswa.</p>
        </Link>
        <Link href="/dashboard/teacher/subjects" className="card-panel transition-transform hover:scale-[1.02]">
          <span className="text-4xl">📚</span>
          <h2 className="mt-3 font-display text-xl font-semibold">Manajemen Mapel</h2>
          <p className="mt-1 text-sm text-[var(--wood-text)]/70">Atur mata pelajaran, tujuan pembelajaran, dan import soal.</p>
        </Link>
        <Link href="/dashboard/teacher/rooms" className="card-panel transition-transform hover:scale-[1.02]">
          <span className="text-4xl">🎮</span>
          <h2 className="mt-3 font-display text-xl font-semibold">Ruang Game & Rekap</h2>
          <p className="mt-1 text-sm text-[var(--wood-text)]/70">Pilih kelas & tujuan pembelajaran, mulai game, dan unduh rekap nilai.</p>
        </Link>
        <Link href="/dashboard/teacher/settings" className="card-panel transition-transform hover:scale-[1.02]">
          <span className="text-4xl">⚙️</span>
          <h2 className="mt-3 font-display text-xl font-semibold">Pengaturan Akun</h2>
          <p className="mt-1 text-sm text-[var(--wood-text)]/70">Ubah nama, username game, avatar, dan password.</p>
        </Link>
      </div>
    </div>
  );
}
