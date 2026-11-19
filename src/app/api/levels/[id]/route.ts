import { NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/session';
import { updateLevel, deleteLevel } from '@/server/services/level-service';
import { levelSchema } from '@/server/middleware/validation';
import { ok, handleError } from '@/server/middleware/http';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const teacher = await requireRole('teacher');
    const { id } = await ctx.params;
    const input = levelSchema.parse(await req.json());
    const level = await updateLevel(id, teacher.id, input);
    return ok({ level });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const teacher = await requireRole('teacher');
    const { id } = await ctx.params;
    await deleteLevel(id, teacher.id);
    return ok({ success: true });
  } catch (err) {
    return handleError(err);
  }
}
