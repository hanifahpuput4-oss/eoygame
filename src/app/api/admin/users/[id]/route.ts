import { NextRequest } from 'next/server';
import { z } from 'zod';
import { and, eq, ne, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { roomPlayers, sessions, users } from '@/db/schema';
import { invalidateUserSessionCache, requireRole } from '@/server/auth/session';
import { hashPassword } from '@/server/auth/crypto';
import { removeUserFromAllRoomsPresence } from '@/server/services/presence-store';
import { ok, fail, handleError } from '@/server/middleware/http';

const updateUserSchema = z.object({
  fullName: z.string().trim().min(2, 'Nama lengkap minimal 2 karakter').max(80).optional(),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Username minimal 3 karakter')
    .max(30)
    .regex(/^[a-z0-9_.-]+$/, 'Username hanya boleh huruf kecil, angka, titik, strip, atau underscore')
    .optional(),
  email: z.string().trim().toLowerCase().email('Email tidak valid').optional(),
  role: z.enum(['admin', 'teacher', 'student']).optional(),
  totalPoints: z.number().int().min(0).max(1000000).optional(),
  password: z.string().min(6, 'Password minimal 6 karakter').max(100).optional().or(z.literal('')),
});

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireRole('admin');
    const { id } = await ctx.params;
    const input = updateUserSchema.parse(await req.json());

    const existingRows = await db.select().from(users).where(eq(users.id, id)).limit(1);
    const existing = existingRows[0];
    if (!existing) return fail('User tidak ditemukan', 404);

    const nextUsername = input.username ?? existing.username;
    const nextEmail = input.email ?? existing.email;

    const dup = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          ne(users.id, id),
          or(
            eq(sql`lower(${users.username})`, nextUsername.toLowerCase()),
            eq(sql`lower(${users.email})`, nextEmail.toLowerCase()),
          ),
        ),
      )
      .limit(1);

    if (dup[0]) {
      return fail('Username atau email sudah digunakan pengguna lain', 409);
    }

    const patchData: Partial<typeof users.$inferInsert> = {
      fullName: input.fullName ?? existing.fullName,
      username: nextUsername,
      email: nextEmail,
      role: input.role ?? existing.role,
      totalPoints: input.totalPoints !== undefined ? input.totalPoints : existing.totalPoints,
      updatedAt: new Date(),
    };

    if (input.password && input.password.trim().length >= 6) {
      patchData.passwordHash = hashPassword(input.password.trim());
    }

    await db.update(users).set(patchData).where(eq(users.id, id));
    invalidateUserSessionCache(id);

    const updated = await db
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

    return ok({ user: updated[0] });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireRole('admin');
    const { id } = await ctx.params;

    if (id === admin.id) {
      return fail('Tidak dapat menghapus akun sendiri', 400);
    }

    invalidateUserSessionCache(id);
    removeUserFromAllRoomsPresence(id);
    await Promise.all([
      db.delete(sessions).where(eq(sessions.userId, id)),
      db.delete(roomPlayers).where(eq(roomPlayers.userId, id)),
    ]);
    await db.delete(users).where(eq(users.id, id));

    return ok({ success: true });
  } catch (err) {
    return handleError(err);
  }
}
