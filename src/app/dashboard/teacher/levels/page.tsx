'use client';

import { useCallback, useEffect, useState } from 'react';

type Level = {
  id: string;
  name: string;
  description: string;
  difficulty: string;
  completionRequirement: number;
  questionIds: string[];
};

type Question = { id: string; content: string; category: string };

const emptyForm = {
  name: '',
  description: '',
  difficulty: 'easy' as 'easy' | 'medium' | 'hard',
  completionRequirement: 1,
  questionIds: [] as string[],
};

export default function LevelsPage() {
  const [levels, setLevels] = useState<Level[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [lvRes, qRes] = await Promise.all([fetch('/api/levels'), fetch('/api/questions')]);
    if (lvRes.ok) setLevels((await lvRes.json()).levels);
    if (qRes.ok) setQuestions((await qRes.json()).questions);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function toggleQuestion(id: string) {
    setForm((f) => ({
      ...f,
      questionIds: f.questionIds.includes(id)
        ? f.questionIds.filter((q) => q !== id)
        : [...f.questionIds, id],
    }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch(editingId ? `/api/levels/${editingId}` : '/api/levels', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, rewardConfig: { stars: 3 } }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Gagal menyimpan level');
      return;
    }
    setForm(emptyForm);
    setEditingId(null);
    load();
  }

  async function onDelete(id: string) {
    if (!confirm('Hapus level ini?')) return;
    await fetch(`/api/levels/${id}`, { method: 'DELETE' });
    load();
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">Manajemen Level</h1>

      <form onSubmit={onSubmit} className="card-panel mt-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="label-field">Nama Level</label>
            <input className="input-field" required value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Level 1: Pengenalan Excel" />
          </div>
          <div>
            <label className="label-field">Kesulitan</label>
            <select className="input-field" value={form.difficulty}
              onChange={(e) => setForm({ ...form, difficulty: e.target.value as 'easy' | 'medium' | 'hard' })}>
              <option value="easy">Mudah</option>
              <option value="medium">Sedang</option>
              <option value="hard">Sulit</option>
            </select>
          </div>
          <div>
            <label className="label-field">Minimal Soal Benar</label>
            <input type="number" min={1} max={30} className="input-field" value={form.completionRequirement}
              onChange={(e) => setForm({ ...form, completionRequirement: Number(e.target.value) })} />
          </div>
        </div>
        <div>
          <label className="label-field">Deskripsi</label>
          <input className="input-field" value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Opsional" />
        </div>

        <div>
          <label className="label-field">Pilih Soal ({form.questionIds.length} dipilih)</label>
          <div className="max-h-64 space-y-2 overflow-y-auto rounded-2xl border-2 border-[#e8d5b0] bg-white p-3">
            {questions.length === 0 ? (
              <p className="text-sm text-[var(--wood-text)]/60">Belum ada soal. Buat dulu di Bank Soal.</p>
            ) : (
              questions.map((q) => (
                <label key={q.id} className="flex items-start gap-2 text-sm">
                  <input type="checkbox" className="mt-1" checked={form.questionIds.includes(q.id)}
                    onChange={() => toggleQuestion(q.id)} />
                  <span><strong>{q.category}</strong>: {q.content}</span>
                </label>
              ))
            )}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-3">
          <button type="submit" className="btn-primary">
            {editingId ? 'Simpan Perubahan' : 'Buat Level'}
          </button>
          {editingId && (
            <button type="button" className="btn-secondary" onClick={() => { setEditingId(null); setForm(emptyForm); }}>
              Batal
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p className="mt-8 text-center text-sm">Memuat...</p>
      ) : levels.length === 0 ? (
        <p className="mt-8 text-center text-sm text-[var(--wood-text)]/60">Belum ada level.</p>
      ) : (
        <div className="mt-8 space-y-3">
          {levels.map((lvl) => (
            <div key={lvl.id} className="card-panel flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-xl font-semibold">{lvl.name}</h2>
                <p className="text-sm text-[var(--wood-text)]/70">
                  {lvl.difficulty} | {lvl.questionIds.length} soal | minimal benar {lvl.completionRequirement}
                </p>
                {lvl.description && <p className="mt-1 text-sm">{lvl.description}</p>}
              </div>
              <div className="flex gap-2">
                <button className="rounded-xl bg-[var(--cream-soft)] px-3 py-1.5 text-sm font-semibold"
                  onClick={() => {
                    setEditingId(lvl.id);
                    setForm({
                      name: lvl.name,
                      description: lvl.description,
                      difficulty: lvl.difficulty as 'easy' | 'medium' | 'hard',
                      completionRequirement: lvl.completionRequirement,
                      questionIds: lvl.questionIds,
                    });
                  }}>
                  Edit
                </button>
                <button className="rounded-xl bg-red-100 px-3 py-1.5 text-sm font-semibold text-red-700" onClick={() => onDelete(lvl.id)}>
                  Hapus
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
