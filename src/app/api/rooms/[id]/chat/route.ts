import { NextRequest } from 'next/server';
import { eq, asc } from 'drizzle-orm';
import { db } from '@/db';
import { chatMessages } from '@/db/schema';
import { requireUser } from '@/server/auth/session';
import { ok, handleError } from '@/server/middleware/http';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const messages = await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.roomId, id))
      .orderBy(asc(chatMessages.createdAt))
      .limit(50);
    return ok({ messages });
  } catch (err) {
    return handleError(err);
  }
}
