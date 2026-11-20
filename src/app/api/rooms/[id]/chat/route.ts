import { NextRequest } from 'next/server';
import { requireUser } from '@/server/auth/session';
import { ok, handleError } from '@/server/middleware/http';
import { getEphemeralChatSince } from '@/server/services/chat-store';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireUser();
    const { id } = await ctx.params;
    const { chatCursor } = getEphemeralChatSince(id, -1);
    return ok({ messages: [], chatCursor });
  } catch (err) {
    return handleError(err);
  }
}
