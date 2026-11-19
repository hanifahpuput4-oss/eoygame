import { NextRequest } from 'next/server';
import { requireRole } from '@/server/auth/session';
import { createLevel, listLevels } from '@/server/services/level-service';
import { levelSchema } from '@/server/middleware/validation';
import { ok, handleError } from '@/server/middleware/http';

export async function GET() {
  try {
    const teacher = await requireRole('teacher');
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
