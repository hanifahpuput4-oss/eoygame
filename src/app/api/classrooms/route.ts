import { NextRequest } from 'next/server';
import { requireUser, requireRole } from '@/server/auth/session';
import {
  createClassroom,
  listClassrooms,
  joinClassroom,
  listStudentClassrooms,
} from '@/server/services/classroom-service';
import { classroomSchema } from '@/server/middleware/validation';
import { ok, fail, handleError } from '@/server/middleware/http';
import { z } from 'zod';

export async function GET() {
  try {
    const user = await requireUser();
    if (user.role === 'teacher') {
      return ok({ classrooms: await listClassrooms(user.id) });
    }
    return ok({ classrooms: await listStudentClassrooms(user.id) });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();

    if (user.role === 'student') {
      const schema = z.object({ code: z.string().length(6) });
      const parsed = schema.safeParse(body);
      if (!parsed.success) return fail('Akses ditolak', 403);
      const classroom = await joinClassroom(parsed.data.code, user.id);
      return ok({ classroom }, 201);
    }

    await requireRole('teacher');
    const input = classroomSchema.parse(body);
    const classroom = await createClassroom(user.id, input);
    return ok({ classroom }, 201);
  } catch (err) {
    return handleError(err);
  }
}
