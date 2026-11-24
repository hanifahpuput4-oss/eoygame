'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCachedData, getPersistedCache, setCachedData } from '@/lib/client-cache';
import DashboardLoader from '@/components/dashboard/dashboard-loader';

type AvatarKey = 'cat-blue' | 'cat-pink' | 'cat-green' | 'cat-orange' | 'cat-purple';

const AVATAR_OPTIONS: { id: AvatarKey; label: string; color: string }[] = [
  { id: 'cat-blue', label: 'Kucing Biru', color: '#3b82f6' },
  { id: 'cat-pink', label: 'Kucing Pink', color: '#ec4899' },
  { id: 'cat-green', label: 'Kucing Hijau', color: '#22c55e' },
  { id: 'cat-orange', label: 'Kucing Oranye', color: '#f97316' },
  { id: 'cat-purple', label: 'Kucing Ungu', color: '#a855f7' },
];

type CachedProfile = {
  email?: string;
  role?: string;
  fullName?: string;
  username?: string;
  avatar?: AvatarKey;
};

export default function UserSettingsForm() {
  const router = useRouter();
  const initialProfile = getCachedData<CachedProfile>('user:profile');
  const [loading, setLoading] = useState(() => !initialProfile);
  const [email, setEmail] = useState(initialProfile?.email ?? '');
  const [role, setRole] = useState(initialProfile?.role ?? '');
  const [fullName, setFullName] = useState(initialProfile?.fullName ?? '');
  const [username, setUsername] = useState(initialProfile?.username ?? '');
  const [avatar, setAvatar] = useState<AvatarKey>(initialProfile?.avatar ?? 'cat-blue');

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    const persisted = getPersistedCache<CachedProfile>('user:profile');
    if (persisted) {
      setEmail(persisted.email ?? '');
      setRole(persisted.role ?? '');
      setFullName(persisted.fullName ?? '');
      setUsername(persisted.username ?? '');
      if (persisted.avatar) setAvatar(persisted.avatar);
      setLoading(false);
    }
    async function load() {
      const res = await fetch('/api/profile');
      if (res.ok) {
        const { profile } = await res.json();
        setEmail(profile.email ?? '');
        setRole(profile.role ?? '');
        setFullName(profile.fullName ?? '');
        setUsername(profile.username ?? '');
        if (profile.avatar) setAvatar(profile.avatar as AvatarKey);
        setCachedData('user:profile', profile);
      }
      setLoading(false);
    }
    load();
  }, []);

  async function onSaveProfile(e: FormEvent) {
    e.preventDefault();
    setProfileMsg(null);
    setProfileSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update-profile',
          fullName,
          username,
          avatar,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setProfileMsg({ type: 'err', text: data.error ?? 'Gagal menyimpan perubahan profil' });
        return;
      }
      setProfileMsg({ type: 'ok', text: 'Profil berhasil diperbarui.' });
      router.refresh();
    } finally {
      setProfileSaving(false);
    }
  }

  async function onSavePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordMsg(null);
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'err', text: 'Konfirmasi password baru tidak sama' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'err', text: 'Password baru minimal 6 karakter' });
      return;
    }
    setPasswordSaving(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'change-password',
          currentPassword,
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPasswordMsg({ type: 'err', text: data.error ?? 'Gagal mengubah password' });
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMsg({ type: 'ok', text: 'Password berhasil diubah.' });
    } finally {
      setPasswordSaving(false);
    }
  }

  if (loading) {
    return <DashboardLoader label="Memuat pengaturan akun..." cards={1} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Pengaturan Akun</h1>
        <p className="mt-1 text-sm text-[var(--wood-text)]/70">
          Ubah nama lengkap, username tampilan di dalam game, avatar, atau ganti password akun Anda.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={onSaveProfile} className="card-panel space-y-4">
          <div className="flex items-center justify-between border-b border-black/10 pb-3">
            <div>
              <h2 className="font-display text-xl font-bold">Profil Pengguna</h2>
              <p className="text-xs text-[var(--wood-text)]/70">Informasi identitas yang tampil di dashboard & arena game.</p>
            </div>
            <span className="rounded-full bg-[var(--navy-panel)] px-3 py-1 text-xs font-bold uppercase text-white">
              {role === 'teacher' ? 'Guru' : 'Siswa'}
            </span>
          </div>

          <div>
            <label htmlFor="settings-email" className="block text-sm font-bold">
              Email Akun
            </label>
            <input
              id="settings-email"
              type="email"
              className="input-field mt-1 bg-black/5 opacity-75"
              value={email}
              disabled
            />
          </div>

          <div>
            <label htmlFor="settings-fullname" className="block text-sm font-bold">
              Nama Lengkap
            </label>
            <input
              id="settings-fullname"
              type="text"
              className="input-field mt-1"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Masukkan nama lengkap"
              minLength={2}
              maxLength={80}
              required
            />
          </div>

          <div>
            <label htmlFor="settings-username" className="block text-sm font-bold">
              Username (Nama di Game)
            </label>
            <input
              id="settings-username"
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="input-field mt-1 lowercase"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
              placeholder="contoh: pakbudi_guru"
              minLength={3}
              maxLength={30}
              required
            />
          </div>

          <div>
            <span className="block text-sm font-bold">Warna Avatar Karakter</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {AVATAR_OPTIONS.map((opt) => {
                const selected = avatar === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setAvatar(opt.id)}
                    className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-xs font-bold transition ${
                      selected
                        ? 'border-[var(--navy-panel)] bg-[var(--navy-panel)] text-white'
                        : 'border-black/15 bg-white/80 text-[var(--wood-text)] hover:border-black/30'
                    }`}
                  >
                    <span
                      className="inline-block h-3.5 w-3.5 rounded-full border border-black/20"
                      style={{ backgroundColor: opt.color }}
                    />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {profileMsg && (
            <div
              role="status"
              className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                profileMsg.type === 'ok' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'
              }`}
            >
              {profileMsg.text}
            </div>
          )}

          <div className="pt-2">
            <button type="submit" className="btn-primary" disabled={profileSaving}>
              {profileSaving ? 'Menyimpan...' : 'Simpan Profil'}
            </button>
          </div>
        </form>

        <form onSubmit={onSavePassword} className="card-panel space-y-4">
          <div className="border-b border-black/10 pb-3">
            <h2 className="font-display text-xl font-bold">Ganti Password</h2>
            <p className="text-xs text-[var(--wood-text)]/70">Gunakan minimal 6 karakter untuk keamanan akun.</p>
          </div>

          <div>
            <label htmlFor="settings-current-pw" className="block text-sm font-bold">
              Password Lama
            </label>
            <input
              id="settings-current-pw"
              type="password"
              className="input-field mt-1"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Masukkan password saat ini"
              autoComplete="current-password"
              required
            />
          </div>

          <div>
            <label htmlFor="settings-new-pw" className="block text-sm font-bold">
              Password Baru
            </label>
            <input
              id="settings-new-pw"
              type="password"
              className="input-field mt-1"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              minLength={6}
              autoComplete="new-password"
              required
            />
          </div>

          <div>
            <label htmlFor="settings-confirm-pw" className="block text-sm font-bold">
              Konfirmasi Password Baru
            </label>
            <input
              id="settings-confirm-pw"
              type="password"
              className="input-field mt-1"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Ketik ulang password baru"
              minLength={6}
              autoComplete="new-password"
              required
            />
          </div>

          {passwordMsg && (
            <div
              role="status"
              className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                passwordMsg.type === 'ok' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'
              }`}
            >
              {passwordMsg.text}
            </div>
          )}

          <div className="pt-2">
            <button type="submit" className="btn-secondary" disabled={passwordSaving}>
              {passwordSaving ? 'Memperbarui...' : 'Ubah Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
