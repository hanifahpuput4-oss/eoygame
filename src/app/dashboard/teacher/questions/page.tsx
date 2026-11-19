'use client';

import { useCallback, useEffect, useState } from 'react';

type Question = {
  id: string;
  type: string;
  content: string;
  explanation: string;
  difficulty: string;
  category: string;
  points: number;
  timeLimit: number;
  correctAnswer?: string;
  options: { label: string; content: string }[];
};

type FormState = {
  type: 'multiple_choice' | 'true_false' | 'short_answer' | 'fill_blank';
  content: string;
  correctAnswer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  category: string;
  points: number;
  timeLimit: number;
  options: { label: 'A' | 'B' | 'C' | 'D'; content: string }[];
};

const emptyForm: FormState = {
  type: 'multiple_choice',
  content: '',
  correctAnswer: '',
  explanation: '',
  difficulty: 'easy',
  category: '',
  points: 10,
  timeLimit: 30,
  options: [
    { label: 'A', content: '' },
    { label: 'B', content: '' },
    { label: 'C', content: '' },
    { label: 'D', content: '' },
  ],
};

const typeLabels: Record<string, string> = {
  multiple_choice: 'Pilihan Ganda',
  true_false: 'Benar / Salah',
  short_answer: 'Isian Singkat',
  fill_blank: 'Melengkapi',
};

export default function QuestionsPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState({ search: '', category: '', difficulty: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (filter.search) params.set('search', filter.search);
    if (filter.category) params.set('category', filter.category);
    if (filter.difficulty) params.set('difficulty', filter.difficulty);
    const res = await fetch(`/api/questions?${params}`);
    if (res.ok) {
      const data = await res.json();
      setQuestions(data.questions);
      setCategories(data.categories);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const res = await fetch(editingId ? `/api/questions/${editingId}` : '/api/questions', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        imageUrl: '',
        options: form.type === 'multiple_choice' ? form.options.filter((o) => o.content) : [],
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? 'Gagal menyimpan soal');
      return;
    }
    setForm(emptyForm);
    setEditingId(null);
    load();
  }

  async function onDelete(id: string) {
    if (!confirm('Hapus soal ini?')) return;
    await fetch(`/api/questions/${id}`, { method: 'DELETE' });
    load();
  }

  function onEdit(q: Question) {
    setEditingId(q.id);
    setForm({
      type: q.type as FormState['type'],
      content: q.content,
      correctAnswer: q.correctAnswer ?? '',
      explanation: q.explanation,
      difficulty: q.difficulty as FormState['difficulty'],
      category: q.category,
      points: q.points,
      timeLimit: q.timeLimit,
      options:
        q.options.length > 0
          ? q.options.map((o) => ({ label: o.label as 'A' | 'B' | 'C' | 'D', content: o.content }))
          : emptyForm.options,
    });
  }

  function updateOption(label: string, content: string) {
    setForm((f) => ({
      ...f,
      options: f.options.map((o) => (o.label === label ? { ...o, content } : o)),
    }));
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold">Bank Soal</h1>

      <form onSubmit={onSubmit} className="card-panel mt-6 space-y-4">
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="label-field">Tipe Soal</label>
            <select className="input-field" value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as FormState['type'] })}>
              {Object.entries(typeLabels).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label-field">Kategori</label>
            <input className="input-field" required value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Fungsi Excel" />
          </div>
          <div>
            <label className="label-field">Kesulitan</label>
            <select className="input-field" value={form.difficulty}
              onChange={(e) => setForm({ ...form, difficulty: e.target.value as FormState['difficulty'] })}>
              <option value="easy">Mudah</option>
              <option value="medium">Sedang</option>
              <option value="hard">Sulit</option>
            </select>
          </div>
        </div>

        <div>
          <label className="label-field">Pertanyaan</label>
          <textarea className="input-field" required rows={2} value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            placeholder="Tulis pertanyaan di sini" />
        </div>

        {form.type === 'multiple_choice' && (
          <div className="grid gap-3 md:grid-cols-2">
            {form.options.map((o) => (
              <div key={o.label} className="flex items-center gap-2">
                <span className="font-display font-bold">{o.label}</span>
                <input className="input-field" value={o.content}
                  onChange={(e) => updateOption(o.label, e.target.value)} placeholder={`Pilihan ${o.label}`} />
                <label className="flex items-center gap-1 text-sm">
                  <input type="radio" name="correct" checked={form.correctAnswer === o.label}
                    onChange={() => setForm({ ...form, correctAnswer: o.label })} />
                  Benar
                </label>
              </div>
            ))}
          </div>
        )}

        {form.type === 'true_false' && (
          <div>
            <label className="label-field">Jawaban Benar</label>
            <select className="input-field" value={form.correctAnswer}
              onChange={(e) => setForm({ ...form, correctAnswer: e.target.value })}>
              <option value="">Pilih...</option>
              <option value="true">Benar</option>
              <option value="false">Salah</option>
            </select>
          </div>
        )}

        {(form.type === 'short_answer' || form.type === 'fill_blank') && (
          <div>
            <label className="label-field">Jawaban Benar</label>
            <input className="input-field" required value={form.correctAnswer}
              onChange={(e) => setForm({ ...form, correctAnswer: e.target.value })} placeholder="Kunci jawaban" />
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <label className="label-field">Poin</label>
            <input type="number" min={1} max={100} className="input-field" value={form.points}
              onChange={(e) => setForm({ ...form, points: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label-field">Batas Waktu (detik)</label>
            <input type="number" min={5} max={300} className="input-field" value={form.timeLimit}
              onChange={(e) => setForm({ ...form, timeLimit: Number(e.target.value) })} />
          </div>
          <div>
            <label className="label-field">Pembahasan</label>
            <input className="input-field" value={form.explanation}
              onChange={(e) => setForm({ ...form, explanation: e.target.value })} placeholder="Opsional" />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-3">
          <button type="submit" className="btn-primary">
            {editingId ? 'Simpan Perubahan' : 'Tambah Soal'}
          </button>
          {editingId && (
            <button type="button" className="btn-secondary" onClick={() => { setEditingId(null); setForm(emptyForm); }}>
              Batal
            </button>
          )}
        </div>
      </form>

      <div className="mt-8 flex flex-wrap gap-3">
        <input className="input-field max-w-xs" placeholder="Cari soal..."
          value={filter.search} onChange={(e) => setFilter({ ...filter, search: e.target.value })} />
        <select className="input-field max-w-xs" value={filter.category}
          onChange={(e) => setFilter({ ...filter, category: e.target.value })}>
          <option value="">Semua Kategori</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className="input-field max-w-xs" value={filter.difficulty}
          onChange={(e) => setFilter({ ...filter, difficulty: e.target.value })}>
          <option value="">Semua Kesulitan</option>
          <option value="easy">Mudah</option>
          <option value="medium">Sedang</option>
          <option value="hard">Sulit</option>
        </select>
      </div>

      {loading ? (
        <p className="mt-6 text-center text-sm">Memuat...</p>
      ) : questions.length === 0 ? (
        <p className="mt-6 text-center text-sm text-[var(--wood-text)]/60">Belum ada soal.</p>
      ) : (
        <div className="mt-6 space-y-3">
          {questions.map((q) => (
            <div key={q.id} className="card-panel flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-lg bg-[var(--yellow-accent)] px-2 py-0.5 font-semibold">
                    {typeLabels[q.type] ?? q.type}
                  </span>
                  <span className="rounded-lg bg-[var(--cream-soft)] px-2 py-0.5">{q.category}</span>
                  <span className="rounded-lg bg-[var(--cream-soft)] px-2 py-0.5">{q.difficulty}</span>
                  <span className="rounded-lg bg-[var(--cream-soft)] px-2 py-0.5">{q.points} poin</span>
                  <span className="rounded-lg bg-[var(--cream-soft)] px-2 py-0.5">{q.timeLimit}s</span>
                </div>
                <p className="mt-2 font-semibold">{q.content}</p>
                {q.options.length > 0 && (
                  <p className="mt-1 text-sm text-[var(--wood-text)]/70">
                    {q.options.map((o) => `${o.label}. ${o.content}`).join(' | ')}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button className="rounded-xl bg-[var(--cream-soft)] px-3 py-1.5 text-sm font-semibold" onClick={() => onEdit(q)}>
                  Edit
                </button>
                <button className="rounded-xl bg-red-100 px-3 py-1.5 text-sm font-semibold text-red-700" onClick={() => onDelete(q.id)}>
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
