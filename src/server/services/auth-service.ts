import { eq, or } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { hashPassword, verifyPassword, generateId } from '@/server/auth/crypto';
import { createSession, destroySession } from '@/server/auth/session';
import type { RegisterInput, LoginInput } from '@/server/middleware/validation';

export class AuthServiceError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export async function register(input: RegisterInput) {
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(
      or(eq(users.email, input.email.toLowerCase()), eq(users.username, input.username)),
    )
    .limit(1);

  if (existing.length > 0) {
    throw new AuthServiceError('Email atau username sudah terdaftar', 409);
  }

  if (input.role === 'teacher') {
    const expected = process.env.TEACHER_INVITE_CODE;
    if (!expected || input.inviteCode !== expected) {
      throw new AuthServiceError('Kode undangan guru tidak valid', 403);
    }
  }

  const id = generateId('usr');
  await db.insert(users).values({
    id,
    email: input.email.toLowerCase(),
    username: input.username,
    fullName: input.fullName,
    passwordHash: hashPassword(input.password),
    role: input.role,
  });

  await createSession(id);
  const user = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return publicUser(user[0]);
}

export async function login(input: LoginInput) {
  const rows = await db
    .select()
    .from(users)
    .where(eq(users.email, input.email.toLowerCase()))
    .limit(1);

  const user = rows[0];
  if (!user || !verifyPassword(input.password, user.passwordHash)) {
    throw new AuthServiceError('Email atau password salah', 401);
  }

  await createSession(user.id);
  return publicUser(user);
}

export async function logout() {
  await destroySession();
}

export function publicUser(user: typeof users.$inferSelect) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    avatar: user.avatar,
    totalPoints: user.totalPoints,
    totalStars: user.totalStars,
  };
}
