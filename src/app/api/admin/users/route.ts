import { NextRequest } from 'next/server';
import { z } from 'zod';
import { desc, eq, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { requireRole } from '@/server/auth/session';
import { generateId, hashPassword } from '@/server/auth/crypto';
import { ok, fail, handleError } from '@/server/middleware/http';

const createUserSchema = z.object({
  fullName: z.string().trim().min(2, 'Nama lengkap minimal 2 karakter').max(80),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Username minimal 3 karakter')
    .max(30)
    .regex(/^[a-z0-9_.-]+$/, 'Username hanya boleh huruf kecil, angka, titik, strip, atau underscore'),
  email: z.string().trim().toLowerCase().email('Email tidak valid'),
  password: z.string().min(6, 'Password minimal 6 karakter').max(100),
  role: z.enum(['admin', 'teacher', 'student']),
  totalPoints: z.number().int().min(0).max(1000000).optional().default(0),
});

export async function GET() {
  try {
    const admin = await requireRole('admin');
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        fullName: users.fullName,
        role: users.role,
        avatar: users.avatar,
        totalPoints: users.totalPoints,
        totalStars: users.totalStars,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(desc(users.createdAt));

    return ok({
      users: rows,
      currentUser: {
        id: admin.id,
        username: admin.username,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireRole('admin');
    const input = createUserSchema.parse(await req.json());

    const dup = await db
      .select({ id: users.id })
      .from(users)
      .where(
        or(
          eq(sql`lower(${users.username})`, input.username),
          eq(sql`lower(${users.email})`, input.email),
        ),
      )
      .limit(1);

    if (dup[0]) {
      return fail('Username atau email sudah terdaftar', 409);
    }

    const id = generateId('usr');
    await db.insert(users).values({
      id,
      fullName: input.fullName,
      username: input.username,
      email: input.email,
      passwordHash: hashPassword(input.password),
      role: input.role,
      totalPoints: input.totalPoints ?? 0,
      avatar: 'cat-blue',
    });

    const created = await db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        fullName: users.fullName,
        role: users.role,
        avatar: users.avatar,
        totalPoints: users.totalPoints,
        totalStars: users.totalStars,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    return ok({ user: created[0] }, 201);
  } catch (err) {
    return handleError(err);
  }
}
