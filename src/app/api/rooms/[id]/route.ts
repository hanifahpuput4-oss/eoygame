import { NextRequest } from 'next/server';
import { z } from 'zod';
import { eq, asc, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { levelQuestions, questionOptions, questions, roomPlayers, rooms } from '@/db/schema';
import { requireUser } from '@/server/auth/session';
import { getRoom, updateRoomStatus, removePlayer, assertHost, leaveRoom, ensureSession } from '@/server/services/room-service';
import { stripCorrectAnswer } from '@/server/services/question-service';
import { publishToRoom } from '@/server/services/realtime-service';
import { getEphemeralChatSince } from '@/server/services/chat-store';
import { removePresence, touchPresence } from '@/server/services/presence-store';
import { generateId } from '@/server/auth/crypto';
import { ok, fail, handleError } from '@/server/middleware/http';

const statusSchema = z.object({
  status: z.enum(['waiting', 'starting', 'in_progress', 'paused', 'completed']),
});

async function loadSafeLevelQuestions(levelId: string) {
  const links = await db
    .select()
    .from(levelQuestions)
    .where(eq(levelQuestions.levelId, levelId))
    .orderBy(asc(levelQuestions.position));

  if (links.length === 0) return [];
  const qIds = links.map((l) => l.questionId);
  const [qRows, opts] = await Promise.all([
    db.select().from(questions).where(inArray(questions.id, qIds)),
    db.select().from(questionOptions).where(inArray(questionOptions.questionId, qIds)),
  ]);

  return qIds
    .map((qid) => qRows.find((q) => q.id === qid))
    .filter((q): q is NonNullable<typeof q> => Boolean(q))
    .map((q) => ({
      ...stripCorrectAnswer(q),
      options: opts.filter((o) => o.questionId === q.id),
    }));
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const bootstrap = req.nextUrl.searchParams.get('bootstrap') === '1';

    if (!bootstrap) {
      return ok({ room: await getRoom(id) });
    }

    let room = await getRoom(id);
    const isAllowedInArena =
      room.status !== 'completed' && (user.role === 'teacher' || room.status === 'in_progress');

    if (isAllowedInArena) {
      touchPresence(id, user.id, true);
      const inRoom = (room.players ?? []).some((pl) => pl.userId === user.id);
      if (!inRoom && (user.role !== 'teacher' || room.hostId === user.id)) {
        await db
          .insert(roomPlayers)
          .values({
            id: generateId('rpl'),
            roomId: id,
            userId: user.id,
            avatar: user.avatar,
          })
          .catch(() => {});
        room = await getRoom(id);
      }
    }

    const levelId = room.level?.id;
    const [levelQs, session] = await Promise.all([
      levelId ? loadSafeLevelQuestions(levelId) : Promise.resolve([]),
      levelId && isAllowedInArena
        ? ensureSession(id, user.id, levelId).catch(() => null)
        : Promise.resolve(null),
    ]);

    const chatSync = getEphemeralChatSince(id, -1);

    return ok({
      profile: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        avatar: user.avatar,
        totalPoints: user.totalPoints,
        totalStars: user.totalStars,
      },
      room,
      questions: levelQs,
      chatCursor: chatSync.chatCursor,
      sessionId: session?.id ?? null,
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const body = await req.json();

    if (body.action === 'leave') {
      removePresence(id, user.id);
      await leaveRoom(id, user.id);
      return ok({ success: true });
    }

    if (user.role === 'student') {
      return fail('Aksi tidak diizinkan', 403);
    }

    if (user.role !== 'teacher') {
      return fail('Hanya guru yang dapat melakukan aksi ini', 403);
    }

    if (body.action === 'remove-player') {
      const schema = z.object({ playerId: z.string().min(1) });
      const { playerId } = schema.parse(body);
      await removePlayer(id, user.id, playerId);
      return ok({ room: await getRoom(id) });
    }

    const { status } = statusSchema.parse(body);
    const room = await updateRoomStatus(id, user.id, status);
    void publishToRoom(id, 'room-status', { status });
    return ok({ room });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    if (user.role !== 'teacher') {
      return fail('Hanya guru yang dapat menghapus ruang', 403);
    }
    const { id } = await ctx.params;
    await assertHost(id, user.id);
    await db.delete(rooms).where(eq(rooms.id, id));
    return ok({ success: true });
  } catch (err) {
    return handleError(err);
  }
}
