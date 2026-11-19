import { NextRequest } from 'next/server';
import { z } from 'zod';
import { eq, and, asc } from 'drizzle-orm';
import { db } from '@/db';
import { chatMessages, gameSessions, playerAnswers, questions, questionOptions, users, gameEvents, roomPlayers, rooms } from '@/db/schema';
import { requireUser } from '@/server/auth/session';
import { generateId } from '@/server/auth/crypto';
import { answerSchema, chatSchema } from '@/server/middleware/validation';
import { ok, fail, handleError } from '@/server/middleware/http';
import { publishToRoom } from '@/server/services/realtime-service';
import { assertHost } from '@/server/services/room-service';

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  try {
    const user = await requireUser();
    const { action } = await ctx.params;
    const body = await req.json();

    if (action === 'answer') {
      const input = answerSchema.parse(body);
      const schema = z.object({ sessionId: z.string().min(1) });
      const { sessionId } = schema.parse(body);

      const sessionRows = await db
        .select()
        .from(gameSessions)
        .where(and(eq(gameSessions.id, sessionId), eq(gameSessions.userId, user.id)))
        .limit(1);
      if (!sessionRows[0]) return fail('Sesi permainan tidak ditemukan', 404);

      const dup = await db
        .select({ id: playerAnswers.id })
        .from(playerAnswers)
        .where(and(eq(playerAnswers.sessionId, sessionId), eq(playerAnswers.questionId, input.questionId)))
        .limit(1);
      if (dup[0]) return fail('Soal ini sudah dijawab', 409);

      const qRows = await db.select().from(questions).where(eq(questions.id, input.questionId)).limit(1);
      const question = qRows[0];
      if (!question) return fail('Soal tidak ditemukan', 404);

      const isCorrect = question.correctAnswer === input.answer;
      const pointsEarned = isCorrect ? question.points : 0;

      await db.insert(playerAnswers).values({
        id: generateId('ans'),
        sessionId,
        questionId: input.questionId,
        answer: input.answer,
        isCorrect,
        pointsEarned,
        timeSpent: input.timeSpent,
      });

      if (isCorrect) {
        await db
          .update(gameSessions)
          .set({ score: sessionRows[0].score + pointsEarned, updatedAt: new Date() })
          .where(eq(gameSessions.id, sessionId));
        await db
          .update(users)
          .set({ totalPoints: user.totalPoints + pointsEarned, updatedAt: new Date() })
          .where(eq(users.id, user.id));
      }

      await publishToRoom(sessionRows[0].roomId, 'score', {
        userId: user.id,
        username: user.username,
        score: sessionRows[0].score + pointsEarned,
        stars: sessionRows[0].stars,
        isCorrect,
      });

      return ok({
        result: {
          isCorrect,
          pointsEarned,
          correctAnswer: question.correctAnswer,
          explanation: question.explanation,
        },
      });
    }

    if (action === 'chat') {
      const input = chatSchema.parse(body);
      const schema = z.object({ roomId: z.string().min(1) });
      const { roomId } = schema.parse(body);

      const message = {
        id: generateId('msg'),
        roomId,
        userId: user.id,
        senderName: user.username,
        text: input.text,
        createdAt: new Date(),
      };
      await db.insert(chatMessages).values(message);
      await db.insert(gameEvents).values({
        id: generateId('evt'),
        roomId,
        userId: user.id,
        eventType: 'chat',
        payload: JSON.stringify(message),
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
      });
      const { roomId, x, y, facing } = schema.parse(body);
      if (x !== undefined && y !== undefined) {
        await db
          .update(roomPlayers)
          .set({ lastX: x, lastY: y, lastFacing: facing ?? 1 })
          .where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.userId, user.id)));
      }
      const scores = await db
        .select({ userId: gameSessions.userId, score: gameSessions.score, stars: gameSessions.stars })
        .from(gameSessions)
        .where(eq(gameSessions.roomId, roomId));
      const players = await db
        .select({ userId: roomPlayers.userId, username: users.username, avatar: roomPlayers.avatar, role: users.role, lastX: roomPlayers.lastX, lastY: roomPlayers.lastY, lastFacing: roomPlayers.lastFacing })
        .from(roomPlayers)
        .innerJoin(users, eq(roomPlayers.userId, users.id))
        .where(eq(roomPlayers.roomId, roomId));
      const messages = await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.roomId, roomId))
        .orderBy(asc(chatMessages.createdAt))
        .limit(50);
      const mySession = await db
        .select({ id: gameSessions.id })
        .from(gameSessions)
        .where(and(eq(gameSessions.roomId, roomId), eq(gameSessions.userId, user.id)))
        .limit(1);
      const myAnswers = mySession[0]
        ? await db
            .select({ questionId: playerAnswers.questionId, isCorrect: playerAnswers.isCorrect })
            .from(playerAnswers)
            .where(eq(playerAnswers.sessionId, mySession[0].id))
        : [];
      const rows = await db.select().from(rooms).where(eq(rooms.id, roomId)).limit(1);
      const answerResults: Record<string, boolean> = {};
      for (const a of myAnswers) {
        answerResults[a.questionId] = Boolean(a.isCorrect);
      }
      return ok({
        room: rows[0] ? { id: rows[0].id, status: rows[0].status, name: rows[0].name, activeQuestionId: rows[0].activeQuestionId } : null,
        players: players.map((p) => ({
          ...p,
          score: scores.find((s) => s.userId === p.userId)?.score ?? 0,
          stars: scores.find((s) => s.userId === p.userId)?.stars ?? 0,
        })),
        messages,
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
