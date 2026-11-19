import { NextRequest } from 'next/server';
import { eq, asc } from 'drizzle-orm';
import { db } from '@/db';
import { levelQuestions, questionOptions, questions } from '@/db/schema';
import { requireUser } from '@/server/auth/session';
import { ok, handleError } from '@/server/middleware/http';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const links = await db
      .select({ questionId: levelQuestions.questionId })
      .from(levelQuestions)
      .where(eq(levelQuestions.levelId, id))
      .orderBy(asc(levelQuestions.position));

    if (links.length === 0) return ok({ questions: [] });

    const rows = await db.select().from(questions);
    const safe = links
      .map((l) => rows.find((r) => r.id === l.questionId))
      .filter((q): q is typeof questions.$inferSelect => Boolean(q))
      .map(({ correctAnswer: _omit, ...rest }) => {
        void _omit;
        return rest;
      });

    const withOptions = await Promise.all(
      safe.map(async (q) => {
        const options = await db
          .select({ label: questionOptions.label, content: questionOptions.content })
          .from(questionOptions)
          .where(eq(questionOptions.questionId, q.id));
        return { ...q, options };
      }),
    );

    return ok({ questions: withOptions });
  } catch (err) {
    return handleError(err);
  }
}
