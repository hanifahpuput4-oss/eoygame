import { NextRequest } from 'next/server';
import { z } from 'zod';
import { eq, and, ne, sql } from 'drizzle-orm';
import { db } from '@/db';
import { roomPlayers, users } from '@/db/schema';
import { requireUser } from '@/server/auth/session';
import { hashPassword, verifyPassword } from '@/server/auth/crypto';
import { moveSchema } from '@/server/middleware/validation';
import { ok, fail, handleError } from '@/server/middleware/http';

const avatarEnum = z.enum(['cat-blue', 'cat-pink', 'cat-green', 'cat-orange', 'cat-purple']);

export async function GET() {
  try {
    const user = await requireUser();
    return ok({
      profile: {
        id: user.id,
        email: user.email,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        avatar: user.avatar,
        totalPoints: user.totalPoints,
        totalStars: user.totalStars,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();

    if (body.action === 'move') {
      const input = moveSchema.parse(body);
      if (input.roomId) {
        await db
          .update(roomPlayers)
          .set({ lastX: input.x, lastY: input.y, lastFacing: input.facing })
          .where(and(eq(roomPlayers.roomId, input.roomId), eq(roomPlayers.userId, user.id)));
      }
      return ok({ ok: true, x: input.x, y: input.y, facing: input.facing });
    }

    if (body.action === 'avatar') {
      const { avatar } = z.object({ avatar: avatarEnum }).parse(body);
      await db.update(users).set({ avatar, updatedAt: new Date() }).where(eq(users.id, user.id));
      await db.update(roomPlayers).set({ avatar }).where(eq(roomPlayers.userId, user.id));
      return ok({ avatar });
    }

    if (body.action === 'update-profile') {
      const schema = z.object({
        fullName: z.string().trim().min(2, 'Nama lengkap minimal 2 karakter').max(80),
        username: z
          .string()
          .trim()
          .toLowerCase()
          .min(3, 'Username minimal 3 karakter')
          .max(30)
          .regex(/^[a-z0-9_.-]+$/, 'Username hanya boleh huruf kecil, angka, titik, strip, atau underscore'),
        avatar: avatarEnum.optional(),
      });
      const input = schema.parse(body);
      const dup = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(sql`lower(${users.username})`, input.username), ne(users.id, user.id)))
        .limit(1);
      if (dup[0]) {
        return fail('Username sudah digunakan pengguna lain', 409);
      }

      const nextAvatar = input.avatar ?? user.avatar;
      await db
        .update(users)
        .set({
          fullName: input.fullName,
          username: input.username,
          avatar: nextAvatar,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));
      if (input.avatar) {
        await db.update(roomPlayers).set({ avatar: input.avatar }).where(eq(roomPlayers.userId, user.id));
      }
      return ok({
        profile: {
          id: user.id,
          email: user.email,
          username: input.username,
          fullName: input.fullName,
          role: user.role,
          avatar: nextAvatar,
        },
      });
    }

    if (body.action === 'change-password') {
      const schema = z.object({
        currentPassword: z.string().min(1, 'Password lama wajib diisi'),
        newPassword: z.string().min(6, 'Password baru minimal 6 karakter').max(100),
      });
      const input = schema.parse(body);
      if (!verifyPassword(input.currentPassword, user.passwordHash)) {
        return fail('Password lama tidak sesuai', 400);
      }
      const passwordHash = hashPassword(input.newPassword);
      await db
        .update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.id, user.id));
      return ok({ success: true });
    }

    return handleError(new Error('Aksi tidak dikenal'));
  } catch (err) {
    return handleError(err);
  }
}
