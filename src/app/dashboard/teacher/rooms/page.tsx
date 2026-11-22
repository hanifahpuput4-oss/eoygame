'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCachedData, getPersistedCache, setCachedData } from '@/lib/client-cache';
import DashboardLoader from '@/components/dashboard/dashboard-loader';

type Room = {
  id: string;
  name: string;
  code: string;
  status: string;
  maxPlayers: number;
  host?: { id: string; username: string; fullName: string } | null;
  players: { userId: string; username: string; role?: string; ready: boolean }[];
  rejoinRequests?: { userId: string; username: string; requestedAt: number }[];
  level: { id: string; name: string; mapConfig?: string } | null;
  classroom: { id: string; name: string; subject: string; grade: string } | null;
};

type Classroom = { id: string; name: string; subject: string; grade: string };
type LevelRow = { id: string; name: string; mapConfig: string; questionIds: string[] };

type RecapData = {
  room: { id: string; name: string; code: string; status: string };
  classroom: { id: string; name: string; subject: string; grade: string } | null;
  level: { id: string; name: string; subjectName: string; grade: string; objectiveName: string } | null;
  totalQuestions: number;
  maxScore: number;
  students: {
    userId: string;
    fullName: string;
    username: string;
    participated: boolean;
    answeredCount: number;
    correctCount: number;
    wrongCount: number;
    totalQuestions: number;
    rawScore: number;
    maxScore: number;
    finalGrade: number;
  }[];
};

const statusLabels: Record<string, string> = {
  waiting: 'Menunggu',
  starting: 'Memulai',
  in_progress: 'Berlangsung',
  paused: 'Jeda',
  completed: 'Selesai',
};

function parseLevelMeta(lvl: LevelRow): { subjectName: string; grade: string; objectiveName: string } {
  try {
    const parsed = JSON.parse(lvl.mapConfig || '{}');
    if (parsed && typeof parsed.subjectName === 'string' && parsed.subjectName.trim()) {
      return {
        subjectName: parsed.subjectName.trim(),
        grade: typeof parsed.grade === 'string' && parsed.grade.trim() ? parsed.grade.trim() : 'Umum',
        objectiveName:
          typeof parsed.objectiveName === 'string' && parsed.objectiveName.trim()
            ? parsed.objectiveName.trim()
            : lvl.name,
      };
    }
  } catch {
    // fallback below
  }
  const parts = lvl.name.split(' - ');
  if (parts.length >= 2) {
    return {
      subjectName: parts[0].trim(),
      grade: 'Umum',
      objectiveName: parts.slice(1).join(' - ').trim(),
    };
  }
  return {
    subjectName: 'Mapel Umum',
    grade: 'Umum',
    objectiveName: lvl.name,
  };
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>(() => getCachedData<Room[]>('teacher:rooms') ?? []);
  const [classrooms, setClassrooms] = useState<Classroom[]>(() => getCachedData<Classroom[]>('teacher:classrooms') ?? []);
  const [levels, setLevels] = useState<LevelRow[]>(() => getCachedData<LevelRow[]>('teacher:levels') ?? []);

  const [classroomId, setClassroomId] = useState('');
  const [subjectKey, setSubjectKey] = useState('');
  const [levelId, setLevelId] = useState('');
  const [customName, setCustomName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(40);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(() => getCachedData<Room[]>('teacher:rooms') === null);
  const [creating, setCreating] = useState(false);
  const [, setBusyRoomId] = useState<string | null>(null);

  const [recapModal, setRecapModal] = useState<RecapData | null>(null);
  const [loadingRecapId, setLoadingRecapId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/rooms?bootstrap=1');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.rooms)) {
          setRooms(data.rooms);
          setCachedData('teacher:rooms', data.rooms);
        }
        if (Array.isArray(data.classrooms)) {
          setClassrooms(data.classrooms);
          setCachedData('teacher:classrooms', data.classrooms);
        }
        if (Array.isArray(data.levels)) {
          setLevels(data.levels);
          setCachedData('teacher:levels', data.levels);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cachedRooms = getPersistedCache<Room[]>('teacher:rooms');
    const cachedClassrooms = getPersistedCache<Classroom[]>('teacher:classrooms');
    const cachedLevels = getPersistedCache<LevelRow[]>('teacher:levels');
    if (cachedRooms) {
      setRooms(cachedRooms);
      setLoading(false);
    }
    if (cachedClassrooms) setClassrooms(cachedClassrooms);
    if (cachedLevels) setLevels(cachedLevels);
    load();
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, [load]);

  const subjectGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        subjectName: string;
        grade: string;
        objectives: { level: LevelRow; objectiveName: string }[];
      }
    >();
    for (const lvl of levels) {
      const meta = parseLevelMeta(lvl);
      const key = `${meta.subjectName}__${meta.grade}`;
      if (!map.has(key)) {
        map.set(key, { key, subjectName: meta.subjectName, grade: meta.grade, objectives: [] });
      }
      map.get(key)!.objectives.push({ level: lvl, objectiveName: meta.objectiveName });
    }
    return Array.from(map.values());
  }, [levels]);

  const activeSubjectGroup = subjectGroups.find((g) => g.key === subjectKey) ?? null;

  function onSelectSubject(key: string) {
    setSubjectKey(key);
    const grp = subjectGroups.find((g) => g.key === key);
    setLevelId(grp?.objectives[0]?.level.id ?? '');
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!classroomId || !levelId) {
      setError('Pilih Kelas, Mata Pelajaran, dan Tujuan Pembelajaran terlebih dahulu.');
      return;
    }

    const cls = classrooms.find((c) => c.id === classroomId);
    const obj = activeSubjectGroup?.objectives.find((o) => o.level.id === levelId);
    const autoName =
      customName.trim() ||
      `${cls?.name ?? 'Kelas'} - ${activeSubjectGroup?.subjectName ?? 'Mapel'}: ${obj?.objectiveName ?? 'Sesi'}`.slice(0, 75);

    setCreating(true);
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: autoName,
          classroomId,
          levelId,
          maxPlayers,
          settings: {},
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Gagal membuat ruang');
        return;
      }
      setCustomName('');
      if (data.room) {
        setRooms((prev) => [data.room, ...prev]);
      } else {
        void load();
      }
    } finally {
      setCreating(false);
    }
  }

  async function setStatus(id: string, status: string) {
    setBusyRoomId(id);
    setRooms((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    try {
      const res = await fetch(`/api/rooms/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.room) {
          setRooms((prev) => prev.map((r) => (r.id === id ? data.room : r)));
        }
      } else {
        void load();
      }
      if (status === 'completed') {
        openRecap(id);
      }
    } finally {
      setBusyRoomId(null);
    }
  }

  async function openRecap(roomId: string) {
    setLoadingRecapId(roomId);
    try {
      const res = await fetch(`/api/rooms/${roomId}/recap`);
      if (res.ok) {
        const data: RecapData = await res.json();
        setRecapModal(data);
      }
    } finally {
      setLoadingRecapId(null);
    }
  }

  function downloadRecapCsv(recap: RecapData) {
    const header = 'No;Nama Lengkap;Username;Status Hadir;Dijawab;Benar;Salah;Total Soal;Skor Poin;Nilai Akhir (0-100)';
    const rows = recap.students.map((st, idx) =>
      [
        idx + 1,
        st.fullName,
        st.username,
        st.participated ? 'Hadir' : 'Tidak Hadir',
        st.answeredCount,
        st.correctCount,
        st.wrongCount,
        st.totalQuestions,
        st.rawScore,
        st.finalGrade,
      ].join(';'),
    );
    const csv = [header, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rekap_nilai_${recap.room.code}_${recap.classroom?.name ?? 'kelas'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onKickFromDashboard(roomId: string, playerId: string, username: string) {
    if (!confirm(`Keluarkan ${username} dari ruang game ini?`)) return;
    setRooms((prev) =>
      prev.map((r) => (r.id === roomId ? { ...r, players: r.players.filter((p) => p.userId !== playerId) } : r)),
    );
    try {
      const res = await fetch('/api/game/kick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, playerId }),
      });
      if (!res.ok) {
        void load();
      }
    } catch {
      void load();
    }
  }

  async function onKickAllFromDashboard(roomId: string) {
    if (!confirm('Keluarkan semua siswa dari ruang game ini?')) return;
    try {
      const res = await fetch('/api/game/kick-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId }),
      });
      if (res.ok) {
        const data = await res.json();
        const kickedSet = new Set<string>(Array.isArray(data.kickedIds) ? data.kickedIds : []);
        setRooms((prev) =>
          prev.map((r) =>
            r.id === roomId ? { ...r, players: r.players.filter((p) => !kickedSet.has(p.userId)) } : r,
          ),
        );
      }
    } finally {
      void load();
    }
  }

  async function onApproveRejoin(roomId: string, playerId: string) {
    setRooms((prev) =>
      prev.map((r) =>
        r.id === roomId
          ? { ...r, rejoinRequests: (r.rejoinRequests ?? []).filter((req) => req.userId !== playerId) }
          : r,
      ),
    );
    try {
      await fetch('/api/game/approve-rejoin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, playerId }),
      });
    } finally {
      void load();
    }
  }

  async function onRejectRejoin(roomId: string, playerId: string) {
    setRooms((prev) =>
      prev.map((r) =>
        r.id === roomId
          ? { ...r, rejoinRequests: (r.rejoinRequests ?? []).filter((req) => req.userId !== playerId) }
          : r,
      ),
    );
    try {
      await fetch('/api/game/reject-rejoin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId, playerId }),
      });
    } finally {
      void load();
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Hapus ruang ini?')) return;
    const previous = rooms;
    setRooms((prev) => prev.filter((r) => r.id !== id));
    try {
      const res = await fetch(`/api/rooms/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        setRooms(previous);
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Gagal menghapus ruang');
      }
    } catch {
      setRooms(previous);
      setError('Gagal menghapus ruang');
    }
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">Ruang Game & Rekap Nilai</h1>
      <p className="mt-1 text-sm text-[var(--wood-text)]/70">
        Pilih Kelas, Mata Pelajaran, dan Tujuan Pembelajaran untuk membuka ruang game. Saat game diakhiri, rekap nilai otomatis tersedia.
      </p>

      <form onSubmit={onSubmit} className="card-panel mt-6 grid gap-4 md:grid-cols-3">
        <div>
          <label className="label-field">1. Pilih Kelas</label>
          <select
            className="input-field"
            required
            value={classroomId}
            onChange={(e) => setClassroomId(e.target.value)}
          >
            <option value="">Pilih kelas...</option>
            {classrooms.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.grade})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label-field">2. Pilih Mata Pelajaran</label>
          <select
            className="input-field"
            required
            value={subjectKey}
            onChange={(e) => onSelectSubject(e.target.value)}
          >
            <option value="">Pilih mapel...</option>
            {subjectGroups.map((g) => (
              <option key={g.key} value={g.key}>
                {g.subjectName} ({g.grade})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="label-field">3. Pilih Tujuan Pembelajaran / Kategori Soal</label>
          <select
            className="input-field"
            required
            value={levelId}
            onChange={(e) => setLevelId(e.target.value)}
            disabled={!activeSubjectGroup}
          >
            <option value="">
              {activeSubjectGroup ? 'Pilih tujuan pembelajaran...' : 'Pilih mapel dulu...'}
            </option>
            {activeSubjectGroup?.objectives.map((o) => (
              <option key={o.level.id} value={o.level.id}>
                {o.objectiveName} ({o.level.questionIds.length} soal)
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label className="label-field">Judul Sesi Ruang (Opsional - Otomatis jika dikosongkan)</label>
          <input
            className="input-field"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Kosongkan agar otomatis mengikuti nama Kelas + Mapel + Tujuan Pembelajaran"
          />
        </div>

        <div>
          <label className="label-field">Maks Pemain</label>
          <input
            type="number"
            min={2}
            max={60}
            className="input-field"
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(Number(e.target.value))}
          />
        </div>

        {error && <p className="text-sm text-red-600 md:col-span-3">{error}</p>}
        <button type="submit" disabled={creating} className="btn-primary disabled:opacity-60 md:col-span-3">
          {creating ? '⏳ Membuat Ruang Game...' : '🎮 Buat Ruang Game Sekarang'}
        </button>
      </form>

      {loading ? (
        <DashboardLoader label="Memuat daftar ruang game..." cards={2} />
      ) : rooms.length === 0 ? (
        <p className="mt-8 text-center text-sm text-[var(--wood-text)]/60">Belum ada ruang game.</p>
      ) : (
        <div className="mt-8 space-y-4">
          {rooms.map((r) => (
            <div key={r.id} className="card-panel">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-semibold">{r.name}</h2>
                  <p className="text-sm text-[var(--wood-text)]/70">
                    {r.host ? (
                      <>
                        Guru Host: <strong>{r.host.fullName} (@{r.host.username})</strong> |{' '}
                      </>
                    ) : null}
                    Kelas: <strong>{r.classroom?.name ?? '-'}</strong> | Tujuan Pembelajaran:{' '}
                    <strong>{r.level?.name ?? '-'}</strong> | Pemain: {r.players.length}/{r.maxPlayers}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-xl bg-[var(--yellow-accent)] px-3 py-1 font-mono text-sm font-bold tracking-widest">
                    {r.code}
                  </span>
                  <span
                    className={`rounded-xl px-3 py-1 text-sm font-bold ${
                      r.status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : r.status === 'in_progress'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-[var(--cream-soft)]'
                    }`}
                  >
                    {statusLabels[r.status] ?? r.status}
                  </span>
                </div>
              </div>

              {r.players.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-sm">
                  <span className="font-semibold text-[var(--wood-text)]/80">Pemain di ruang:</span>
                  {r.players.map((p) => (
                    <span
                      key={p.userId}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#e8d5b0] bg-[var(--cream-soft)] px-2.5 py-0.5 text-xs font-semibold"
                    >
                      <span>
                        {p.username}
                        {p.role === 'admin' ? ' (ADMIN)' : p.role === 'teacher' ? ' (GURU)' : ''}
                      </span>
                      {p.role !== 'admin' && p.role !== 'teacher' && (
                        <button
                          type="button"
                          title={`Kick ${p.username}`}
                          onClick={() => onKickFromDashboard(r.id, p.userId, p.username)}
                          className="rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-bold text-red-700 hover:bg-red-200"
                        >
                          Kick
                        </button>
                      )}
                    </span>
                  ))}
                  {r.players.some((p) => p.role !== 'admin' && p.role !== 'teacher') && (
                    <button
                      type="button"
                      onClick={() => onKickAllFromDashboard(r.id)}
                      className="rounded-lg bg-red-600 px-2.5 py-0.5 text-xs font-bold text-white hover:bg-red-700"
                    >
                      🚫 Kick Semua
                    </button>
                  )}
                </div>
              )}

              {r.rejoinRequests && r.rejoinRequests.length > 0 && (
                <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50/90 p-3">
                  <div className="text-xs font-bold text-amber-900">
                    Permintaan Masuk Kembali (Approve akan me-reset soal &amp; poin sesi siswa ke 0):
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {r.rejoinRequests.map((req) => (
                      <div
                        key={req.userId}
                        className="inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-semibold shadow-sm"
                      >
                        <span className="font-bold text-[var(--wood-dark)]">{req.username}</span>
                        <button
                          type="button"
                          onClick={() => onApproveRejoin(r.id, req.userId)}
                          className="rounded-md bg-green-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-green-700"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => onRejectRejoin(r.id, req.userId)}
                          className="rounded-md bg-red-100 px-2 py-1 text-xs font-bold text-red-700 hover:bg-red-200"
                        >
                          Tolak
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                {r.status === 'waiting' && (
                  <button className="btn-success !px-4 !py-2 text-sm" onClick={() => setStatus(r.id, 'in_progress')}>
                    ▶ Mulai Game
                  </button>
                )}
                {r.status === 'in_progress' && (
                  <button className="btn-secondary !px-4 !py-2 text-sm" onClick={() => setStatus(r.id, 'paused')}>
                    Jeda
                  </button>
                )}
                {r.status === 'paused' && (
                  <button className="btn-success !px-4 !py-2 text-sm" onClick={() => setStatus(r.id, 'in_progress')}>
                    Lanjutkan
                  </button>
                )}
                {(r.status === 'in_progress' || r.status === 'paused') && (
                  <button className="btn-primary !px-4 !py-2 text-sm" onClick={() => setStatus(r.id, 'completed')}>
                    🏁 Akhiri & Lihat Rekap Nilai
                  </button>
                )}
                {r.status !== 'completed' && (
                  <Link
                    className="rounded-xl bg-[var(--blue-info)] px-4 py-2 text-sm font-semibold text-white"
                    href={`/game/${r.id}`}
                  >
                    Masuk Ruang
                  </Link>
                )}
                {r.status === 'completed' && (
                  <button
                    type="button"
                    className="rounded-xl bg-[var(--navy-panel)] px-4 py-2 text-sm font-bold text-white"
                    onClick={() => openRecap(r.id)}
                    disabled={loadingRecapId === r.id}
                  >
                    📊 {loadingRecapId === r.id ? 'Memuat Rekap...' : 'Lihat Rekap Nilai'}
                  </button>
                )}
                <button
                  className="rounded-xl bg-red-100 px-4 py-2 text-sm font-semibold text-red-700"
                  onClick={() => onDelete(r.id)}
                >
                  Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {recapModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setRecapModal(null)}
        >
          <div
            className="card-panel max-h-[88vh] w-full max-w-4xl overflow-y-auto bg-[var(--cream-bg)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-black/10 pb-4">
              <div>
                <span className="rounded-lg bg-green-100 px-2.5 py-1 text-xs font-bold text-green-800">
                  REKAP NILAI AKHIR
                </span>
                <h2 className="mt-1 font-display text-2xl font-bold">{recapModal.room.name}</h2>
                <p className="text-sm text-[var(--wood-text)]/75">
                  Kelas: <strong>{recapModal.classroom?.name ?? '-'}</strong> · Mapel:{' '}
                  <strong>{recapModal.level?.subjectName ?? '-'}</strong> · Tujuan Pembelajaran:{' '}
                  <strong>{recapModal.level?.objectiveName ?? '-'}</strong> · Total Soal:{' '}
                  <strong>{recapModal.totalQuestions}</strong>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="btn-success !px-4 !py-2 text-sm"
                  onClick={() => downloadRecapCsv(recapModal)}
                >
                  ⬇ Download Nilai (CSV / Excel)
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-black/10 px-3 py-1.5 text-sm font-bold hover:bg-black/20"
                  onClick={() => setRecapModal(null)}
                >
                  ✕
                </button>
              </div>
            </div>

            {recapModal.students.length === 0 ? (
              <p className="py-8 text-center text-sm text-[var(--wood-text)]/70">
                Belum ada data siswa atau jawaban pada sesi permainan ini.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b-2 border-black/15 text-xs uppercase text-[var(--wood-text)]/75">
                      <th className="py-2.5 pr-3">Peringkat</th>
                      <th className="py-2.5 pr-3">Nama Siswa</th>
                      <th className="py-2.5 pr-3">Username</th>
                      <th className="py-2.5 pr-3 text-center">Kehadiran</th>
                      <th className="py-2.5 pr-3 text-center">Benar</th>
                      <th className="py-2.5 pr-3 text-center">Salah</th>
                      <th className="py-2.5 pr-3 text-center">Skor Game</th>
                      <th className="py-2.5 text-right">Nilai Akhir (0-100)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recapModal.students.map((st, idx) => (
                      <tr key={st.userId} className="border-b border-black/10">
                        <td className="py-2.5 pr-3 font-bold">#{idx + 1}</td>
                        <td className="py-2.5 pr-3 font-bold">{st.fullName}</td>
                        <td className="py-2.5 pr-3 font-mono text-xs">{st.username}</td>
                        <td className="py-2.5 pr-3 text-center">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                              st.participated ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700'
                            }`}
                          >
                            {st.participated ? 'Hadir' : 'Belum Masuk'}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-center font-bold text-green-700">{st.correctCount}</td>
                        <td className="py-2.5 pr-3 text-center font-bold text-red-600">{st.wrongCount}</td>
                        <td className="py-2.5 pr-3 text-center font-semibold">
                          {st.rawScore} / {recapModal.maxScore}
                        </td>
                        <td className="py-2.5 text-right">
                          <span
                            className={`inline-block rounded-xl px-3 py-1 font-display text-base font-bold ${
                              st.finalGrade >= 75
                                ? 'bg-green-100 text-green-900'
                                : st.finalGrade >= 50
                                  ? 'bg-yellow-100 text-yellow-900'
                                  : 'bg-red-100 text-red-800'
                            }`}
                          >
                            {st.finalGrade}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <button type="button" className="btn-primary" onClick={() => setRecapModal(null)}>
                Tutup Rekap
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
