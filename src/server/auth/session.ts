import { cookies } from 'next/headers';
import { eq, and, gt } from 'drizzle-orm';
import { db } from '@/db';
import { sessions, users } from '@/db/schema';

type User = typeof users.$inferSelect;
import { generateId, hashToken } from './crypto';

const SESSION_COOKIE = 'eduquest_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;

export async function createSession(userId: string): Promise<void> {
  const rawToken = generateId('sess');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(sessions).values({ id: tokenHash, userId, expiresAt });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    expires: expiresAt,
  });
}

export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (!rawToken) return null;

  const tokenHash = hashToken(rawToken);
  const rows = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, tokenHash), gt(sessions.expiresAt, new Date())))
    .limit(1);

  return rows[0]?.user ?? null;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (rawToken) {
    await db.delete(sessions).where(eq(sessions.id, hashToken(rawToken)));
  }
  cookieStore.delete(SESSION_COOKIE);
}

export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError('UNAUTHENTICATED');
  return user;
}

export async function requireRole(role: 'teacher' | 'student'): Promise<User> {
  const user = await requireUser();
  if (user.role !== role) throw new AuthError('FORBIDDEN');
  return user;
}

export class AuthError extends Error {}
