'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCachedData, getPersistedCache, setCachedData } from '@/lib/client-cache';
import DashboardLoader from '@/components/dashboard/dashboard-loader';

type Classroom = {
  id: string;
  teacherId?: string;
  name: string;
  subject: string;
  grade: string;
  description: string;
  joinCode: string;
};

type TeacherOption = {
  id: string;
  username: string;
  fullName: string;
  role: string;
};

type StudentMember = {
  id: string;
  username: string;
  fullName: string;
  avatar: string;
  totalPoints: number;
  totalStars: number;
};

const emptyForm = { name: '', subject: '', grade: '', description: '', teacherId: '' };

export default function ClassroomsPage() {
  const [classrooms, setClassrooms] = useState<Classroom[]>(() => getCachedData<Classroom[]>('teacher:classrooms') ?? []);
  const [teachers, setTeachers] = useState<TeacherOption[]>(() => getCachedData<TeacherOption[]>('teacher:teachers') ?? []);
  const [isAdmin, setIsAdmin] = useState<boolean>(() => Boolean(getCachedData<boolean>('teacher:isAdmin')));
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState<string>('all');

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(() => getCachedData<Classroom[]>('teacher:classrooms') === null);

  const [selectedClassroom, setSelectedClassroom] = useState<Classroom | null>(null);
  const [students, setStudents] = useState<StudentMember[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/classrooms');
      if (res.ok) {
        const data = await res.json();
        const cls = Array.isArray(data.classrooms) ? data.classrooms : [];
        const tc = Array.isArray(data.teachers) ? data.teachers : [];
        const adm = Boolean(data.isAdmin);
        const uid = typeof data.currentUserId === 'string' ? data.currentUserId : '';
        setClassrooms(cls);
        setTeachers(tc);
        setIsAdmin(adm);
        setCurrentUserId(uid);
        setForm((prev) => ({
          ...prev,
          teacherId: prev.teacherId || uid || tc[0]?.id || '',
        }));
        setCachedData('teacher:classrooms', cls);
        if (tc.length > 0) setCachedData('teacher:teachers', tc);
        setCachedData('teacher:isAdmin', adm);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cached = getPersistedCache<Classroom[]>('teacher:classrooms');
    const cachedTeachers = getPersistedCache<TeacherOption[]>('teacher:teachers');
    const cachedIsAdmin = getPersistedCache<boolean>('teacher:isAdmin');
    if (cached) {
      setClassrooms(cached);
      setLoading(false);
    }
    if (cachedTeachers) setTeachers(cachedTeachers);
    if (typeof cachedIsAdmin === 'boolean') setIsAdmin(cachedIsAdmin);
    load();
  }, [load]);

  const teacherMap = useMemo(() => new Map(teachers.map((t) => [t.id, t])), [teachers]);

  const filteredClassrooms = useMemo(() => {
    if (!isAdmin || selectedTeacherFilter === 'all') return classrooms;
    return classrooms.filter((c) => c.teacherId === selectedTeacherFilter);
  }, [classrooms, isAdmin, selectedTeacherFilter]);

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
    const targetTeacherId = isAdmin
      ? form.teacherId || (selectedTeacherFilter !== 'all' ? selectedTeacherFilter : currentUserId)
      : currentUserId;
    const url = editingId ? `/api/classrooms/${editingId}` : '/api/classrooms';
    const res = await fetch(url, {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.name,
        subject: form.subject,
        grade: form.grade,
        description: form.description,
        ...(isAdmin && targetTeacherId ? { teacherId: targetTeacherId } : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Gagal menyimpan');
      return;
    }
    setForm({
      ...emptyForm,
      teacherId: selectedTeacherFilter !== 'all' ? selectedTeacherFilter : currentUserId,
    });
    setEditingId(null);
    if (data.classroom) {
      setClassrooms((prev) =>
        editingId
          ? prev.map((c) => (c.id === editingId ? data.classroom : c))
          : [data.classroom, ...prev],
      );
    } else {
      load();
    }
  }

  async function onDelete(id: string) {
    if (!confirm('Hapus kelas ini? Semua data terkait ikut terhapus.')) return;
    const prevList = classrooms;
    setClassrooms((prev) => prev.filter((c) => c.id !== id));
    if (selectedClassroom?.id === id) setSelectedClassroom(null);
    const res = await fetch(`/api/classrooms/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      setClassrooms(prevList);
    }
  }

  async function onRegenerate(id: string) {
    const res = await fetch(`/api/classrooms/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'regenerate-code' }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.joinCode) {
        setClassrooms((prev) => prev.map((c) => (c.id === id ? { ...c, joinCode: data.joinCode } : c)));
      } else {
        load();
      }
    }
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold sm:text-3xl">Kelas Saya</h1>
            <p className="mt-1 text-sm text-[var(--wood-text)]/70">
              Buat kelas, bagikan kode kelas ke siswa, dan klik kartu kelas untuk melihat daftar siswa yang sudah bergabung.
            </p>
          </div>
          {isAdmin && (
            <div className="w-full sm:w-72">
              <label className="label-field">Filter Guru Pengampu</label>
              <select
                className="input-field font-semibold"
                value={selectedTeacherFilter}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedTeacherFilter(val);
                  if (val !== 'all' && !editingId) {
                    setForm((prev) => ({ ...prev, teacherId: val }));
                  }
                }}
              >
                <option value="all">Semua Guru ({classrooms.length} kelas)</option>
                {teachers.map((t) => {
                  const count = classrooms.filter((c) => c.teacherId === t.id).length;
                  return (
                    <option key={t.id} value={t.id}>
                      {t.fullName} (@{t.username}) — {count} kelas
                    </option>
                  );
                })}
              </select>
            </div>
          )}
        </div>

        <form onSubmit={onSubmit} className="card-panel space-y-4">
          <div className="border-b border-black/10 pb-3">
            <h2 className="font-display text-lg font-bold">
              {editingId ? 'Edit Informasi Kelas' : 'Tambah Kelas Baru'}
            </h2>
          </div>

          <div className={`grid gap-4 sm:grid-cols-2 ${isAdmin ? 'lg:grid-cols-3' : 'lg:grid-cols-4'}`}>
            {isAdmin && (
              <div className="sm:col-span-2 lg:col-span-1">
                <label className="label-field">Guru Pengampu</label>
                <select
                  className="input-field"
                  required
                  value={form.teacherId}
                  onChange={(e) => setForm({ ...form, teacherId: e.target.value })}
                >
                  <option value="">Pilih guru pengampu...</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.fullName} (@{t.username}){t.role === 'admin' ? ' — Admin' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="label-field">Nama Kelas</label>
              <input
                className="input-field"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Contoh: X TKJ 1"
              />
            </div>
            <div>
              <label className="label-field">Mata Pelajaran Utama</label>
              <input
                className="input-field"
                required
                value={form.subject}
                onChange={(e) => setForm({ ...form, subject: e.target.value })}
                placeholder="Contoh: Informatika"
              />
            </div>
            <div>
              <label className="label-field">Kelas / Tingkat</label>
              <input
                className="input-field"
                required
                value={form.grade}
                onChange={(e) => setForm({ ...form, grade: e.target.value })}
                placeholder="Contoh: Kelas X"
              />
            </div>
            <div className={isAdmin ? 'sm:col-span-2' : ''}>
              <label className="label-field">Deskripsi (Opsional)</label>
              <input
                className="input-field"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Keterangan singkat kelas"
              />
            </div>
          </div>

          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

          <div className="flex flex-wrap gap-2 pt-1">
            <button type="submit" className="btn-primary">
              {editingId ? 'Simpan Perubahan' : '+ Buat Kelas'}
            </button>
            {editingId && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setEditingId(null);
                  setForm({
                    ...emptyForm,
                    teacherId: selectedTeacherFilter !== 'all' ? selectedTeacherFilter : currentUserId,
                  });
                }}
              >
                Batal
              </button>
            )}
          </div>
        </form>

        {loading ? (
          <DashboardLoader label="Memuat daftar kelas..." cards={2} />
        ) : filteredClassrooms.length === 0 ? (
          <div className="card-panel py-10 text-center text-sm text-[var(--wood-text)]/65">
            {classrooms.length === 0
              ? 'Belum ada kelas terdaftar. Buat kelas pertama melalui form di atas.'
              : 'Belum ada kelas untuk guru pengampu yang dipilih.'}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {filteredClassrooms.map((c) => {
              const owner = c.teacherId ? teacherMap.get(c.teacherId) : undefined;
              return (
                <div
                  key={c.id}
                  className="card-panel flex cursor-pointer flex-col justify-between gap-4 transition-colors hover:border-[var(--navy-panel)]/40"
                  onClick={() => openStudentsModal(c)}
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="truncate font-display text-lg font-bold sm:text-xl">{c.name}</h2>
                        <p className="mt-0.5 text-xs font-semibold text-[var(--wood-text)]/70 sm:text-sm">
                          {c.subject} · {c.grade}
                        </p>
                      </div>
                      <span
                        title="Kode Join Kelas"
                        className="shrink-0 rounded-xl bg-[var(--yellow-accent)] px-3 py-1 font-mono text-xs font-bold tracking-widest text-[var(--wood-dark)] sm:text-sm"
                      >
                        {c.joinCode}
                      </span>
                    </div>

                    {isAdmin && owner && (
                      <div className="mt-2.5">
                        <span className="inline-flex items-center rounded-lg bg-[var(--cream-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--wood-dark)]">
                          Guru: {owner.fullName} (@{owner.username})
                        </span>
                      </div>
                    )}

                    {c.description && (
                      <p className="mt-2 text-xs text-[var(--wood-text)]/75 sm:text-sm">{c.description}</p>
                    )}
                  </div>

                  <div
                    className="flex flex-wrap items-center gap-1.5 border-t border-black/5 pt-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      className="rounded-lg bg-[var(--navy-panel)] px-3 py-1.5 text-xs font-bold text-white hover:bg-[var(--navy-deep)]"
                      onClick={() => openStudentsModal(c)}
                    >
                      Lihat Siswa
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-[var(--cream-soft)] px-2.5 py-1.5 text-xs font-bold hover:bg-black/10"
                      onClick={() => {
                        setEditingId(c.id);
                        setForm({
                          name: c.name,
                          subject: c.subject,
                          grade: c.grade,
                          description: c.description,
                          teacherId: c.teacherId || currentUserId,
                        });
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-[var(--cream-soft)] px-2.5 py-1.5 text-xs font-bold hover:bg-black/10"
                      onClick={() => onRegenerate(c.id)}
                    >
                      Ganti Kode
                    </button>
                    <button
                      type="button"
                      className="ml-auto rounded-lg bg-red-100 px-2.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-200"
                      onClick={() => onDelete(c.id)}
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedClassroom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelectedClassroom(null)}
        >
          <div
            className="card-panel max-h-[88vh] w-full max-w-2xl overflow-y-auto bg-[var(--cream-bg)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-black/10 pb-3">
              <div>
                <h2 className="font-display text-xl font-bold sm:text-2xl">
                  Daftar Siswa: {selectedClassroom.name}
                </h2>
                <p className="mt-0.5 text-xs text-[var(--wood-text)]/70 sm:text-sm">
                  {selectedClassroom.subject} · {selectedClassroom.grade} · Kode Join:{' '}
                  <strong className="font-mono">{selectedClassroom.joinCode}</strong>
                </p>
              </div>
              <button
                type="button"
                className="rounded-lg bg-black/10 px-2.5 py-1 text-xs font-bold hover:bg-black/20"
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
              <div className="-mx-4 mt-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
                <table className="w-full min-w-[440px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-black/10 text-xs font-bold uppercase tracking-wide text-[var(--wood-text)]/70">
                      <th className="py-2 pr-3">No</th>
                      <th className="py-2 pr-3">Nama Lengkap</th>
                      <th className="py-2 pr-3">Username</th>
                      <th className="py-2 text-right">Total Poin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-black/5">
                    {students.map((st, idx) => (
                      <tr key={st.id}>
                        <td className="py-2.5 pr-3 font-semibold">{idx + 1}</td>
                        <td className="py-2.5 pr-3 font-semibold">{st.fullName}</td>
                        <td className="py-2.5 pr-3 font-mono text-xs">@{st.username}</td>
                        <td className="py-2.5 text-right font-semibold">{st.totalPoints} poin</td>
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
    </>
  );
}
