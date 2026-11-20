import { NextRequest } from 'next/server';
import { z } from 'zod';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { gameSessions, playerAnswers, questions, questionOptions, users, roomPlayers, rooms } from '@/db/schema';
import { invalidateUserSessionCache, requireUser } from '@/server/auth/session';
import { generateId } from '@/server/auth/crypto';
import { answerSchema, chatSchema } from '@/server/middleware/validation';
import { ok, fail, handleError } from '@/server/middleware/http';
import { publishToRoom } from '@/server/services/realtime-service';
import { addEphemeralChat, getEphemeralChatSince } from '@/server/services/chat-store';
import { getStaleUserIds, removePresence, touchPresence } from '@/server/services/presence-store';
import { assertHost } from '@/server/services/room-service';

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  try {
    const user = await requireUser();
    const { action } = await ctx.params;
    const body = await req.json();

    if (action === 'answer') {
      const input = answerSchema.parse(body);
      const metaSchema = z.object({
        sessionId: z.string().optional(),
        roomId: z.string().optional(),
        levelId: z.string().optional(),
      });
      const meta = metaSchema.parse(body);

      let activeSession: typeof gameSessions.$inferSelect | undefined;

      if (meta.sessionId) {
        const rows = await db
          .select()
          .from(gameSessions)
          .where(and(eq(gameSessions.id, meta.sessionId), eq(gameSessions.userId, user.id)))
          .limit(1);
        activeSession = rows[0];
      }

      if (!activeSession && meta.roomId) {
        const existing = await db
          .select()
          .from(gameSessions)
          .where(and(eq(gameSessions.roomId, meta.roomId), eq(gameSessions.userId, user.id)))
          .limit(1);
        if (existing[0]) {
          activeSession = existing[0];
        } else {
          let resolvedLevelId = meta.levelId;
          if (!resolvedLevelId) {
            const roomRow = await db
              .select({ levelId: rooms.levelId })
              .from(rooms)
              .where(eq(rooms.id, meta.roomId))
              .limit(1);
            resolvedLevelId = roomRow[0]?.levelId;
          }
          if (resolvedLevelId) {
            const newId = generateId('gsn');
            await db.insert(gameSessions).values({
              id: newId,
              roomId: meta.roomId,
              userId: user.id,
              levelId: resolvedLevelId,
            });
            const created = await db.select().from(gameSessions).where(eq(gameSessions.id, newId)).limit(1);
            activeSession = created[0];
          }
        }
      }

      if (!activeSession) return fail('Sesi permainan tidak ditemukan', 404);
      const sessionId = activeSession.id;

      const [dup, qRows] = await Promise.all([
        db
          .select({ id: playerAnswers.id })
          .from(playerAnswers)
          .where(and(eq(playerAnswers.sessionId, sessionId), eq(playerAnswers.questionId, input.questionId)))
          .limit(1),
        db.select().from(questions).where(eq(questions.id, input.questionId)).limit(1),
      ]);

      if (dup[0]) return fail('Soal ini sudah dijawab', 409);

      const question = qRows[0];
      if (!question) return fail('Soal tidak ditemukan', 404);

      const isCorrect = question.correctAnswer === input.answer;
      const pointsEarned = isCorrect ? question.points : 0;

      const writeOps: Promise<unknown>[] = [
        db.insert(playerAnswers).values({
          id: generateId('ans'),
          sessionId,
          questionId: input.questionId,
          answer: input.answer,
          isCorrect,
          pointsEarned,
          timeSpent: input.timeSpent,
        }),
      ];

      if (isCorrect) {
        writeOps.push(
          db
            .update(gameSessions)
            .set({ score: activeSession.score + pointsEarned, updatedAt: new Date() })
            .where(eq(gameSessions.id, sessionId)),
          db
            .update(users)
            .set({ totalPoints: user.totalPoints + pointsEarned, updatedAt: new Date() })
            .where(eq(users.id, user.id)),
        );
      }

      await Promise.all(writeOps);
      if (isCorrect) {
        invalidateUserSessionCache(user.id);
      }

      void publishToRoom(activeSession.roomId, 'score', {
        userId: user.id,
        username: user.username,
        score: activeSession.score + pointsEarned,
        stars: activeSession.stars,
        isCorrect,
      });

      return ok({
        sessionId,
        result: {
          isCorrect,
          pointsEarned,
          correctAnswer: question.correctAnswer,
          explanation: question.explanation,
        },
      });
    }

    if (action === 'leave') {
      const schema = z.object({ roomId: z.string().min(1) });
      const { roomId } = schema.parse(body);
      removePresence(roomId, user.id);
      await db.delete(roomPlayers).where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.userId, user.id)));
      void publishToRoom(roomId, 'kicked', { playerId: user.id, left: true });
      return ok({ success: true });
    }

    if (action === 'chat') {
      const input = chatSchema.parse(body);
      const schema = z.object({ roomId: z.string().min(1) });
      const { roomId } = schema.parse(body);

      const message = addEphemeralChat(roomId, {
        id: generateId('msg'),
        roomId,
        userId: user.id,
        senderName: user.username,
        text: input.text,
        createdAt: new Date().toISOString(),
      });
      await publishToRoom(roomId, 'chat', message);

      return ok({ message }, 201);
    }

    if (action === 'push-question') {
      if (user.role !== 'teacher') return fail('Hanya guru yang dapat mengirim soal', 403);
      const schema = z.object({
        roomId: z.string().min(1),
        questionId: z.string().nullable(),
      });
      const { roomId, questionId } = schema.parse(body);
      await assertHost(roomId, user.id);
      await db.update(rooms).set({ activeQuestionId: questionId, updatedAt: new Date() }).where(eq(rooms.id, roomId));

      if (!questionId) {
        await publishToRoom(roomId, 'question', { question: null });
        return ok({ pushed: null });
      }

      const qRows = await db.select().from(questions).where(eq(questions.id, questionId)).limit(1);
      if (!qRows[0]) return fail('Soal tidak ditemukan', 404);
      const options = await db
        .select({ label: questionOptions.label, content: questionOptions.content })
        .from(questionOptions)
        .where(eq(questionOptions.questionId, questionId));
      const { correctAnswer: _omit, ...safe } = qRows[0];
      void _omit;
      await publishToRoom(roomId, 'question', { question: { ...safe, options } });
      return ok({ pushed: { ...safe, options } });
    }

    if (action === 'kick') {
      if (user.role !== 'teacher') return fail('Hanya guru yang dapat mengeluarkan pemain', 403);
      const schema = z.object({ roomId: z.string().min(1), playerId: z.string().min(1) });
      const { roomId, playerId } = schema.parse(body);
      await assertHost(roomId, user.id);
      removePresence(roomId, playerId);
      await db.delete(roomPlayers).where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.userId, playerId)));
      await publishToRoom(roomId, 'kicked', { playerId });
      return ok({ success: true });
    }

    if (action === 'room-sync') {
      const schema = z.object({
        roomId: z.string().min(1),
        x: z.number().min(-10000).max(10000).optional(),
        y: z.number().min(-10000).max(10000).optional(),
        facing: z.number().int().min(-1).max(1).optional(),
        chatCursor: z.number().int().optional(),
      });
      const { roomId, x, y, facing, chatCursor } = schema.parse(body);

      const allowedPresence = touchPresence(roomId, user.id);

      const [scores, players, mySession, rows] = await Promise.all([
        db
          .select({ userId: gameSessions.userId, score: gameSessions.score, stars: gameSessions.stars })
          .from(gameSessions)
          .where(eq(gameSessions.roomId, roomId)),
        db
          .select({
            userId: roomPlayers.userId,
            username: users.username,
            avatar: roomPlayers.avatar,
            role: users.role,
            lastX: roomPlayers.lastX,
            lastY: roomPlayers.lastY,
            lastFacing: roomPlayers.lastFacing,
          })
          .from(roomPlayers)
          .innerJoin(users, eq(roomPlayers.userId, users.id))
          .where(eq(roomPlayers.roomId, roomId)),
        db
          .select({ id: gameSessions.id })
          .from(gameSessions)
          .where(and(eq(gameSessions.roomId, roomId), eq(gameSessions.userId, user.id)))
          .limit(1),
        db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1),
        x !== undefined && y !== undefined
          ? db
              .update(roomPlayers)
              .set({ lastX: x, lastY: y, lastFacing: facing ?? 1 })
              .where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.userId, user.id)))
          : Promise.resolve(),
      ]);

      let activePlayers = players;

      // Re-attach current user to roomPlayers if they returned from background tab
      if (allowedPresence && !activePlayers.some((p) => p.userId === user.id) && rows[0] && rows[0].status !== 'completed') {
        await db
          .insert(roomPlayers)
          .values({
            id: generateId('rpl'),
            roomId,
            userId: user.id,
            avatar: user.avatar,
            lastX: x ?? 120,
            lastY: y ?? 600,
            lastFacing: facing ?? 1,
          })
          .catch(() => {});
        activePlayers = [
          ...activePlayers,
          {
            userId: user.id,
            username: user.username,
            avatar: user.avatar,
            role: user.role,
            lastX: x ?? 120,
            lastY: y ?? 600,
            lastFacing: facing ?? 1,
          },
        ];
      }

      // Prune disconnected / inactive players (no heartbeat for >5.5s)
      const staleIds = getStaleUserIds(
        roomId,
        activePlayers.map((p) => p.userId),
      );
      if (staleIds.length > 0) {
        const staleSet = new Set(staleIds);
        activePlayers = activePlayers.filter((p) => !staleSet.has(p.userId));
        await db
          .delete(roomPlayers)
          .where(and(eq(roomPlayers.roomId, roomId), inArray(roomPlayers.userId, staleIds)))
          .catch(() => {});
      }

      let activeSessionId = mySession[0]?.id;
      if (!activeSessionId && rows[0]?.levelId) {
        const newSessionId = generateId('gsn');
        await db
          .insert(gameSessions)
          .values({
            id: newSessionId,
            roomId,
            userId: user.id,
            levelId: rows[0].levelId,
          })
          .catch(() => {});
        activeSessionId = newSessionId;
      }

      const myAnswers = mySession[0]
        ? await db
            .select({ questionId: playerAnswers.questionId, isCorrect: playerAnswers.isCorrect })
            .from(playerAnswers)
            .where(eq(playerAnswers.sessionId, mySession[0].id))
        : [];

      const answerResults: Record<string, boolean> = {};
      for (const a of myAnswers) {
        answerResults[a.questionId] = Boolean(a.isCorrect);
      }
      const chatSync = getEphemeralChatSince(roomId, chatCursor);
      return ok({
        sessionId: activeSessionId ?? null,
        room: rows[0] ? { id: rows[0].id, status: rows[0].status, name: rows[0].name, activeQuestionId: rows[0].activeQuestionId } : null,
        players: activePlayers.map((p) => {
          const isMe = p.userId === user.id && x !== undefined && y !== undefined;
          return {
            ...p,
            lastX: isMe ? x : p.lastX,
            lastY: isMe ? y : p.lastY,
            lastFacing: isMe ? (facing ?? 1) : p.lastFacing,
            score: scores.find((s) => s.userId === p.userId)?.score ?? 0,
            stars: scores.find((s) => s.userId === p.userId)?.stars ?? 0,
          };
        }),
        messages: chatSync.messages,
        chatCursor: chatSync.chatCursor,
        answeredQuestionIds: myAnswers.map((a) => a.questionId),
        answerResults,
        correctCount: myAnswers.filter((a) => a.isCorrect).length,
      });
    }

    return fail('Aksi tidak dikenal', 404);
  } catch (err) {
    return handleError(err);
  }
}
