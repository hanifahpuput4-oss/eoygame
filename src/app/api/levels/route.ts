import { NextRequest } from 'next/server';
import { asc, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { requireRole } from '@/server/auth/session';
import { createLevel, listLevels } from '@/server/services/level-service';
import { listQuestions } from '@/server/services/question-service';
import { levelSchema } from '@/server/middleware/validation';
import { ok, handleError } from '@/server/middleware/http';

export async function GET(req: NextRequest) {
  try {
    const teacher = await requireRole('teacher');
    const isAdmin = teacher.role === 'admin';
    const withQuestions = req.nextUrl.searchParams.get('withQuestions') === '1';
    if (withQuestions) {
      const [levels, questions, teachers] = await Promise.all([
        listLevels(teacher.id, isAdmin),
        listQuestions(teacher.id, {}, isAdmin),
        isAdmin
          ? db
              .select({
                id: users.id,
                username: users.username,
                fullName: users.fullName,
                role: users.role,
              })
              .from(users)
              .where(inArray(users.role, ['teacher', 'admin']))
              .orderBy(asc(users.fullName))
          : Promise.resolve([]),
      ]);
      return ok({ levels, questions, teachers, isAdmin, currentUserId: teacher.id });
    }
    return ok({ levels: await listLevels(teacher.id, isAdmin), isAdmin, currentUserId: teacher.id });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const teacher = await requireRole('teacher');
    const isAdmin = teacher.role === 'admin';
    const rawBody = await req.json();
    const input = levelSchema.parse(rawBody);
    const ownerId =
      isAdmin && typeof rawBody?.teacherId === 'string' && rawBody.teacherId.trim()
        ? rawBody.teacherId.trim()
        : teacher.id;
    const level = await createLevel(ownerId, input, isAdmin);
    return ok({ level }, 201);
  } catch (err) {
    return handleError(err);
  }
}
