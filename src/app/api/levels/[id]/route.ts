import { NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/session';
import { updateLevel, deleteLevel } from '@/server/services/level-service';
import { levelSchema } from '@/server/middleware/validation';
import { ok, handleError } from '@/server/middleware/http';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const teacher = await requireRole('teacher');
    const isAdmin = teacher.role === 'admin';
    const { id } = await ctx.params;
    const rawBody = await req.json();
    const input = levelSchema.parse(rawBody);
    const targetTeacherId =
      isAdmin && typeof rawBody?.teacherId === 'string' && rawBody.teacherId.trim()
        ? rawBody.teacherId.trim()
        : undefined;
    const level = await updateLevel(
      id,
      teacher.id,
      { ...input, teacherId: targetTeacherId },
      isAdmin,
    );
    return ok({ level });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const teacher = await requireRole('teacher');
    const { id } = await ctx.params;
    await deleteLevel(id, teacher.id, teacher.role === 'admin');
    return ok({ success: true });
  } catch (err) {
    return handleError(err);
  }
}
