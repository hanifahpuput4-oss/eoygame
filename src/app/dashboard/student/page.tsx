'use client';

import { useCallback, useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

type Classroom = { id: string; name: string; subject: string; grade: string; joinCode: string };

export default function StudentDashboard() {
  const router = useRouter();
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [profile, setProfile] = useState<{ username: string; totalPoints: number; totalStars: number; avatar: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [cRes, pRes] = await Promise.all([fetch('/api/classrooms'), fetch('/api/profile')]);
    if (cRes.ok) setClassrooms((await cRes.json()).classrooms);
    if (pRes.ok) setProfile((await pRes.json()).profile);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function onJoin(e: FormEvent) {
    e.preventDefault();
    setJoinError('');
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: joinCode.toUpperCase() }),
    });
    const data = await res.json();
    if (!res.ok) {
      setJoinError(data.error ?? 'Gagal masuk ruang');
      return;
    }
    router.push(`/game/${data.room.id}`);
  }

  async function onJoinClassroom(e: FormEvent) {
    e.preventDefault();
    setJoinError('');
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
    load();
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">Halo, {profile?.username ?? 'Petualang'}! 🐱</h1>
      <p className="mt-1 text-[var(--wood-text)]/70">
        {profile?.totalPoints ?? 0} poin | {profile?.totalStars ?? 0} bintang
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card-panel">
          <h2 className="font-display text-xl font-semibold">Masuk Ruang Game</h2>
          <p className="mt-1 text-sm text-[var(--wood-text)]/70">Masukkan kode 6 karakter dari gurumu.</p>
          <form onSubmit={onJoin} className="mt-4 flex gap-3">
            <input
              className="input-field font-mono text-lg uppercase tracking-widest"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              required
            />
            <button type="submit" className="btn-primary">Masuk</button>
          </form>
          {joinError && <p className="mt-2 text-sm text-red-600">{joinError}</p>}
        </div>

        <div className="card-panel">
          <h2 className="font-display text-xl font-semibold">Masuk Kelas</h2>
          <p className="mt-1 text-sm text-[var(--wood-text)]/70">Gunakan kode kelas untuk bergabung.</p>
          <form onSubmit={onJoinClassroom} className="mt-4 flex gap-3">
            <input
              className="input-field font-mono text-lg uppercase tracking-widest"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="XYZ789"
              maxLength={6}
              required
            />
            <button type="submit" className="btn-secondary">Gabung</button>
          </form>
        </div>
      </div>

      <h2 className="mt-10 font-display text-2xl font-semibold">Kelasku</h2>
      {loading ? (
        <p className="mt-4 text-center text-sm">Memuat...</p>
      ) : classrooms.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--wood-text)]/60">
          Belum gabung kelas mana. Minta kode kelas ke gurumu.
        </p>
      ) : (
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {classrooms.map((c) => (
            <div key={c.id} className="card-panel">
              <h3 className="font-display text-lg font-semibold">{c.name}</h3>
              <p className="text-sm text-[var(--wood-text)]/70">{c.subject} | {c.grade}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
