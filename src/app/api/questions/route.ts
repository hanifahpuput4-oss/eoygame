import { NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/session';
import { createQuestion, listQuestions, listCategories } from '@/server/services/question-service';
import { questionSchema } from '@/server/middleware/validation';
import { ok, handleError } from '@/server/middleware/http';

export async function GET(req: NextRequest) {
  try {
    const teacher = await requireRole('teacher');
    const isAdmin = teacher.role === 'admin';
    const { searchParams } = new URL(req.url);
    const filters = {
      search: searchParams.get('search') ?? undefined,
      category: searchParams.get('category') ?? undefined,
      difficulty: searchParams.get('difficulty') ?? undefined,
    };
    const [questions, categories] = await Promise.all([
      listQuestions(teacher.id, filters, isAdmin),
      listCategories(teacher.id, isAdmin),
    ]);
    return ok({ questions, categories });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const teacher = await requireRole('teacher');
    const isAdmin = teacher.role === 'admin';
    const rawBody = await req.json();
    const input = questionSchema.parse(rawBody);
    const creatorId =
      isAdmin && typeof rawBody?.teacherId === 'string' && rawBody.teacherId.trim()
        ? rawBody.teacherId.trim()
        : teacher.id;
    const question = await createQuestion(creatorId, input);
    return ok({ question }, 201);
  } catch (err) {
    return handleError(err);
  }
}
