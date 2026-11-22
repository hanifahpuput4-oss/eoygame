'use client';

import { useCallback, useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { getCachedData, getPersistedCache, setCachedData } from '@/lib/client-cache';

type ActiveRoom = {
  id: string;
  classroomId: string;
  name: string;
  code: string;
  status: string;
};

type Classroom = {
  id: string;
  name: string;
  subject: string;
  grade: string;
  joinCode: string;
  activeRoom?: ActiveRoom | null;
  activeRooms?: ActiveRoom[];
};

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3.5" />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export default function StudentDashboard() {
  const router = useRouter();
  const [classrooms, setClassrooms] = useState<Classroom[]>(() => getCachedData<Classroom[]>('student:classrooms') ?? []);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joiningClass, setJoiningClass] = useState(false);
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);
  const [profile, setProfile] = useState<{ username: string; totalPoints: number; totalStars: number; avatar: string } | null>(
    () => getCachedData('user:profile'),
  );
  const [loading, setLoading] = useState(() => getCachedData<Classroom[]>('student:classrooms') === null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/classrooms?withProfile=1');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.classrooms)) {
          setClassrooms(data.classrooms);
          setCachedData('student:classrooms', data.classrooms);
        }
        if (data.profile) {
          setProfile(data.profile);
          setCachedData('user:profile', data.profile);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cachedClassrooms = getPersistedCache<Classroom[]>('student:classrooms');
    const cachedProfile = getPersistedCache<{ username: string; totalPoints: number; totalStars: number; avatar: string }>('user:profile');
    if (cachedClassrooms) {
      setClassrooms(cachedClassrooms);
      setLoading(false);
    }
    if (cachedProfile) setProfile(cachedProfile);
    load();
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [load]);

  async function onJoinClassroom(e: FormEvent) {
    e.preventDefault();
    setJoinError('');
    setJoiningClass(true);
    try {
      const res = await fetch('/api/classrooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: joinCode.toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setJoinError(data.error ?? 'Gagal masuk kelas');
        return;
      }
      setJoinCode('');
      await load();
    } finally {
      setJoiningClass(false);
    }
  }

  async function onJoinRoom(room: ActiveRoom) {
    setJoinError('');
    setJoiningRoomId(room.id);
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: room.code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setJoinError(data.error ?? 'Gagal masuk ruang game');
        setJoiningRoomId(null);
        return;
      }
      const targetId = data?.room?.id ?? data?.roomId ?? room.id;
      router.push(`/game/${targetId}`);
    } catch {
      setJoinError('Terjadi kesalahan jaringan');
      setJoiningRoomId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner + Join Class Section */}
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="card-panel flex flex-col justify-between lg:col-span-5">
          <div>
            <span className="inline-flex items-center rounded-lg bg-[var(--cream-soft)] px-2.5 py-0.5 text-xs font-bold text-[var(--wood-dark)]">
              Dashboard Siswa
            </span>
            {loading ? (
              <div className="mt-3 space-y-2 animate-pulse">
                <div className="h-7 w-44 rounded-lg bg-[#e8d5b0]/60" />
                <div className="h-4 w-36 rounded-lg bg-[#e8d5b0]/50" />
              </div>
            ) : (
              <>
                <h1 className="mt-2 font-display text-2xl font-bold sm:text-3xl">
                  Halo, {profile?.username ?? 'Siswa'}
                </h1>
                <p className="mt-1 text-sm text-[var(--wood-text)]/70">
                  Pilih kelas yang kamu ikuti untuk bergabung ke sesi permainan yang sedang berlangsung.
                </p>
              </>
            )}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-[#e2cfb0] bg-[var(--cream-bg)]/60 px-3.5 py-2.5">
              <div className="text-xs font-bold uppercase tracking-wide text-[var(--wood-text)]/60">Total Poin</div>
              {loading ? (
                <div className="mt-1 h-6 w-16 animate-pulse rounded-lg bg-[#e8d5b0]/60" />
              ) : (
                <div className="mt-0.5 font-display text-xl font-bold text-[var(--wood-dark)]">
                  {profile?.totalPoints ?? 0}
                </div>
              )}
            </div>
            <div className="rounded-xl border border-[#e2cfb0] bg-[var(--cream-bg)]/60 px-3.5 py-2.5">
              <div className="text-xs font-bold uppercase tracking-wide text-[var(--wood-text)]/60">Kelas Diikuti</div>
              {loading ? (
                <div className="mt-1 h-6 w-12 animate-pulse rounded-lg bg-[#e8d5b0]/60" />
              ) : (
                <div className="mt-0.5 font-display text-xl font-bold text-[var(--wood-dark)]">
                  {classrooms.length}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card-panel flex flex-col justify-center lg:col-span-7">
          <div>
            <h2 className="font-display text-lg font-bold sm:text-xl">Masuk Kelas Baru</h2>
            <p className="mt-1 text-sm text-[var(--wood-text)]/70">
              Masukkan 6 karakter kode kelas dari gurumu. Setelah tergabung, tombol <strong>Join Room</strong> akan otomatis muncul saat guru memulai sesi.
            </p>
          </div>

          <form onSubmit={onJoinClassroom} className="mt-4 flex flex-col gap-2.5 sm:flex-row">
            <input
              className="input-field font-mono text-base uppercase tracking-widest"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="CONTOH: XYZ789"
              maxLength={6}
              disabled={joiningClass}
              required
            />
            <button
              type="submit"
              disabled={joiningClass || joinCode.trim().length < 6}
              className="btn-secondary shrink-0"
            >
              {joiningClass ? (
                <>
                  <Spinner />
                  <span>Menggabungkan...</span>
                </>
              ) : (
                <span>+ Gabung Kelas</span>
              )}
            </button>
          </form>
          {joinError && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2 text-sm font-semibold text-red-600">
              {joinError}
            </div>
          )}
        </div>
      </div>

      {/* Classrooms List Section */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-xl font-bold">Kelasku</h2>
            <p className="text-xs text-[var(--wood-text)]/65 sm:text-sm">
              Daftar kelas yang kamu ikuti. Tombol masuk game muncul otomatis saat guru memulai sesi.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-lg border border-[#e2cfb0] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--wood-text)]/75">
            <span className="h-2 w-2 rounded-full bg-green-600" />
            Sinkronisasi Otomatis
          </div>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="card-panel space-y-4">
                <div className="flex items-center justify-between gap-2 animate-pulse">
                  <div className="h-6 w-36 rounded-lg bg-[#e8d5b0]/60" />
                  <div className="h-5 w-20 rounded-full bg-[#e8d5b0]/50" />
                </div>
                <div className="h-4 w-48 animate-pulse rounded-lg bg-[#e8d5b0]/40" />
                <div className="border-t border-black/5 pt-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[var(--wood-text)]/50">
                    <Spinner className="h-3.5 w-3.5 text-[var(--orange-primary)]" />
                    <span>Memuat data kelas...</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : classrooms.length === 0 ? (
          <div className="card-panel py-10 text-center">
            <h3 className="font-display text-lg font-bold">Belum Ada Kelas</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-[var(--wood-text)]/65">
              Kamu belum tergabung di kelas mana pun. Minta kode kelas 6 karakter ke gurumu lalu masukkan pada kolom di atas.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {classrooms.map((c) => {
              const activeRooms =
                c.activeRooms && c.activeRooms.length > 0
                  ? c.activeRooms
                  : c.activeRoom
                    ? [c.activeRoom]
                    : [];
              const hasActive = activeRooms.length > 0;

              return (
                <div
                  key={c.id}
                  className={`card-panel flex flex-col justify-between gap-4 transition-colors ${
                    hasActive ? 'border-[var(--green-success)] bg-white' : ''
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-display text-lg font-bold">{c.name}</h3>
                      {hasActive ? (
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-green-600" />
                          Game Aktif
                        </span>
                      ) : (
                        <span className="inline-flex shrink-0 items-center rounded-lg bg-[var(--cream-soft)] px-2.5 py-0.5 text-xs font-semibold text-[var(--wood-text)]/75">
                          {c.grade}
                        </span>
                      )}
                    </div>

                    <p className="mt-1 text-xs font-semibold text-[var(--wood-text)]/70">
                      {c.subject} · {c.grade}
                    </p>
                  </div>

                  {hasActive ? (
                    <div className="space-y-2 border-t border-black/10 pt-3">
                      {activeRooms.map((r) => {
                        const isJoining = joiningRoomId === r.id;
                        return (
                          <div
                            key={r.id}
                            className="flex flex-col gap-2 rounded-xl border border-green-200 bg-green-50/50 p-2.5 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-green-800">
                                Sesi Berlangsung
                              </div>
                              <div className="truncate font-display text-sm font-bold text-[var(--wood-dark)]" title={r.name}>
                                {r.name}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => onJoinRoom(r)}
                              disabled={Boolean(joiningRoomId)}
                              className="btn-primary !px-3.5 !py-1.5 text-xs shrink-0"
                            >
                              {isJoining ? (
                                <>
                                  <Spinner />
                                  <span>Masuk...</span>
                                </>
                              ) : (
                                <span>Join Room</span>
                              )}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 border-t border-black/5 pt-3 text-xs text-[var(--wood-text)]/55">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-gray-300" />
                      <span>Menunggu guru memulai sesi game</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
