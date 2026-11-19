import { NextRequest } from 'next/server';
import { eq, asc } from 'drizzle-orm';
import { db } from '@/db';
import {
  classrooms,
  classroomMembers,
  gameSessions,
  levelQuestions,
  levels,
  playerAnswers,
  questions,
  roomPlayers,
  rooms,
  users,
} from '@/db/schema';
import { requireRole } from '@/server/auth/session';
import { assertHost } from '@/server/services/room-service';
import { ok, fail, handleError } from '@/server/middleware/http';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const teacher = await requireRole('teacher');
    const { id } = await ctx.params;
    await assertHost(id, teacher.id);

    const roomRows = await db.select().from(rooms).where(eq(rooms.id, id)).limit(1);
    const room = roomRows[0];
    if (!room) return fail('Ruang tidak ditemukan', 404);

    const [classroomRows, levelRows, lqRows] = await Promise.all([
      db.select().from(classrooms).where(eq(classrooms.id, room.classroomId)).limit(1),
      db.select().from(levels).where(eq(levels.id, room.levelId)).limit(1),
      db
        .select({ questionId: levelQuestions.questionId })
        .from(levelQuestions)
        .where(eq(levelQuestions.levelId, room.levelId))
        .orderBy(asc(levelQuestions.position)),
    ]);

    const allQuestions = await db.select().from(questions);
    const levelQuestionList = lqRows
      .map((l) => allQuestions.find((q) => q.id === l.questionId))
      .filter((q): q is typeof questions.$inferSelect => Boolean(q));

    const totalQuestions = levelQuestionList.length;
    const maxScore = levelQuestionList.reduce((acc, q) => acc + (q.points ?? 10), 0);

    const sessions = await db
      .select()
      .from(gameSessions)
      .where(eq(gameSessions.roomId, room.id));

    const enrolledMembers = await db
      .select({
        userId: users.id,
        username: users.username,
        fullName: users.fullName,
      })
      .from(classroomMembers)
      .innerJoin(users, eq(classroomMembers.studentId, users.id))
      .where(eq(classroomMembers.classroomId, room.classroomId));

    const roomPlayerRows = await db
      .select({
        userId: users.id,
        username: users.username,
        fullName: users.fullName,
        role: users.role,
      })
      .from(roomPlayers)
      .innerJoin(users, eq(roomPlayers.userId, users.id))
      .where(eq(roomPlayers.roomId, room.id));

    const studentMap = new Map<string, { userId: string; username: string; fullName: string }>();
    for (const m of enrolledMembers) {
      studentMap.set(m.userId, m);
    }
    for (const rp of roomPlayerRows) {
      if (rp.role === 'student' && !studentMap.has(rp.userId)) {
        studentMap.set(rp.userId, { userId: rp.userId, username: rp.username, fullName: rp.fullName });
      }
    }

    for (const s of sessions) {
      if (!studentMap.has(s.userId)) {
        const uRows = await db.select().from(users).where(eq(users.id, s.userId)).limit(1);
        if (uRows[0] && uRows[0].role === 'student') {
          studentMap.set(s.userId, {
            userId: uRows[0].id,
            username: uRows[0].username,
            fullName: uRows[0].fullName,
          });
        }
      }
    }

    const recapRows = await Promise.all(
      Array.from(studentMap.values()).map(async (st) => {
        const sess = sessions.find((s) => s.userId === st.userId);
        const answers = sess
          ? await db.select().from(playerAnswers).where(eq(playerAnswers.sessionId, sess.id))
          : [];
        const correctCount = answers.filter((a) => a.isCorrect).length;
        const wrongCount = answers.filter((a) => !a.isCorrect).length;
        const answeredCount = answers.length;
        const rawScore = sess?.score ?? answers.reduce((acc, a) => acc + (a.pointsEarned ?? 0), 0);
        const finalGrade =
          totalQuestions > 0
            ? Math.round((correctCount / totalQuestions) * 100)
            : maxScore > 0
              ? Math.round((rawScore / maxScore) * 100)
              : 0;

        return {
          userId: st.userId,
          fullName: st.fullName,
          username: st.username,
          participated: Boolean(sess || roomPlayerRows.some((r) => r.userId === st.userId)),
          answeredCount,
          correctCount,
          wrongCount,
          totalQuestions,
          rawScore,
          maxScore,
          finalGrade,
        };
      }),
    );

    recapRows.sort((a, b) => b.finalGrade - a.finalGrade || b.rawScore - a.rawScore || a.fullName.localeCompare(b.fullName));

    let mapMeta: { subjectName?: string; grade?: string; objectiveName?: string } = {};
    try {
      mapMeta = JSON.parse(levelRows[0]?.mapConfig || '{}');
    } catch {
      mapMeta = {};
    }

    return ok({
      room: {
        id: room.id,
        name: room.name,
        code: room.code,
        status: room.status,
        startedAt: room.startedAt,
        endedAt: room.endedAt,
      },
      classroom: classroomRows[0]
        ? {
            id: classroomRows[0].id,
            name: classroomRows[0].name,
            subject: classroomRows[0].subject,
            grade: classroomRows[0].grade,
          }
        : null,
      level: levelRows[0]
        ? {
            id: levelRows[0].id,
            name: levelRows[0].name,
            subjectName: mapMeta.subjectName ?? classroomRows[0]?.subject ?? '-',
            grade: mapMeta.grade ?? classroomRows[0]?.grade ?? '-',
            objectiveName: mapMeta.objectiveName ?? levelRows[0].name,
          }
        : null,
      totalQuestions,
      maxScore,
      students: recapRows,
    });
  } catch (err) {
    return handleError(err);
  }
}
