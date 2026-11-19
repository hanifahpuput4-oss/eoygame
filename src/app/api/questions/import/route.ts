import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/server/auth/session';
import { createQuestion } from '@/server/services/question-service';
import { getLevel, updateLevel } from '@/server/services/level-service';
import { ok, handleError } from '@/server/middleware/http';

const importItemSchema = z.object({
  content: z.string().min(3, 'Pertanyaan minimal 3 karakter').max(500),
  optionA: z.string().min(1, 'Opsi A wajib diisi').max(200),
  optionB: z.string().min(1, 'Opsi B wajib diisi').max(200),
  optionC: z.string().min(1, 'Opsi C wajib diisi').max(200),
  optionD: z.string().min(1, 'Opsi D wajib diisi').max(200),
  correctAnswer: z.enum(['A', 'B', 'C', 'D']),
  points: z.number().int().min(1).max(100).default(10),
  explanation: z.string().max(500).default(''),
});

const bulkSchema = z.object({
  levelId: z.string().min(1),
  category: z.string().min(1).max(60),
  items: z.array(importItemSchema).min(1).max(100),
});

export async function POST(req: NextRequest) {
  try {
    const teacher = await requireRole('teacher');
    const body = bulkSchema.parse(await req.json());
    const level = await getLevel(body.levelId, teacher.id);

    const createdIds: string[] = [];
    for (const item of body.items) {
      const q = await createQuestion(teacher.id, {
        type: 'multiple_choice',
        content: item.content,
        imageUrl: '',
        correctAnswer: item.correctAnswer,
        explanation: item.explanation,
        difficulty: 'easy',
        category: body.category,
        points: item.points,
        timeLimit: 30,
        options: [
          { label: 'A', content: item.optionA },
          { label: 'B', content: item.optionB },
          { label: 'C', content: item.optionC },
          { label: 'D', content: item.optionD },
        ],
      });
      createdIds.push(q.id);
    }

    const nextQuestionIds = [...level.questionIds, ...createdIds];
    let parsedMapConfig: Record<string, unknown> = {};
    try {
      parsedMapConfig = JSON.parse(level.mapConfig || '{}');
    } catch {
      parsedMapConfig = {};
    }

    const updatedLevel = await updateLevel(level.id, teacher.id, {
      name: level.name,
      description: level.description,
      difficulty: level.difficulty as 'easy' | 'medium' | 'hard',
      completionRequirement: Math.max(1, nextQuestionIds.length),
      rewardConfig: { stars: 3 },
      mapConfig: parsedMapConfig,
      questionIds: nextQuestionIds,
    });

    return ok({ importedCount: createdIds.length, level: updatedLevel }, 201);
  } catch (err) {
    return handleError(err);
  }
}
