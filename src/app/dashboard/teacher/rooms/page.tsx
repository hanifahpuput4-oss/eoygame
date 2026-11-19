'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

type Room = {
  id: string;
  name: string;
  code: string;
  status: string;
  maxPlayers: number;
  players: { userId: string; username: string; ready: boolean }[];
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
  const [rooms, setRooms] = useState<Room[]>([]);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [levels, setLevels] = useState<LevelRow[]>([]);

  const [classroomId, setClassroomId] = useState('');
  const [subjectKey, setSubjectKey] = useState('');
  const [levelId, setLevelId] = useState('');
  const [customName, setCustomName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(40);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [recapModal, setRecapModal] = useState<RecapData | null>(null);
  const [loadingRecapId, setLoadingRecapId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [rRes, cRes, lRes] = await Promise.all([
      fetch('/api/rooms'),
      fetch('/api/classrooms'),
      fetch('/api/levels'),
    ]);
    if (rRes.ok) setRooms((await rRes.json()).rooms);
    if (cRes.ok) setClassrooms((await cRes.json()).classrooms);
    if (lRes.ok) setLevels((await lRes.json()).levels);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
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
    load();
  }

  async function setStatus(id: string, status: string) {
    await fetch(`/api/rooms/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    await load();
    if (status === 'completed') {
      openRecap(id);
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

  async function onDelete(id: string) {
    if (!confirm('Hapus ruang ini?')) return;
    await fetch(`/api/rooms/${id}`, { method: 'DELETE' });
    load();
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
        <button type="submit" className="btn-primary md:col-span-3">
          🎮 Buat Ruang Game Sekarang
        </button>
      </form>

      {loading ? (
        <p className="mt-8 text-center text-sm">Memuat...</p>
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
                <p className="mt-2 text-sm">
                  Pemain di ruang: {r.players.map((p) => p.username).join(', ')}
                </p>
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
                  <a
                    className="rounded-xl bg-[var(--blue-info)] px-4 py-2 text-sm font-semibold text-white"
                    href={`/game/${r.id}`}
                  >
                    Masuk Ruang
                  </a>
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
