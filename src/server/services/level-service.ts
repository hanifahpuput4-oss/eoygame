import { and, eq, asc, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { levelQuestions, levels } from '@/db/schema';
import { generateId } from '@/server/auth/crypto';
import type { LevelInput } from '@/server/middleware/validation';

export class LevelError extends Error {
  constructor(
    message: string,
    public status: number = 400,
  ) {
    super(message);
  }
}

export async function createLevel(teacherId: string, input: LevelInput & { mapConfig?: Record<string, unknown> }) {
  const id = generateId('lvl');
  await db.insert(levels).values({
    id,
    teacherId,
    name: input.name,
    description: input.description,
    difficulty: input.difficulty,
    mapConfig: JSON.stringify(input.mapConfig ?? {}),
    rewardConfig: JSON.stringify(input.rewardConfig),
    completionRequirement: input.completionRequirement,
    position: 0,
  });
  await setLevelQuestions(id, input.questionIds);
  return getLevel(id, teacherId);
}

export async function updateLevel(id: string, teacherId: string, input: LevelInput & { mapConfig?: Record<string, unknown> }) {
  const current = await getLevel(id, teacherId);
  await db
    .update(levels)
    .set({
      name: input.name,
      description: input.description,
      difficulty: input.difficulty,
      mapConfig: input.mapConfig ? JSON.stringify(input.mapConfig) : current.mapConfig,
      rewardConfig: JSON.stringify(input.rewardConfig),
      completionRequirement: input.completionRequirement,
      updatedAt: new Date(),
    })
    .where(eq(levels.id, id));
  await setLevelQuestions(id, input.questionIds);
  return getLevel(id, teacherId);
}

export async function deleteLevel(id: string, teacherId: string) {
  await getLevel(id, teacherId);
  await db.delete(levels).where(eq(levels.id, id));
}

async function setLevelQuestions(levelId: string, questionIds: string[]) {
  await db.delete(levelQuestions).where(eq(levelQuestions.levelId, levelId));
  if (questionIds.length === 0) return;
  await db.insert(levelQuestions).values(
    questionIds.map((qid, i) => ({
      id: generateId('lq'),
      levelId,
      questionId: qid,
      position: i,
    })),
  );
}

export async function getLevel(id: string, teacherId: string) {
  const rows = await db
    .select()
    .from(levels)
    .where(and(eq(levels.id, id), eq(levels.teacherId, teacherId)))
    .limit(1);
  if (!rows[0]) throw new Error('Level tidak ditemukan');
  const links = await db
    .select({ questionId: levelQuestions.questionId })
    .from(levelQuestions)
    .where(eq(levelQuestions.levelId, id))
    .orderBy(asc(levelQuestions.position));
  return { ...rows[0], questionIds: links.map((l) => l.questionId) };
}

export async function listLevels(teacherId: string) {
  const rows = await db
    .select()
    .from(levels)
    .where(eq(levels.teacherId, teacherId))
    .orderBy(asc(levels.position), asc(levels.createdAt));
  if (rows.length === 0) return [];
  const links = await db
    .select()
    .from(levelQuestions)
    .where(
      inArray(
        levelQuestions.levelId,
        rows.map((r) => r.id),
      ),
    )
    .orderBy(asc(levelQuestions.position));
  return rows.map((lvl) => ({
    ...lvl,
    questionIds: links.filter((l) => l.levelId === lvl.id).map((l) => l.questionId),
  }));
}
