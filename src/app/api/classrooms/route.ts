import { NextRequest } from 'next/server';
import { inArray } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { requireUser } from '@/server/auth/session';
import {
  createClassroom,
  listClassrooms,
  joinClassroom,
  listStudentClassrooms,
} from '@/server/services/classroom-service';
import { classroomSchema } from '@/server/middleware/validation';
import { ok, fail, handleError } from '@/server/middleware/http';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const withProfile = req.nextUrl.searchParams.get('withProfile') === '1';
    const profilePayload = withProfile
      ? {
          id: user.id,
          email: user.email,
          username: user.username,
          fullName: user.fullName,
          role: user.role,
          avatar: user.avatar,
          totalPoints: user.totalPoints,
          totalStars: user.totalStars,
        }
      : undefined;

    if (user.role === 'teacher' || user.role === 'admin') {
      const isAdmin = user.role === 'admin';
      const [classrooms, teachers] = await Promise.all([
        listClassrooms(user.id, isAdmin),
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
          : Promise.resolve([]),
      ]);
      return ok({
        classrooms,
        teachers,
        isAdmin,
        currentUserId: user.id,
        ...(withProfile ? { profile: profilePayload } : {}),
      });
    }

    const classrooms = await listStudentClassrooms(user.id);
    return ok(withProfile ? { classrooms, profile: profilePayload } : { classrooms });
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

    if (user.role !== 'teacher' && user.role !== 'admin') {
      return fail('Hanya guru yang dapat membuat kelas', 403);
    }
    const input = classroomSchema.parse(body);
    const ownerId =
      user.role === 'admin' && typeof body?.teacherId === 'string' && body.teacherId.trim()
        ? body.teacherId.trim()
        : user.id;
    const classroom = await createClassroom(ownerId, input);
    return ok({ classroom }, 201);
  } catch (err) {
    return handleError(err);
  }
}
