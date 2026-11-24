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
  externalId?: string | null;
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
  const [externalId, setExternalId] = useState(initialProfile?.externalId ?? '');
  const [avatar, setAvatar] = useState<AvatarKey>(initialProfile?.avatar ?? 'cat-blue');

  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    const persisted = getPersistedCache<CachedProfile>('user:profile');
    if (persisted) {
      setEmail(persisted.email ?? '');
      setRole(persisted.role ?? '');
      setFullName(persisted.fullName ?? '');
      setUsername(persisted.username ?? '');
      setExternalId(persisted.externalId ?? '');
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
        setExternalId(profile.externalId ?? '');
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

  if (loading) {
    return <DashboardLoader label="Memuat pengaturan akun..." cards={1} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Pengaturan Akun</h1>
        <p className="mt-1 text-sm text-[var(--wood-text)]/70">
          Ubah username tampilan di dalam game atau avatar akun Anda. Nama lengkap & NIS terkunci, sinkron dengan Siakad.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <form onSubmit={onSaveProfile} className="card-panel space-y-4">
          <div className="flex items-center justify-between border-b border-black/10 pb-3">
            <div>
              <h2 className="font-display text-lg font-bold">Profil Pengguna</h2>
              <p className="text-xs text-[var(--wood-text)]/70">Informasi identitas yang tampil di dashboard & arena game.</p>
            </div>
            <span className="rounded-lg bg-[var(--navy-panel)] px-2.5 py-1 text-xs font-bold text-white">
              {role === 'admin' ? 'Administrator' : role === 'teacher' ? 'Guru' : 'Siswa'}
            </span>
          </div>

          <div>
            <label htmlFor="settings-email" className="label-field">
              Email Akun
            </label>
            <input
              id="settings-email"
              type="email"
              className="input-field bg-black/5 opacity-75"
              value={email}
              disabled
            />
          </div>

          <div>
            <label htmlFor="settings-external-id" className="label-field">
              NIS / NIP (Terkunci)
            </label>
            <input
              id="settings-external-id"
              type="text"
              className="input-field bg-black/5 opacity-75"
              value={externalId}
              disabled
              placeholder="Belum terhubung Siakad"
            />
          </div>

          <div>
            <label htmlFor="settings-fullname" className="label-field">
              Nama Lengkap (Terkunci, sinkron Siakad)
            </label>
            <input
              id="settings-fullname"
              type="text"
              className="input-field bg-black/5 opacity-75"
              value={fullName}
              disabled
              placeholder="Nama lengkap dari Siakad"
            />
          </div>

          <div>
            <label htmlFor="settings-username" className="label-field">
              Username (Nama di Game)
            </label>
            <input
              id="settings-username"
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="input-field lowercase"
              value={username}
              onChange={(e) => setUsername(e.target.value.replace(/[^a-z0-9_]/g, '').slice(0, 24))}
              placeholder="contoh: pakbudi_guru"
              minLength={3}
              maxLength={24}
              pattern="[a-z0-9_]+"
              title="Hanya huruf kecil, angka, dan underscore"
              required
            />
          </div>

          <div>
            <span className="label-field">Warna Avatar Karakter</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {AVATAR_OPTIONS.map((opt) => {
                const selected = avatar === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setAvatar(opt.id)}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition ${
                      selected
                        ? 'border-[var(--navy-panel)] bg-[var(--navy-panel)] text-white'
                        : 'border-[#dcc8a6] bg-white text-[var(--wood-text)] hover:border-[var(--navy-panel)]/40'
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
              className={`rounded-xl px-3.5 py-2.5 text-sm font-semibold ${
                profileMsg.type === 'ok' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'
              }`}
            >
              {profileMsg.text}
            </div>
          )}

          <div className="pt-1">
            <button type="submit" className="btn-primary w-full sm:w-auto" disabled={profileSaving}>
              {profileSaving ? 'Menyimpan...' : 'Simpan Profil'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
