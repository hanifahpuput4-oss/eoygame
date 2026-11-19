import { NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/session';
import {
  updateClassroom,
  deleteClassroom,
  regenerateJoinCode,
  listStudents,
} from '@/server/services/classroom-service';
import { classroomSchema } from '@/server/middleware/validation';
import { ok, fail, handleError } from '@/server/middleware/http';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const teacher = await requireRole('teacher');
    const { id } = await ctx.params;
    return ok({ students: await listStudents(id, teacher.id) });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const teacher = await requireRole('teacher');
    const { id } = await ctx.params;
    const body = await req.json();

    if (body.action === 'regenerate-code') {
      const code = await regenerateJoinCode(id, teacher.id);
      return ok({ joinCode: code });
    }

    const input = classroomSchema.partial().parse(body);
    const classroom = await updateClassroom(id, teacher.id, input);
    return ok({ classroom });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const teacher = await requireRole('teacher');
    const { id } = await ctx.params;
    await deleteClassroom(id, teacher.id);
    return ok({ success: true });
  } catch (err) {
    return handleError(err);
  }
}

export function PUT() {
  return fail('Metode tidak didukung', 405);
}
