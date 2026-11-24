import { and, eq, like, desc, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { questionCollections, questionOptions, questions } from '@/db/schema';
import { generateId } from '@/server/auth/crypto';
import type { QuestionInput } from '@/server/middleware/validation';

export class QuestionError extends Error {
  constructor(
    message: string,
    public status: number = 400,
  ) {
    super(message);
  }
}

export async function createQuestion(creatorId: string, input: QuestionInput) {
  const id = generateId('qst');
  await db.insert(questions).values({
    id,
    creatorId,
    type: input.type,
    content: input.content,
    imageUrl: input.imageUrl || null,
    correctAnswer: input.correctAnswer,
    explanation: input.explanation,
    difficulty: input.difficulty,
    category: input.category,
    points: input.points,
    timeLimit: input.timeLimit,
  });

  if (input.options.length > 0) {
    await db.insert(questionOptions).values(
      input.options.map((opt, i) => ({
        id: generateId('opt'),
        questionId: id,
        label: opt.label,
        content: opt.content,
        position: i,
      })),
    );
  }
  return getQuestion(id, creatorId);
}

export type QuestionUpdateInput = Partial<QuestionInput>;

function mergeUpdate(current: Awaited<ReturnType<typeof getQuestion>>, input: QuestionUpdateInput): QuestionInput {
  return {
    type: input.type ?? current.type,
    content: input.content ?? current.content,
    imageUrl: input.imageUrl ?? current.imageUrl ?? '',
    correctAnswer: input.correctAnswer ?? current.correctAnswer,
    explanation: input.explanation ?? current.explanation ?? '',
    difficulty: input.difficulty ?? current.difficulty,
    category: input.category ?? current.category,
    points: input.points ?? current.points,
    timeLimit: input.timeLimit ?? current.timeLimit,
    options: input.options && input.options.length > 0
      ? input.options
      : current.options.map((o) => ({ label: o.label, content: o.content })),
  };
}

export async function updateQuestion(id: string, teacherId: string, input: QuestionUpdateInput) {
  const current = await getQuestion(id, teacherId);
  const merged = mergeUpdate(current, input);
  if (merged.type === 'multiple_choice') {
    if (merged.options.length < 2) {
      throw new QuestionError('Pilihan ganda minimal 2 opsi', 422);
    }
    if (!merged.options.some((o) => o.label === merged.correctAnswer)) {
      throw new QuestionError('Jawaban benar harus salah satu dari opsi A-E', 422);
    }
  }
  await db
    .update(questions)
    .set({
      type: merged.type,
      content: merged.content,
      imageUrl: merged.imageUrl || null,
      correctAnswer: merged.correctAnswer,
      explanation: merged.explanation,
      difficulty: merged.difficulty,
      category: merged.category,
      points: merged.points,
      timeLimit: merged.timeLimit,
      updatedAt: new Date(),
    })
    .where(eq(questions.id, id));

  await db.delete(questionOptions).where(eq(questionOptions.questionId, id));
  if (merged.options.length > 0) {
    await db.insert(questionOptions).values(
      merged.options.map((opt, i) => ({
        id: generateId('opt'),
        questionId: id,
        label: opt.label,
        content: opt.content,
        position: i,
      })),
    );
  }
  return getQuestion(id, teacherId);
}

export async function deleteQuestion(id: string, teacherId: string) {
  await getQuestion(id, teacherId);
  await db.delete(questions).where(eq(questions.id, id));
}

export async function getQuestion(id: string, teacherId: string) {
  const rows = await db
    .select()
    .from(questions)
    .where(and(eq(questions.id, id), eq(questions.creatorId, teacherId)))
    .limit(1);
  if (!rows[0]) throw new QuestionError('Soal tidak ditemukan', 404);

  const options = await db
    .select()
    .from(questionOptions)
    .where(eq(questionOptions.questionId, id));

  return { ...rows[0], options };
}

export async function listQuestions(
  teacherId: string,
  filters: { search?: string; category?: string; difficulty?: string },
) {
  const conditions = [eq(questions.creatorId, teacherId)];
  if (filters.search) {
    conditions.push(like(questions.content, `%${filters.search}%`));
  }
  if (filters.category) {
    conditions.push(eq(questions.category, filters.category));
  }
  if (filters.difficulty) {
    conditions.push(
      sql`questions.difficulty = ${filters.difficulty}` as unknown as ReturnType<typeof eq>,
    );
  }

  const rows = await db
    .select()
    .from(questions)
    .where(and(...conditions))
    .orderBy(desc(questions.createdAt));

  if (rows.length === 0) return [];
  const options = await db
    .select()
    .from(questionOptions)
    .where(
      inArray(
        questionOptions.questionId,
        rows.map((r) => r.id),
      ),
    );

  return rows.map((q) => ({
    ...q,
    options: options.filter((o) => o.questionId === q.id),
  }));
}

export async function createCollection(teacherId: string, name: string, description: string) {
  const id = generateId('col');
  await db.insert(questionCollections).values({ id, teacherId, name, description });
  const rows = await db
    .select()
    .from(questionCollections)
    .where(eq(questionCollections.id, id))
    .limit(1);
  return rows[0];
}

export async function listCollections(teacherId: string) {
  return db
    .select()
    .from(questionCollections)
    .where(eq(questionCollections.teacherId, teacherId))
    .orderBy(desc(questionCollections.createdAt));
}

export async function listCategories(teacherId: string) {
  const rows = await db
    .selectDistinct({ category: questions.category })
    .from(questions)
    .where(eq(questions.creatorId, teacherId));
  return rows.map((r) => r.category);
}

export function stripCorrectAnswer<T extends { correctAnswer: string }>(q: T) {
  const { correctAnswer: _omit, ...rest } = q;
  void _omit;
  return rest;
}
