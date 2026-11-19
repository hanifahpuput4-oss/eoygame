import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser, requireRole } from '@/server/auth/session';
import { getRoom, updateRoomStatus, removePlayer, assertHost, leaveRoom } from '@/server/services/room-service';
import { ok, fail, handleError } from '@/server/middleware/http';

const statusSchema = z.object({
  status: z.enum(['waiting', 'starting', 'in_progress', 'paused', 'completed']),
});

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    return ok({ room: await getRoom(id) });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = await req.json();

    if (user.role === 'student') {
      if (body.action === 'leave') {
        await leaveRoom(id, user.id);
        return ok({ success: true });
      }
      return fail('Aksi tidak diizinkan', 403);
    }

    await requireRole('teacher');

    if (body.action === 'remove-player') {
      const schema = z.object({ playerId: z.string().min(1) });
      const { playerId } = schema.parse(body);
      await removePlayer(id, user.id, playerId);
      return ok({ room: await getRoom(id) });
    }

    const { status } = statusSchema.parse(body);
    const room = await updateRoomStatus(id, user.id, status);
    const { publishToRoom } = await import('@/server/services/realtime-service');
    await publishToRoom(id, 'room-status', { status });
    return ok({ room });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    await requireRole('teacher');
    const { id } = await ctx.params;
    await assertHost(id, user.id);
    const { db } = await import('@/db');
    const { rooms } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    await db.delete(rooms).where(eq(rooms.id, id));
    return ok({ success: true });
  } catch (err) {
    return handleError(err);
  }
}
