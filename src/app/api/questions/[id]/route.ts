import { NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/session';
import { updateQuestion, deleteQuestion } from '@/server/services/question-service';
import { questionUpdateSchema } from '@/server/middleware/validation';
import { ok, handleError } from '@/server/middleware/http';

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const teacher = await requireRole('teacher');
    const { id } = await ctx.params;
    const input = questionUpdateSchema.parse(await req.json());
    const question = await updateQuestion(id, teacher.id, input);
    return ok({ question });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const teacher = await requireRole('teacher');
    const { id } = await ctx.params;
    await deleteQuestion(id, teacher.id);
    return ok({ success: true });
  } catch (err) {
    return handleError(err);
  }
}
