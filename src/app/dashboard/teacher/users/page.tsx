'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import DashboardLoader from '@/components/dashboard/dashboard-loader';

type UserRow = {
  id: string;
  email: string;
  username: string;
  fullName: string;
  role: 'admin' | 'teacher' | 'student';
  avatar: string;
  totalPoints: number;
  totalStars: number;
  createdAt?: string | number;
};

const ROLE_LABELS: Record<'admin' | 'teacher' | 'student', string> = {
  admin: 'Administrator',
  teacher: 'Guru',
  student: 'Siswa',
};

const ROLE_BADGES: Record<'admin' | 'teacher' | 'student', string> = {
  admin: 'bg-red-100 text-red-800 border border-red-300',
  teacher: 'bg-amber-100 text-amber-900 border border-amber-300',
  student: 'bg-blue-100 text-blue-800 border border-blue-200',
};

export default function AdminUsersManagementPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'teacher' | 'student'>('all');
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    fullName: '',
    username: '',
    email: '',
    password: '',
    role: 'student' as 'admin' | 'teacher' | 'student',
    totalPoints: 0,
  });
  const [creating, setCreating] = useState(false);

  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: '',
    username: '',
    email: '',
    role: 'student' as 'admin' | 'teacher' | 'student',
    totalPoints: 0,
    password: '',
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const loadUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        u.username.toLowerCase().includes(q) ||
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
    });
  }, [users, search, roleFilter]);

  const counts = useMemo(() => {
    return {
      all: users.length,
      admin: users.filter((u) => u.role === 'admin').length,
      teacher: users.filter((u) => u.role === 'teacher').length,
      student: users.filter((u) => u.role === 'student').length,
    };
  }, [users]);

  async function onCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    setCreating(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createForm,
          totalPoints: Number(createForm.totalPoints) || 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusMsg({ type: 'err', text: data.error ?? 'Gagal menambahkan user' });
        return;
      }
      setCreateForm({
        fullName: '',
        username: '',
        email: '',
        password: '',
        role: 'student',
        totalPoints: 0,
      });
      setCreateOpen(false);
      if (data.user) {
        setUsers((prev) => [data.user, ...prev]);
      } else {
        await loadUsers();
      }
      setStatusMsg({ type: 'ok', text: `User "${data.user?.username}" berhasil dibuat.` });
    } finally {
      setCreating(false);
    }
  }

  function openEditModal(u: UserRow) {
    setEditingUser(u);
    setEditForm({
      fullName: u.fullName,
      username: u.username,
      email: u.email,
      role: u.role,
      totalPoints: u.totalPoints,
      password: '',
    });
  }

  async function onSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setStatusMsg(null);
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: editForm.fullName.trim(),
          username: editForm.username.trim().toLowerCase(),
          email: editForm.email.trim().toLowerCase(),
          role: editForm.role,
          totalPoints: Number(editForm.totalPoints) || 0,
          password: editForm.password.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusMsg({ type: 'err', text: data.error ?? 'Gagal memperbarui user' });
        return;
      }
      if (data.user) {
        setUsers((prev) => prev.map((u) => (u.id === editingUser.id ? data.user : u)));
      } else {
        await loadUsers();
      }
      setEditingUser(null);
      setStatusMsg({ type: 'ok', text: `Data user "${editForm.username}" berhasil diperbarui.` });
    } finally {
      setSavingEdit(false);
    }
  }

  async function onDeleteUser(u: UserRow) {
    if (!confirm(`Hapus akun "${u.fullName} (@${u.username})"? Semua kelas/sesi milik user ini akan ikut terhapus.`)) {
      return;
    }
    setStatusMsg(null);
    const prev = users;
    setUsers((list) => list.filter((item) => item.id !== u.id));
    const res = await fetch(`/api/admin/users/${u.id}`, { method: 'DELETE' });
    if (!res.ok) {
      setUsers(prev);
      const data = await res.json().catch(() => ({}));
      setStatusMsg({ type: 'err', text: data.error ?? 'Gagal menghapus user' });
      return;
    }
    setStatusMsg({ type: 'ok', text: `User "@${u.username}" telah dihapus.` });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold">Manajemen User (Administrator)</h1>
          <p className="mt-1 text-sm text-[var(--wood-text)]/70">
            Kelola seluruh akun Administrator, Guru, dan Siswa. Ubah role, reset password, atau sesuaikan total poin siswa.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary !px-4 !py-2.5 text-sm"
          onClick={() => setCreateOpen((v) => !v)}
        >
          {createOpen ? 'Tutup Form User' : '+ Tambah User Baru'}
        </button>
      </div>

      {statusMsg && (
        <div
          role="status"
          className={`rounded-2xl px-4 py-3 text-sm font-bold ${
            statusMsg.type === 'ok' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'
          }`}
        >
          {statusMsg.text}
        </div>
      )}

      {createOpen && (
        <form onSubmit={onCreateUser} className="card-panel grid gap-4 md:grid-cols-3">
          <div className="md:col-span-3">
            <h2 className="font-display text-xl font-bold">Buat Akun User Baru</h2>
          </div>
          <div>
            <label className="label-field">Nama Lengkap</label>
            <input
              className="input-field"
              required
              placeholder="Contoh: Budi Santoso"
              value={createForm.fullName}
              onChange={(e) => setCreateForm({ ...createForm, fullName: e.target.value })}
            />
          </div>
          <div>
            <label className="label-field">Username</label>
            <input
              className="input-field lowercase"
              required
              placeholder="contoh: budi_tkj"
              value={createForm.username}
              onChange={(e) => setCreateForm({ ...createForm, username: e.target.value.toLowerCase() })}
            />
          </div>
          <div>
            <label className="label-field">Email</label>
            <input
              type="email"
              className="input-field lowercase"
              required
              placeholder="budi@sekolah.sch.id"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value.toLowerCase() })}
            />
          </div>
          <div>
            <label className="label-field">Password</label>
            <input
              type="password"
              className="input-field"
              required
              minLength={6}
              placeholder="Minimal 6 karakter"
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
            />
          </div>
          <div>
            <label className="label-field">Role / Peran</label>
            <select
              className="input-field"
              value={createForm.role}
              onChange={(e) =>
                setCreateForm({ ...createForm, role: e.target.value as 'admin' | 'teacher' | 'student' })
              }
            >
              <option value="student">Siswa</option>
              <option value="teacher">Guru</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
          <div>
            <label className="label-field">Poin Awal</label>
            <input
              type="number"
              min={0}
              className="input-field"
              value={createForm.totalPoints}
              onChange={(e) => setCreateForm({ ...createForm, totalPoints: Number(e.target.value) })}
            />
          </div>
          <div className="flex justify-end gap-2 md:col-span-3">
            <button
              type="button"
              className="btn-secondary !px-4 !py-2 text-sm"
              onClick={() => setCreateOpen(false)}
            >
              Batal
            </button>
            <button type="submit" disabled={creating} className="btn-primary !px-5 !py-2 text-sm">
              {creating ? 'Menyimpan...' : 'Simpan User'}
            </button>
          </div>
        </form>
      )}

      {/* Filter & Search */}
      <section className="card-panel space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {(
              [
                { key: 'all', label: `Semua (${counts.all})` },
                { key: 'admin', label: `Admin (${counts.admin})` },
                { key: 'teacher', label: `Guru (${counts.teacher})` },
                { key: 'student', label: `Siswa (${counts.student})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setRoleFilter(tab.key)}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                  roleFilter === tab.key
                    ? 'bg-[var(--navy-panel)] text-white shadow'
                    : 'bg-[var(--cream-soft)] text-[var(--wood-text)] hover:bg-black/10'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="w-full sm:w-72">
            <input
              className="input-field !py-2 text-sm"
              placeholder="Cari nama, username, atau email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <DashboardLoader label="Memuat daftar pengguna..." compact />
        ) : filteredUsers.length === 0 ? (
          <p className="py-8 text-center text-sm text-[var(--wood-text)]/60">
            Tidak ada pengguna yang cocok dengan pencarian.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b-2 border-black/10 text-xs uppercase text-[var(--wood-text)]/70">
                  <th className="py-2.5 pr-3">Nama Lengkap</th>
                  <th className="py-2.5 pr-3">Username</th>
                  <th className="py-2.5 pr-3">Email</th>
                  <th className="py-2.5 pr-3">Role</th>
                  <th className="py-2.5 pr-3 text-right">Total Poin</th>
                  <th className="py-2.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="border-b border-black/10 hover:bg-black/[0.02]">
                    <td className="py-3 pr-3 font-bold">{u.fullName}</td>
                    <td className="py-3 pr-3 font-mono text-xs font-semibold">@{u.username}</td>
                    <td className="py-3 pr-3 text-xs text-[var(--wood-text)]/80">{u.email}</td>
                    <td className="py-3 pr-3">
                      <span className={`inline-block rounded-lg px-2.5 py-0.5 text-xs font-bold ${ROLE_BADGES[u.role]}`}>
                        {ROLE_LABELS[u.role]}
                      </span>
                    </td>
                    <td className="py-3 pr-3 text-right font-bold">{u.totalPoints} poin</td>
                    <td className="py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(u)}
                          className="rounded-xl bg-[var(--cream-soft)] px-3 py-1.5 text-xs font-bold hover:bg-black/10"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteUser(u)}
                          className="rounded-xl bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-200"
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editingUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setEditingUser(null)}
        >
          <div
            className="card-panel w-full max-w-lg bg-[var(--cream-bg)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-black/10 pb-3">
              <div>
                <h2 className="font-display text-2xl font-bold">Edit User: @{editingUser.username}</h2>
                <p className="text-xs text-[var(--wood-text)]/70">
                  Ubah informasi profil, role akses, poin, atau reset password.
                </p>
              </div>
              <button
                type="button"
                className="rounded-xl bg-black/10 px-3 py-1 text-sm font-bold hover:bg-black/20"
                onClick={() => setEditingUser(null)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={onSaveEdit} className="mt-4 space-y-3.5">
              <div>
                <label className="label-field">Nama Lengkap</label>
                <input
                  className="input-field"
                  required
                  value={editForm.fullName}
                  onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label-field">Username</label>
                  <input
                    className="input-field lowercase"
                    required
                    value={editForm.username}
                    onChange={(e) => setEditForm({ ...editForm, username: e.target.value.toLowerCase() })}
                  />
                </div>
                <div>
                  <label className="label-field">Email</label>
                  <input
                    type="email"
                    className="input-field lowercase"
                    required
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value.toLowerCase() })}
                  />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label-field">Role / Peran</label>
                  <select
                    className="input-field"
                    value={editForm.role}
                    onChange={(e) =>
                      setEditForm({ ...editForm, role: e.target.value as 'admin' | 'teacher' | 'student' })
                    }
                  >
                    <option value="student">Siswa</option>
                    <option value="teacher">Guru</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <div>
                  <label className="label-field">Total Poin</label>
                  <input
                    type="number"
                    min={0}
                    className="input-field"
                    value={editForm.totalPoints}
                    onChange={(e) => setEditForm({ ...editForm, totalPoints: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div>
                <label className="label-field">Reset Password Baru (Kosongkan jika tidak diubah)</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Ketik password baru minimal 6 karakter..."
                  value={editForm.password}
                  onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="btn-secondary !px-4 !py-2 text-sm"
                  onClick={() => setEditingUser(null)}
                >
                  Batal
                </button>
                <button type="submit" disabled={savingEdit} className="btn-primary !px-5 !py-2 text-sm">
                  {savingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
