import { cookies } from 'next/headers';
import { eq, and, gt } from 'drizzle-orm';
import { db } from '@/db';
import { roomPlayers, sessions, users } from '@/db/schema';
import { removeUserFromAllRoomsPresence } from '@/server/services/presence-store';
import { generateId, hashToken } from './crypto';

type User = typeof users.$inferSelect;

const SESSION_COOKIE = 'eduquest_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const CACHE_TTL_MS = 15000;

const globalForSession = globalThis as unknown as {
  __llysSessionCache?: Map<string, { user: User; cachedAt: number }>;
};

function getSessionCache() {
  if (!globalForSession.__llysSessionCache) {
    globalForSession.__llysSessionCache = new Map();
  }
  return globalForSession.__llysSessionCache;
}

export function invalidateUserSessionCache(userId?: string) {
  const cache = getSessionCache();
  if (!userId) {
    cache.clear();
    return;
  }
  for (const [k, v] of Array.from(cache.entries())) {
    if (v.user.id === userId) cache.delete(k);
  }
}

export async function createSession(userId: string): Promise<void> {
  const rawToken = generateId('sess');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  // Single-device active session: invalidate all existing sessions & in-game presence for this user
  invalidateUserSessionCache(userId);
  removeUserFromAllRoomsPresence(userId);
  await Promise.all([
    db.delete(sessions).where(eq(sessions.userId, userId)),
    db.delete(roomPlayers).where(eq(roomPlayers.userId, userId)),
  ]);

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
  const cache = getSessionCache();
  const now = Date.now();
  const cached = cache.get(tokenHash);
  if (cached && now - cached.cachedAt < CACHE_TTL_MS) {
    return cached.user;
  }

  const rows = await db
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, tokenHash), gt(sessions.expiresAt, new Date())))
    .limit(1);

  const user = rows[0]?.user ?? null;
  if (user) {
    if (cache.size > 500) cache.clear();
    cache.set(tokenHash, { user, cachedAt: now });
  } else {
    cache.delete(tokenHash);
  }
  return user;
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (rawToken) {
    const tokenHash = hashToken(rawToken);
    const cached = getSessionCache().get(tokenHash);
    let userId = cached?.user.id;
    if (!userId) {
      const sRow = await db
        .select({ userId: sessions.userId })
        .from(sessions)
        .where(eq(sessions.id, tokenHash))
        .limit(1);
      userId = sRow[0]?.userId;
    }
    getSessionCache().delete(tokenHash);
    if (userId) {
      invalidateUserSessionCache(userId);
      removeUserFromAllRoomsPresence(userId);
      await Promise.all([
        db.delete(sessions).where(eq(sessions.id, tokenHash)),
        db.delete(roomPlayers).where(eq(roomPlayers.userId, userId)),
      ]);
    } else {
      await db.delete(sessions).where(eq(sessions.id, tokenHash));
    }
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
