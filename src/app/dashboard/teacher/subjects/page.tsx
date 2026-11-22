'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { getCachedData, getPersistedCache, setCachedData } from '@/lib/client-cache';
import DashboardLoader from '@/components/dashboard/dashboard-loader';

type LevelRow = {
  id: string;
  teacherId: string;
  name: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  mapConfig: string;
  completionRequirement: number;
  questionIds: string[];
};

type TeacherOption = {
  id: string;
  username: string;
  fullName: string;
  role: string;
};

type QuestionRow = {
  id: string;
  type: string;
  content: string;
  correctAnswer: string;
  explanation: string;
  difficulty: string;
  category: string;
  points: number;
  timeLimit: number;
  options: { label: string; content: string }[];
};

type SubjectGroup = {
  key: string;
  teacherId: string;
  subjectName: string;
  grade: string;
  objectives: {
    level: LevelRow;
    objectiveName: string;
  }[];
};

const DUMMY_CSV_TEMPLATE = `Pertanyaan;Opsi A;Opsi B;Opsi C;Opsi D;Opsi E;Kunci;Poin;Pembahasan
Manakah fungsi Excel untuk menjumlahkan rentang angka?;VLOOKUP;SUM;AVERAGE;COUNT;MAX;B;10;SUM digunakan untuk menjumlahkan seluruh angka pada rentang sel.
Fungsi untuk mencari nilai rata-rata di Microsoft Excel adalah?;MAX;MIN;AVERAGE;IF;CONCAT;C;10;AVERAGE menghitung rata-rata aritmatika dari argumen.
Simbol wajib untuk mengawali setiap rumus di Excel adalah?;#;@;=;$;%;C;10;Semua formula di Excel wajib diawali tanda sama dengan (=).`;

function parseMapMeta(lvl: LevelRow): { subjectName: string; grade: string; objectiveName: string } {
  try {
    const parsed = JSON.parse(lvl.mapConfig || '{}');
    if (parsed && typeof parsed.subjectName === 'string' && parsed.subjectName.trim()) {
      return {
        subjectName: parsed.subjectName.trim(),
        grade: typeof parsed.grade === 'string' && parsed.grade.trim() ? parsed.grade.trim() : 'Semua Kelas',
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

export default function SubjectsManagementPage() {
  const [levels, setLevels] = useState<LevelRow[]>(() => getCachedData<LevelRow[]>('teacher:levels') ?? []);
  const [questions, setQuestions] = useState<QuestionRow[]>(() => getCachedData<QuestionRow[]>('teacher:questions') ?? []);
  const [teachers, setTeachers] = useState<TeacherOption[]>(() => getCachedData<TeacherOption[]>('teacher:teachers') ?? []);
  const [isAdmin, setIsAdmin] = useState<boolean>(() => Boolean(getCachedData<boolean>('teacher:isAdmin')));
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [selectedTeacherFilter, setSelectedTeacherFilter] = useState<string>('all');
  const [loading, setLoading] = useState(() => getCachedData<LevelRow[]>('teacher:levels') === null);

  const [newSubject, setNewSubject] = useState({ subjectName: '', grade: '', firstObjective: '', teacherId: '' });
  const [selectedSubjectKey, setSelectedSubjectKey] = useState<string>('');
  const [selectedLevelId, setSelectedLevelId] = useState<string>('');

  const [editingSubjectGroup, setEditingSubjectGroup] = useState<SubjectGroup | null>(null);
  const [editSubjectForm, setEditSubjectForm] = useState({ subjectName: '', grade: '', teacherId: '' });
  const [savingSubjectEdit, setSavingSubjectEdit] = useState(false);

  const [newObjectiveName, setNewObjectiveName] = useState('');
  const [newObjectiveDesc, setNewObjectiveDesc] = useState('');
  const [editingObjectiveId, setEditingObjectiveId] = useState<string | null>(null);
  const [editObjectiveForm, setEditObjectiveForm] = useState({ objectiveName: '', description: '' });

  const [qForm, setQForm] = useState({
    content: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    optionE: '',
    correctAnswer: 'A' as 'A' | 'B' | 'C' | 'D' | 'E',
    points: 10,
    explanation: '',
  });
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState(DUMMY_CSV_TEMPLATE);
  const [importing, setImporting] = useState(false);

  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/levels?withQuestions=1');
      if (res.ok) {
        const data = await res.json();
        const lv = data.levels ?? [];
        const qs = data.questions ?? [];
        const tc = Array.isArray(data.teachers) ? data.teachers : [];
        const adm = Boolean(data.isAdmin);
        const uid = typeof data.currentUserId === 'string' ? data.currentUserId : '';
        setLevels(lv);
        setQuestions(qs);
        setTeachers(tc);
        setIsAdmin(adm);
        setCurrentUserId(uid);
        setNewSubject((prev) => ({
          ...prev,
          teacherId: prev.teacherId || uid || tc[0]?.id || '',
        }));
        setCachedData('teacher:levels', lv);
        setCachedData('teacher:questions', qs);
        setCachedData('teacher:teachers', tc);
        setCachedData('teacher:isAdmin', adm);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const cachedLevels = getPersistedCache<LevelRow[]>('teacher:levels');
    const cachedQuestions = getPersistedCache<QuestionRow[]>('teacher:questions');
    const cachedTeachers = getPersistedCache<TeacherOption[]>('teacher:teachers');
    const cachedIsAdmin = getPersistedCache<boolean>('teacher:isAdmin');
    if (cachedLevels) {
      setLevels(cachedLevels);
      setLoading(false);
    }
    if (cachedQuestions) setQuestions(cachedQuestions);
    if (cachedTeachers) setTeachers(cachedTeachers);
    if (typeof cachedIsAdmin === 'boolean') setIsAdmin(cachedIsAdmin);
    load();
  }, [load]);

  const teacherMap = useMemo(() => new Map(teachers.map((t) => [t.id, t])), [teachers]);

  const subjectGroups = useMemo<SubjectGroup[]>(() => {
    const map = new Map<string, SubjectGroup>();
    const visibleLevels =
      isAdmin && selectedTeacherFilter !== 'all'
        ? levels.filter((lvl) => lvl.teacherId === selectedTeacherFilter)
        : levels;
    for (const lvl of visibleLevels) {
      const meta = parseMapMeta(lvl);
      const ownerId = lvl.teacherId || '';
      const key = `${ownerId}__${meta.subjectName}__${meta.grade}`;
      if (!map.has(key)) {
        map.set(key, {
          key,
          teacherId: ownerId,
          subjectName: meta.subjectName,
          grade: meta.grade,
          objectives: [],
        });
      }
      map.get(key)!.objectives.push({
        level: lvl,
        objectiveName: meta.objectiveName,
      });
    }
    return Array.from(map.values());
  }, [levels, isAdmin, selectedTeacherFilter]);

  useEffect(() => {
    if (subjectGroups.length === 0) {
      setSelectedSubjectKey('');
      setSelectedLevelId('');
      return;
    }
    const currentGroup = subjectGroups.find((g) => g.key === selectedSubjectKey) ?? subjectGroups[0];
    if (currentGroup.key !== selectedSubjectKey) {
      setSelectedSubjectKey(currentGroup.key);
    }
    const hasLevel = currentGroup.objectives.some((o) => o.level.id === selectedLevelId);
    if (!hasLevel) {
      setSelectedLevelId(currentGroup.objectives[0]?.level.id ?? '');
    }
  }, [subjectGroups, selectedSubjectKey, selectedLevelId]);

  const activeSubject = subjectGroups.find((g) => g.key === selectedSubjectKey) ?? null;
  const activeObjective = activeSubject?.objectives.find((o) => o.level.id === selectedLevelId) ?? null;

  const activeQuestions = useMemo(() => {
    if (!activeObjective) return [];
    const idSet = new Set(activeObjective.level.questionIds);
    return questions.filter((q) => idSet.has(q.id));
  }, [activeObjective, questions]);

  async function onCreateSubject(e: React.FormEvent) {
    e.preventDefault();
    setStatusMsg(null);
    const subjectName = newSubject.subjectName.trim();
    const grade = newSubject.grade.trim();
    const objectiveName = newSubject.firstObjective.trim() || 'Tujuan Pembelajaran 1';
    if (!subjectName || !grade) return;

    const targetTeacherId = isAdmin
      ? newSubject.teacherId || (selectedTeacherFilter !== 'all' ? selectedTeacherFilter : currentUserId)
      : currentUserId;

    const res = await fetch('/api/levels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${subjectName} (${grade}) - ${objectiveName}`,
        description: `Mapel ${subjectName} Kelas ${grade}`,
        difficulty: 'easy',
        completionRequirement: 1,
        rewardConfig: { stars: 3 },
        mapConfig: { subjectName, grade, objectiveName },
        questionIds: [],
        ...(isAdmin && targetTeacherId ? { teacherId: targetTeacherId } : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatusMsg({ type: 'err', text: data.error ?? 'Gagal menambah mapel' });
      return;
    }
    const createdOwnerId = data.level?.teacherId || targetTeacherId || '';
    setNewSubject((prev) => ({ ...prev, subjectName: '', grade: '', firstObjective: '' }));
    await load();
    setSelectedSubjectKey(`${createdOwnerId}__${subjectName}__${grade}`);
    if (data.level?.id) setSelectedLevelId(data.level.id);
    const ownerInfo = teacherMap.get(createdOwnerId);
    setStatusMsg({
      type: 'ok',
      text: `Mapel "${subjectName} (${grade})" berhasil dibuat${
        isAdmin && ownerInfo ? ` untuk guru ${ownerInfo.fullName} (@${ownerInfo.username})` : ''
      }.`,
    });
  }

  async function onCreateObjective(e: React.FormEvent) {
    e.preventDefault();
    if (!activeSubject) return;
    setStatusMsg(null);
    const objectiveName = newObjectiveName.trim();
    if (!objectiveName) return;

    const res = await fetch('/api/levels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${activeSubject.subjectName} (${activeSubject.grade}) - ${objectiveName}`,
        description: newObjectiveDesc.trim(),
        difficulty: 'easy',
        completionRequirement: 1,
        rewardConfig: { stars: 3 },
        mapConfig: {
          subjectName: activeSubject.subjectName,
          grade: activeSubject.grade,
          objectiveName,
        },
        questionIds: [],
        ...(isAdmin && activeSubject.teacherId ? { teacherId: activeSubject.teacherId } : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatusMsg({ type: 'err', text: data.error ?? 'Gagal menambah tujuan pembelajaran' });
      return;
    }
    setNewObjectiveName('');
    setNewObjectiveDesc('');
    await load();
    if (data.level?.id) setSelectedLevelId(data.level.id);
    setStatusMsg({ type: 'ok', text: `Tujuan pembelajaran "${objectiveName}" berhasil ditambahkan.` });
  }

  function startEditSubjectGroup(g: SubjectGroup) {
    setEditingSubjectGroup(g);
    setEditSubjectForm({ subjectName: g.subjectName, grade: g.grade, teacherId: g.teacherId });
  }

  async function onSaveEditSubjectGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!editingSubjectGroup) return;
    const nextSubjectName = editSubjectForm.subjectName.trim();
    const nextGrade = editSubjectForm.grade.trim();
    const nextTeacherId = isAdmin && editSubjectForm.teacherId ? editSubjectForm.teacherId : editingSubjectGroup.teacherId;
    if (!nextSubjectName || !nextGrade) return;

    setSavingSubjectEdit(true);
    setStatusMsg(null);
    try {
      await Promise.all(
        editingSubjectGroup.objectives.map((obj) =>
          fetch(`/api/levels/${obj.level.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: `${nextSubjectName} (${nextGrade}) - ${obj.objectiveName}`,
              description: obj.level.description,
              difficulty: obj.level.difficulty,
              completionRequirement: Math.max(1, obj.level.questionIds.length),
              rewardConfig: { stars: 3 },
              mapConfig: {
                subjectName: nextSubjectName,
                grade: nextGrade,
                objectiveName: obj.objectiveName,
              },
              questionIds: obj.level.questionIds,
              ...(isAdmin && nextTeacherId ? { teacherId: nextTeacherId } : {}),
            }),
          }),
        ),
      );
      setEditingSubjectGroup(null);
      await load();
      setSelectedSubjectKey(`${nextTeacherId}__${nextSubjectName}__${nextGrade}`);
      setStatusMsg({
        type: 'ok',
        text: `Mata Pelajaran & Kelas berhasil diperbarui menjadi "${nextSubjectName} (${nextGrade})".`,
      });
    } catch {
      setStatusMsg({ type: 'err', text: 'Gagal memperbarui Mata Pelajaran & Kelas' });
    } finally {
      setSavingSubjectEdit(false);
    }
  }

  async function onDeleteSubjectGroup(g: SubjectGroup) {
    if (
      !confirm(
        `Hapus Mata Pelajaran "${g.subjectName} (${g.grade})"? Seluruh ${g.objectives.length} Tujuan Pembelajaran di dalamnya akan ikut terhapus.`,
      )
    ) {
      return;
    }
    setStatusMsg(null);
    const idsToDelete = new Set(g.objectives.map((o) => o.level.id));
    const prevLevels = levels;
    setLevels((prev) => prev.filter((l) => !idsToDelete.has(l.id)));
    try {
      const results = await Promise.all(
        g.objectives.map((o) => fetch(`/api/levels/${o.level.id}`, { method: 'DELETE' })),
      );
      if (results.some((r) => !r.ok)) {
        setLevels(prevLevels);
        await load();
        setStatusMsg({ type: 'err', text: 'Sebagian tujuan pembelajaran gagal dihapus' });
        return;
      }
      await load();
      setStatusMsg({ type: 'ok', text: `Mata Pelajaran "${g.subjectName} (${g.grade})" berhasil dihapus.` });
    } catch {
      setLevels(prevLevels);
      setStatusMsg({ type: 'err', text: 'Gagal menghapus Mata Pelajaran & Kelas' });
    }
  }

  function startEditObjective(obj: { level: LevelRow; objectiveName: string }) {
    setEditingObjectiveId(obj.level.id);
    setEditObjectiveForm({
      objectiveName: obj.objectiveName,
      description: obj.level.description || '',
    });
  }

  async function onSaveEditObjective(e: React.FormEvent) {
    e.preventDefault();
    if (!editingObjectiveId || !activeSubject) return;
    const targetObj = activeSubject.objectives.find((o) => o.level.id === editingObjectiveId);
    if (!targetObj) return;
    const nextObjectiveName = editObjectiveForm.objectiveName.trim();
    if (!nextObjectiveName) return;

    setStatusMsg(null);
    const res = await fetch(`/api/levels/${targetObj.level.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${activeSubject.subjectName} (${activeSubject.grade}) - ${nextObjectiveName}`,
        description: editObjectiveForm.description.trim(),
        difficulty: targetObj.level.difficulty,
        completionRequirement: Math.max(1, targetObj.level.questionIds.length),
        rewardConfig: { stars: 3 },
        mapConfig: {
          subjectName: activeSubject.subjectName,
          grade: activeSubject.grade,
          objectiveName: nextObjectiveName,
        },
        questionIds: targetObj.level.questionIds,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setStatusMsg({ type: 'err', text: data.error ?? 'Gagal memperbarui tujuan pembelajaran' });
      return;
    }
    setEditingObjectiveId(null);
    await load();
    setStatusMsg({ type: 'ok', text: `Tujuan pembelajaran "${nextObjectiveName}" berhasil diperbarui.` });
  }

  async function onDeleteObjective(levelId: string, label: string) {
    if (!confirm(`Hapus tujuan pembelajaran "${label}"?`)) return;
    const prevLevels = levels;
    setLevels((prev) => prev.filter((l) => l.id !== levelId));
    const res = await fetch(`/api/levels/${levelId}`, { method: 'DELETE' });
    if (!res.ok) {
      setLevels(prevLevels);
    }
  }

  async function onSaveQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!activeSubject || !activeObjective) return;
    setStatusMsg(null);

    const payload = {
      type: 'multiple_choice',
      content: qForm.content.trim(),
      imageUrl: '',
      correctAnswer: qForm.correctAnswer,
      explanation: qForm.explanation.trim(),
      difficulty: 'easy',
      category: `${activeSubject.subjectName} - ${activeObjective.objectiveName}`.slice(0, 60),
      points: Number(qForm.points) || 10,
      timeLimit: 30,
      options: [
        { label: 'A', content: qForm.optionA.trim() },
        { label: 'B', content: qForm.optionB.trim() },
        { label: 'C', content: qForm.optionC.trim() },
        { label: 'D', content: qForm.optionD.trim() },
        { label: 'E', content: qForm.optionE.trim() },
      ],
      ...(!editingQuestionId && isAdmin && activeSubject.teacherId ? { teacherId: activeSubject.teacherId } : {}),
    };

    const res = await fetch(editingQuestionId ? `/api/questions/${editingQuestionId}` : '/api/questions', {
      method: editingQuestionId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatusMsg({ type: 'err', text: data.error ?? 'Gagal menyimpan soal' });
      return;
    }

    if (!editingQuestionId && data.question?.id) {
      const nextIds = [...activeObjective.level.questionIds, data.question.id];
      const meta = parseMapMeta(activeObjective.level);
      await fetch(`/api/levels/${activeObjective.level.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: activeObjective.level.name,
          description: activeObjective.level.description,
          difficulty: activeObjective.level.difficulty,
          completionRequirement: Math.max(1, nextIds.length),
          rewardConfig: { stars: 3 },
          mapConfig: meta,
          questionIds: nextIds,
        }),
      });
    }

    setQForm({
      content: '',
      optionA: '',
      optionB: '',
      optionC: '',
      optionD: '',
      optionE: '',
      correctAnswer: 'A',
      points: 10,
      explanation: '',
    });
    setEditingQuestionId(null);
    await load();
    setStatusMsg({ type: 'ok', text: editingQuestionId ? 'Soal berhasil diperbarui.' : 'Soal berhasil ditambahkan.' });
  }

  async function onDeleteQuestion(qId: string) {
    if (!activeObjective) return;
    if (!confirm('Hapus soal ini dari tujuan pembelajaran?')) return;
    const targetLevelId = activeObjective.level.id;
    const prevQuestions = questions;
    const prevLevels = levels;
    setQuestions((prev) => prev.filter((q) => q.id !== qId));
    setLevels((prev) =>
      prev.map((l) =>
        l.id === targetLevelId ? { ...l, questionIds: l.questionIds.filter((id) => id !== qId) } : l,
      ),
    );
    const res = await fetch(`/api/questions/${qId}`, { method: 'DELETE' });
    if (!res.ok) {
      setQuestions(prevQuestions);
      setLevels(prevLevels);
    }
  }

  function downloadTemplateCsv() {
    const blob = new Blob([DUMMY_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_import_soal_llyssmart.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  function onUploadCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setImportText(reader.result);
      }
    };
    reader.readAsText(file);
  }

  async function onRunImport(e: React.FormEvent) {
    e.preventDefault();
    if (!activeSubject || !activeObjective) return;
    setStatusMsg(null);

    const lines = importText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setStatusMsg({ type: 'err', text: 'Data import kosong' });
      return;
    }

    const items: {
      content: string;
      optionA: string;
      optionB: string;
      optionC: string;
      optionD: string;
      optionE: string;
      correctAnswer: 'A' | 'B' | 'C' | 'D' | 'E';
      points: number;
      explanation: string;
    }[] = [];

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (i === 0 && /^pertanyaan[;|,\t]/i.test(line)) continue;
      const delimiter = line.includes(';') ? ';' : line.includes('\t') ? '\t' : ',';
      const cols = line.split(delimiter).map((c) => c.trim());
      if (cols.length < 7) {
        setStatusMsg({
          type: 'err',
          text: `Baris ke-${i + 1} tidak lengkap (minimal 7 kolom: Pertanyaan;Opsi A;Opsi B;Opsi C;Opsi D;Opsi E;Kunci)`,
        });
        return;
      }
      const key = cols[6].toUpperCase();
      if (!['A', 'B', 'C', 'D', 'E'].includes(key)) {
        setStatusMsg({
          type: 'err',
          text: `Baris ke-${i + 1}: Kunci jawaban harus A, B, C, D, atau E (ditemukan "${cols[6]}")`,
        });
        return;
      }
      items.push({
        content: cols[0],
        optionA: cols[1],
        optionB: cols[2],
        optionC: cols[3],
        optionD: cols[4],
        optionE: cols[5],
        correctAnswer: key as 'A' | 'B' | 'C' | 'D' | 'E',
        points: Number(cols[7]) > 0 ? Number(cols[7]) : 10,
        explanation: cols[8] ?? '',
      });
    }

    if (items.length === 0) {
      setStatusMsg({ type: 'err', text: 'Tidak ada baris soal valid untuk di-import.' });
      return;
    }

    setImporting(true);
    try {
      const res = await fetch('/api/questions/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          levelId: activeObjective.level.id,
          category: `${activeSubject.subjectName} - ${activeObjective.objectiveName}`.slice(0, 60),
          items,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusMsg({ type: 'err', text: data.error ?? 'Gagal import soal' });
        return;
      }
      setImportOpen(false);
      await load();
      setStatusMsg({ type: 'ok', text: `Berhasil meng-import ${data.importedCount} soal ke "${activeObjective.objectiveName}".` });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold sm:text-3xl">Manajemen Mapel &amp; Soal</h1>
          <p className="mt-1 text-sm text-[var(--wood-text)]/70">
            Kelola Mata Pelajaran beserta Kelas, tambahkan Tujuan Pembelajaran (Kategori Soal), lalu input atau import soal beserta kunci jawabannya.
          </p>
        </div>
        {isAdmin && (
          <div className="w-full sm:w-72">
            <label className="label-field">Filter / Target Guru Pengampu</label>
            <select
              className="input-field font-semibold"
              value={selectedTeacherFilter}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedTeacherFilter(val);
                if (val !== 'all') {
                  setNewSubject((prev) => ({ ...prev, teacherId: val }));
                }
              }}
            >
              <option value="all">Semua Guru ({teachers.length} akun)</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.fullName} (@{t.username}){t.role === 'admin' ? ' — Admin' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {statusMsg && (
        <div
          role="status"
          className={`rounded-xl px-4 py-3 text-sm font-semibold ${
            statusMsg.type === 'ok' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-700'
          }`}
        >
          {statusMsg.text}
        </div>
      )}

      {/* STEP 1: Tambah / Pilih Mapel */}
      <section className="card-panel space-y-4">
        <div className="border-b border-black/10 pb-3">
          <h2 className="font-display text-lg font-bold">1. Mata Pelajaran &amp; Kelas</h2>
        </div>

        <form
          onSubmit={onCreateSubject}
          className={`grid gap-3.5 sm:grid-cols-2 ${isAdmin ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}
        >
          {isAdmin && (
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="label-field">Guru Pengampu</label>
              <select
                className="input-field"
                required
                value={newSubject.teacherId}
                onChange={(e) => setNewSubject({ ...newSubject, teacherId: e.target.value })}
              >
                <option value="">Pilih guru...</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.fullName} (@{t.username})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="label-field">Nama Mata Pelajaran</label>
            <input
              className="input-field"
              required
              placeholder="Contoh: Informatika"
              value={newSubject.subjectName}
              onChange={(e) => setNewSubject({ ...newSubject, subjectName: e.target.value })}
            />
          </div>
          <div>
            <label className="label-field">Kelas / Tingkat</label>
            <input
              className="input-field"
              required
              placeholder="Contoh: Kelas X"
              value={newSubject.grade}
              onChange={(e) => setNewSubject({ ...newSubject, grade: e.target.value })}
            />
          </div>
          <div>
            <label className="label-field">Tujuan Pembelajaran Pertama</label>
            <input
              className="input-field"
              required
              placeholder="Contoh: Rumus Dasar Excel"
              value={newSubject.firstObjective}
              onChange={(e) => setNewSubject({ ...newSubject, firstObjective: e.target.value })}
            />
          </div>
          <div className="flex items-end">
            <button type="submit" className="btn-primary w-full">
              + Tambah Mapel
            </button>
          </div>
        </form>

        {loading ? (
          <DashboardLoader label="Memuat daftar mata pelajaran & soal..." compact />
        ) : subjectGroups.length === 0 ? (
          <p className="py-4 text-sm text-[var(--wood-text)]/60">
            Belum ada mata pelajaran. Tambahkan mapel baru pada form di atas.
          </p>
        ) : (
          <div className="grid gap-3 pt-1 sm:grid-cols-2 lg:grid-cols-3">
            {subjectGroups.map((g) => {
              const active = g.key === selectedSubjectKey;
              const owner = teacherMap.get(g.teacherId);
              return (
                <div
                  key={g.key}
                  onClick={() => {
                    setSelectedSubjectKey(g.key);
                    setSelectedLevelId(g.objectives[0]?.level.id ?? '');
                  }}
                  className={`flex cursor-pointer items-start justify-between gap-3 rounded-xl border p-3.5 text-left transition ${
                    active
                      ? 'border-[var(--navy-panel)] bg-[var(--navy-panel)] text-white shadow-sm'
                      : 'border-[#e2cfb0] bg-white text-[var(--wood-text)] hover:border-[var(--navy-panel)]/40'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="truncate font-display text-base font-bold">{g.subjectName}</div>
                    <div className={`mt-0.5 text-xs ${active ? 'text-white/80' : 'text-[var(--wood-text)]/70'}`}>
                      {g.grade} · {g.objectives.length} Tujuan Pembelajaran
                    </div>
                    {isAdmin && owner && (
                      <div
                        className={`mt-1 truncate text-xs font-semibold ${
                          active ? 'text-[var(--yellow-accent)]' : 'text-[var(--wood-dark)]'
                        }`}
                      >
                        Guru: {owner.fullName} (@{owner.username})
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      title={`Edit ${g.subjectName} (${g.grade})`}
                      onClick={() => startEditSubjectGroup(g)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                        active
                          ? 'bg-white/15 text-white hover:bg-white/25'
                          : 'bg-[var(--cream-soft)] text-[var(--wood-text)] hover:bg-black/10'
                      }`}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      title={`Hapus ${g.subjectName} (${g.grade})`}
                      onClick={() => onDeleteSubjectGroup(g)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                        active
                          ? 'bg-red-500/85 text-white hover:bg-red-500'
                          : 'bg-red-100 text-red-700 hover:bg-red-200'
                      }`}
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {editingSubjectGroup && (
          <form
            onSubmit={onSaveEditSubjectGroup}
            className="mt-3 space-y-3 rounded-xl border border-[#dcc8a6] bg-[var(--cream-bg)] p-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold">
                Edit Mata Pelajaran &amp; Kelas: {editingSubjectGroup.subjectName} ({editingSubjectGroup.grade})
              </h3>
              <button
                type="button"
                className="rounded-lg bg-black/10 px-2.5 py-1 text-xs font-bold"
                onClick={() => setEditingSubjectGroup(null)}
              >
                ✕
              </button>
            </div>
            <div className={`grid gap-3 sm:grid-cols-2 ${isAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
              {isAdmin && (
                <div>
                  <label className="label-field">Guru Pengampu</label>
                  <select
                    className="input-field"
                    required
                    value={editSubjectForm.teacherId}
                    onChange={(e) => setEditSubjectForm({ ...editSubjectForm, teacherId: e.target.value })}
                  >
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.fullName} (@{t.username})
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="label-field">Nama Mata Pelajaran</label>
                <input
                  className="input-field"
                  required
                  value={editSubjectForm.subjectName}
                  onChange={(e) => setEditSubjectForm({ ...editSubjectForm, subjectName: e.target.value })}
                />
              </div>
              <div>
                <label className="label-field">Kelas / Tingkat</label>
                <input
                  className="input-field"
                  required
                  value={editSubjectForm.grade}
                  onChange={(e) => setEditSubjectForm({ ...editSubjectForm, grade: e.target.value })}
                />
              </div>
              <div className="flex items-end gap-2">
                <button
                  type="submit"
                  disabled={savingSubjectEdit}
                  className="btn-primary flex-1"
                >
                  {savingSubjectEdit ? 'Menyimpan...' : 'Simpan'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEditingSubjectGroup(null)}
                >
                  Batal
                </button>
              </div>
            </div>
          </form>
        )}
      </section>

      {/* STEP 2: Tujuan Pembelajaran di dalam Mapel terpilih */}
      {activeSubject && (
        <section className="card-panel space-y-4">
          <div className="border-b border-black/10 pb-3">
            <h2 className="font-display text-lg font-bold">
              2. Tujuan Pembelajaran / Kategori Soal ({activeSubject.subjectName} - {activeSubject.grade})
            </h2>
            <p className="mt-0.5 text-xs text-[var(--wood-text)]/70">
              {isAdmin && teacherMap.get(activeSubject.teacherId) ? (
                <>
                  Guru Pengampu:{' '}
                  <strong>
                    {teacherMap.get(activeSubject.teacherId)?.fullName} (@
                    {teacherMap.get(activeSubject.teacherId)?.username})
                  </strong>{' '}
                  ·{' '}
                </>
              ) : null}
              Satu mata pelajaran dapat memiliki banyak tujuan pembelajaran. Pilih salah satu untuk mengelola soalnya.
            </p>
          </div>

          <form onSubmit={onCreateObjective} className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="label-field">Nama Tujuan Pembelajaran / Kategori</label>
              <input
                className="input-field"
                required
                placeholder="Contoh: Fungsi Logika IF & VLOOKUP"
                value={newObjectiveName}
                onChange={(e) => setNewObjectiveName(e.target.value)}
              />
            </div>
            <div>
              <label className="label-field">Keterangan (Opsional)</label>
              <input
                className="input-field"
                placeholder="Contoh: KD 3.2 Pengolahan Data"
                value={newObjectiveDesc}
                onChange={(e) => setNewObjectiveDesc(e.target.value)}
              />
            </div>
            <div className="flex items-end sm:col-span-2 lg:col-span-1">
              <button type="submit" className="btn-secondary w-full">
                + Tambah Tujuan Pembelajaran
              </button>
            </div>
          </form>

          {editingObjectiveId && (
            <form
              onSubmit={onSaveEditObjective}
              className="grid gap-3 rounded-xl border border-[#dcc8a6] bg-[var(--cream-bg)] p-4 sm:grid-cols-2 lg:grid-cols-3"
            >
              <div>
                <label className="label-field">Edit Nama Tujuan Pembelajaran</label>
                <input
                  className="input-field"
                  required
                  value={editObjectiveForm.objectiveName}
                  onChange={(e) =>
                    setEditObjectiveForm({ ...editObjectiveForm, objectiveName: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="label-field">Edit Keterangan</label>
                <input
                  className="input-field"
                  value={editObjectiveForm.description}
                  onChange={(e) =>
                    setEditObjectiveForm({ ...editObjectiveForm, description: e.target.value })
                  }
                />
              </div>
              <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
                <button type="submit" className="btn-primary flex-1">
                  Simpan Perubahan
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setEditingObjectiveId(null)}
                >
                  Batal
                </button>
              </div>
            </form>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {activeSubject.objectives.map((obj) => {
              const isSelected = obj.level.id === selectedLevelId;
              return (
                <div
                  key={obj.level.id}
                  onClick={() => setSelectedLevelId(obj.level.id)}
                  className={`cursor-pointer rounded-xl border p-3.5 transition ${
                    isSelected
                      ? 'border-[var(--orange-primary)] bg-[#fff7e8] ring-1 ring-[var(--orange-primary)]/40'
                      : 'border-[#e2cfb0] bg-white hover:border-[var(--navy-panel)]/35'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <span className="inline-block rounded-md bg-[var(--yellow-accent)] px-2 py-0.5 text-xs font-bold text-[var(--wood-dark)]">
                        {obj.level.questionIds.length} Soal
                      </span>
                      <h3 className="mt-1.5 truncate font-display text-base font-bold">{obj.objectiveName}</h3>
                      {obj.level.description && (
                        <p className="mt-0.5 text-xs text-[var(--wood-text)]/70">{obj.level.description}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="rounded-lg bg-[var(--cream-soft)] px-2.5 py-1 text-xs font-bold hover:bg-black/10"
                        onClick={() => startEditObjective(obj)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="rounded-lg bg-red-100 px-2.5 py-1 text-xs font-bold text-red-700 hover:bg-red-200"
                        onClick={() => onDeleteObjective(obj.level.id, obj.objectiveName)}
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* STEP 3: Kelola & Import Soal di Tujuan Pembelajaran Terpilih */}
      {activeSubject && activeObjective && (
        <section className="card-panel space-y-5">
          <div className="flex flex-col gap-3 border-b border-black/10 pb-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-display text-lg font-bold">
                3. Daftar Soal: {activeObjective.objectiveName}
              </h2>
              <p className="mt-0.5 text-xs text-[var(--wood-text)]/70">
                Jumlah soal di sini ({activeQuestions.length} soal) menentukan jumlah kotak tanda tanya (?) di map game.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn-secondary"
                onClick={downloadTemplateCsv}
              >
                Unduh Template CSV
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setImportOpen((v) => !v)}
              >
                {importOpen ? 'Tutup Import Soal' : 'Import Soal CSV'}
              </button>
            </div>
          </div>

          {importOpen && (
            <form onSubmit={onRunImport} className="space-y-3 rounded-xl border border-[#dcc8a6] bg-[var(--cream-bg)] p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-display text-base font-bold">Import Soal &amp; Kunci Jawaban (Opsi A–E)</h3>
                  <p className="mt-0.5 text-xs text-[var(--wood-text)]/75">
                    Format tiap baris: <code className="rounded bg-black/10 px-1.5 py-0.5 font-mono">Pertanyaan;Opsi A;Opsi B;Opsi C;Opsi D;Opsi E;Kunci;Poin;Pembahasan</code>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="cursor-pointer rounded-lg bg-[var(--navy-panel)] px-3 py-1.5 text-xs font-bold text-white hover:bg-[var(--navy-deep)]">
                    Pilih File CSV / TXT
                    <input type="file" accept=".csv,.txt" className="hidden" onChange={onUploadCsvFile} />
                  </label>
                  <button
                    type="button"
                    className="rounded-lg bg-black/10 px-3 py-1.5 text-xs font-bold hover:bg-black/15"
                    onClick={() => setImportText(DUMMY_CSV_TEMPLATE)}
                  >
                    Isi Contoh Dummy
                  </button>
                </div>
              </div>

              <textarea
                className="input-field font-mono text-xs"
                rows={6}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Tempel data soal dengan pemisah titik koma (;) di sini..."
              />

              <div className="flex justify-end gap-2">
                <button type="button" className="btn-secondary" onClick={() => setImportOpen(false)}>
                  Batal
                </button>
                <button type="submit" className="btn-success" disabled={importing}>
                  {importing ? 'Mengimport...' : 'Proses Import Soal'}
                </button>
              </div>
            </form>
          )}

          {/* Form Tambah Soal Manual */}
          <form onSubmit={onSaveQuestion} className="space-y-3.5 rounded-xl border border-[#e2cfb0] bg-[var(--cream-bg)]/45 p-4">
            <h3 className="font-display text-base font-bold">
              {editingQuestionId ? 'Edit Soal' : 'Tambah Soal Manual'}
            </h3>
            <div>
              <label className="label-field">Pertanyaan</label>
              <textarea
                className="input-field"
                required
                rows={2}
                value={qForm.content}
                onChange={(e) => setQForm({ ...qForm, content: e.target.value })}
                placeholder="Tulis pertanyaan pilihan ganda..."
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              {(['A', 'B', 'C', 'D', 'E'] as const).map((lbl) => {
                const fieldKey = `option${lbl}` as 'optionA' | 'optionB' | 'optionC' | 'optionD' | 'optionE';
                return (
                  <div key={lbl} className={`flex items-center gap-2${lbl === 'E' ? ' md:col-span-2' : ''}`}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--navy-panel)] font-display text-sm font-bold text-white">
                      {lbl}
                    </span>
                    <input
                      className="input-field"
                      required
                      value={qForm[fieldKey]}
                      onChange={(e) => setQForm({ ...qForm, [fieldKey]: e.target.value })}
                      placeholder={`Pilihan ${lbl}`}
                    />
                    <label className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg bg-[var(--cream-soft)] px-2.5 py-2 text-xs font-bold">
                      <input
                        type="radio"
                        name="correctAnswer"
                        checked={qForm.correctAnswer === lbl}
                        onChange={() => setQForm({ ...qForm, correctAnswer: lbl })}
                      />
                      Kunci
                    </label>
                  </div>
                );
              })}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="label-field">Poin</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  className="input-field"
                  value={qForm.points}
                  onChange={(e) => setQForm({ ...qForm, points: Number(e.target.value) })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label-field">Pembahasan Singkat (Opsional)</label>
                <input
                  className="input-field"
                  value={qForm.explanation}
                  onChange={(e) => setQForm({ ...qForm, explanation: e.target.value })}
                  placeholder="Penjelasan jawaban benar"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              <button type="submit" className="btn-primary">
                {editingQuestionId ? 'Simpan Perubahan Soal' : '+ Tambah Soal'}
              </button>
              {editingQuestionId && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setEditingQuestionId(null);
                    setQForm({
                      content: '',
                      optionA: '',
                      optionB: '',
                      optionC: '',
                      optionD: '',
                      optionE: '',
                      correctAnswer: 'A',
                      points: 10,
                      explanation: '',
                    });
                  }}
                >
                  Batal
                </button>
              )}
            </div>
          </form>

          {/* Daftar Soal */}
          {activeQuestions.length === 0 ? (
            <p className="py-4 text-center text-sm text-[var(--wood-text)]/60">
              Belum ada soal di tujuan pembelajaran ini. Tambahkan manual atau gunakan tombol <strong>Import Soal CSV</strong>.
            </p>
          ) : (
            <div className="space-y-2.5">
              {activeQuestions.map((q, idx) => (
                <div
                  key={q.id}
                  className="flex flex-col gap-3 rounded-xl border border-[#e2cfb0] bg-white p-3.5 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="rounded-md bg-[var(--navy-panel)] px-2 py-0.5 font-bold text-white">
                        Kotak #{idx + 1}
                      </span>
                      <span className="rounded-md bg-green-100 px-2 py-0.5 font-bold text-green-800">
                        Kunci: {q.correctAnswer}
                      </span>
                      <span className="rounded-md bg-[var(--cream-soft)] px-2 py-0.5 font-semibold">
                        +{q.points} Poin
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm font-bold">{q.content}</p>
                    {q.options.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs text-[var(--wood-text)]/80">
                        {q.options.map((o) => (
                          <span
                            key={o.label}
                            className={`rounded-md px-2 py-0.5 ${
                              o.label === q.correctAnswer ? 'bg-green-100 font-bold text-green-900' : 'bg-black/5'
                            }`}
                          >
                            {o.label}. {o.content}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      className="rounded-lg bg-[var(--cream-soft)] px-2.5 py-1.5 text-xs font-bold hover:bg-black/10"
                      onClick={() => {
                        setEditingQuestionId(q.id);
                        const getOpt = (l: string) => q.options.find((o) => o.label === l)?.content ?? '';
                        setQForm({
                          content: q.content,
                          optionA: getOpt('A'),
                          optionB: getOpt('B'),
                          optionC: getOpt('C'),
                          optionD: getOpt('D'),
                          optionE: getOpt('E'),
                          correctAnswer: (q.correctAnswer as 'A' | 'B' | 'C' | 'D' | 'E') || 'A',
                          points: q.points,
                          explanation: q.explanation,
                        });
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="rounded-lg bg-red-100 px-2.5 py-1.5 text-xs font-bold text-red-700 hover:bg-red-200"
                      onClick={() => onDeleteQuestion(q.id)}
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
