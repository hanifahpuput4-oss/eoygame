import { NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/session';
import { createQuestion, listQuestions, listCategories } from '@/server/services/question-service';
import { questionSchema } from '@/server/middleware/validation';
import { ok, handleError } from '@/server/middleware/http';

export async function GET(req: NextRequest) {
  try {
    const teacher = await requireRole('teacher');
    const { searchParams } = new URL(req.url);
    const filters = {
      search: searchParams.get('search') ?? undefined,
      category: searchParams.get('category') ?? undefined,
      difficulty: searchParams.get('difficulty') ?? undefined,
    };
    const [questions, categories] = await Promise.all([
      listQuestions(teacher.id, filters),
      listCategories(teacher.id),
    ]);
    return ok({ questions, categories });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const teacher = await requireRole('teacher');
    const input = questionSchema.parse(await req.json());
    const question = await createQuestion(teacher.id, input);
    return ok({ question }, 201);
  } catch (err) {
    return handleError(err);
  }
}
