import { NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/session';
import { createLevel, listLevels } from '@/server/services/level-service';
import { listQuestions } from '@/server/services/question-service';
import { levelSchema } from '@/server/middleware/validation';
import { ok, handleError } from '@/server/middleware/http';

export async function GET(req: NextRequest) {
  try {
    const teacher = await requireRole('teacher');
    const withQuestions = req.nextUrl.searchParams.get('withQuestions') === '1';
    if (withQuestions) {
      const [levels, questions] = await Promise.all([
        listLevels(teacher.id),
        listQuestions(teacher.id, {}),
      ]);
      return ok({ levels, questions });
    }
    return ok({ levels: await listLevels(teacher.id) });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const teacher = await requireRole('teacher');
    const input = levelSchema.parse(await req.json());
    const level = await createLevel(teacher.id, input);
    return ok({ level }, 201);
  } catch (err) {
    return handleError(err);
  }
}
