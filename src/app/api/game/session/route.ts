import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/server/auth/session';
import { ensureSession } from '@/server/services/room-service';
import { ok, handleError } from '@/server/middleware/http';

const schema = z.object({
  roomId: z.string().min(1),
  levelId: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = schema.parse(await req.json());
    const session = await ensureSession(input.roomId, user.id, input.levelId);
    return ok({ sessionId: session.id });
  } catch (err) {
    return handleError(err);
  }
}
