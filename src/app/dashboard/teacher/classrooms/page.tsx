'use client';

import { useCallback, useEffect, useState } from 'react';

type Classroom = {
  id: string;
  name: string;
  subject: string;
  grade: string;
  description: string;
  joinCode: string;
};

type StudentMember = {
  id: string;
  username: string;
  fullName: string;
  avatar: string;
  totalPoints: number;
  totalStars: number;
};

const emptyForm = { name: '', subject: '', grade: '', description: '' };

export default function ClassroomsPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const [selectedClassroom, setSelectedClassroom] = useState<Classroom | null>(null);
  const [students, setStudents] = useState<StudentMember[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/classrooms');
    if (res.ok) {
      const data = await res.json();
      setClassrooms(data.classrooms);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function openStudentsModal(classroom: Classroom) {
    setSelectedClassroom(classroom);
    setLoadingStudents(true);
    setStudents([]);
    try {
      const res = await fetch(`/api/classrooms/${classroom.id}`);
      if (res.ok) {
        const data = await res.json();
        setStudents(data.students ?? []);
      }
    } finally {
      setLoadingStudents(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const url = editingId ? `/api/classrooms/${editingId}` : '/api/classrooms';
    const res = await fetch(url, {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Gagal menyimpan');
      return;
    }
    setForm(emptyForm);
    setEditingId(null);
    load();
  }

  async function onDelete(id: string) {
    if (!confirm('Hapus kelas ini? Semua data terkait ikut terhapus.')) return;
    await fetch(`/api/classrooms/${id}`, { method: 'DELETE' });
    if (selectedClassroom?.id === id) setSelectedClassroom(null);
    load();
  }

  async function onRegenerate(id: string) {
    const res = await fetch(`/api/classrooms/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'regenerate-code' }),
    });
    if (res.ok) load();
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">Kelas Saya</h1>
      <p className="mt-1 text-sm text-[var(--wood-text)]/70">
        Buat kelas, bagikan kode kelas ke siswa, dan klik kartu kelas untuk melihat daftar siswa yang sudah bergabung.
      </p>

      <form onSubmit={onSubmit} className="card-panel mt-6 grid gap-4 md:grid-cols-2">
        <div>
          <label className="label-field">Nama Kelas</label>
          <input
            className="input-field"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="X TKJ 1"
          />
        </div>
        <div>
          <label className="label-field">Mata Pelajaran Utama</label>
          <input
            className="input-field"
            required
            value={form.subject}
            onChange={(e) => setForm({ ...form, subject: e.target.value })}
            placeholder="Informatika / Microsoft Excel"
          />
        </div>
        <div>
          <label className="label-field">Kelas / Tingkat</label>
          <input
            className="input-field"
            required
            value={form.grade}
            onChange={(e) => setForm({ ...form, grade: e.target.value })}
            placeholder="Kelas X"
          />
        </div>
        <div>
          <label className="label-field">Deskripsi</label>
          <input
            className="input-field"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Opsional"
          />
        </div>
        {error && <p className="text-sm text-red-600 md:col-span-2">{error}</p>}
        <div className="flex gap-3 md:col-span-2">
          <button type="submit" className="btn-primary">
            {editingId ? 'Simpan Perubahan' : 'Buat Kelas'}
          </button>
          {editingId && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setEditingId(null);
                setForm(emptyForm);
              }}
            >
              Batal
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p className="mt-8 text-center text-sm">Memuat...</p>
      ) : classrooms.length === 0 ? (
        <p className="mt-8 text-center text-sm text-[var(--wood-text)]/60">
          Belum ada kelas. Buat kelas pertama di form atas.
        </p>
      ) : (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {classrooms.map((c) => (
            <div
              key={c.id}
              className="card-panel cursor-pointer transition hover:border-[var(--navy-panel)]/40 hover:shadow-md"
              onClick={() => openStudentsModal(c)}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="font-display text-xl font-semibold">{c.name}</h2>
                  <p className="text-sm text-[var(--wood-text)]/70">
                    {c.subject} | {c.grade}
                  </p>
                </div>
                <span className="rounded-xl bg-[var(--yellow-accent)] px-3 py-1 font-mono text-sm font-bold tracking-widest">
                  {c.joinCode}
                </span>
              </div>
              {c.description && <p className="mt-2 text-sm">{c.description}</p>}
              <div className="mt-4 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  className="rounded-xl bg-[var(--navy-panel)] px-3 py-1.5 text-sm font-semibold text-white"
                  onClick={() => openStudentsModal(c)}
                >
                  👥 Lihat Siswa
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-[var(--cream-soft)] px-3 py-1.5 text-sm font-semibold"
                  onClick={() => {
                    setEditingId(c.id);
                    setForm({ name: c.name, subject: c.subject, grade: c.grade, description: c.description });
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-[var(--cream-soft)] px-3 py-1.5 text-sm font-semibold"
                  onClick={() => onRegenerate(c.id)}
                >
                  Ganti Kode
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-red-100 px-3 py-1.5 text-sm font-semibold text-red-700"
                  onClick={() => onDelete(c.id)}
                >
                  Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedClassroom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedClassroom(null)}
        >
          <div
            className="card-panel max-h-[85vh] w-full max-w-2xl overflow-y-auto bg-[var(--cream-bg)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-black/10 pb-3">
              <div>
                <h2 className="font-display text-2xl font-bold">
                  Daftar Siswa: {selectedClassroom.name}
                </h2>
                <p className="text-sm text-[var(--wood-text)]/70">
                  {selectedClassroom.subject} · {selectedClassroom.grade} · Kode Join:{' '}
                  <strong className="font-mono">{selectedClassroom.joinCode}</strong>
                </p>
              </div>
              <button
                type="button"
                className="rounded-xl bg-black/10 px-3 py-1 text-sm font-bold hover:bg-black/20"
                onClick={() => setSelectedClassroom(null)}
              >
                ✕
              </button>
            </div>

            {loadingStudents ? (
              <p className="py-8 text-center text-sm">Memuat daftar siswa...</p>
            ) : students.length === 0 ? (
              <div className="py-8 text-center">
                <p className="font-semibold">Belum ada siswa yang bergabung di kelas ini.</p>
                <p className="mt-1 text-sm text-[var(--wood-text)]/70">
                  Bagikan kode kelas <strong className="font-mono">{selectedClassroom.joinCode}</strong> agar siswa dapat bergabung dari dashboard mereka.
                </p>
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b-2 border-black/10 text-xs uppercase text-[var(--wood-text)]/70">
                      <th className="py-2 pr-3">No</th>
                      <th className="py-2 pr-3">Nama Lengkap</th>
                      <th className="py-2 pr-3">Username Game</th>
                      <th className="py-2 text-right">Total Poin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((st, idx) => (
                      <tr key={st.id} className="border-b border-black/5">
                        <td className="py-2.5 pr-3 font-semibold">{idx + 1}</td>
                        <td className="py-2.5 pr-3 font-bold">{st.fullName}</td>
                        <td className="py-2.5 pr-3 font-mono text-xs">{st.username}</td>
                        <td className="py-2.5 text-right font-bold">{st.totalPoints} poin</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                className="btn-primary"
                onClick={() => setSelectedClassroom(null)}
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
