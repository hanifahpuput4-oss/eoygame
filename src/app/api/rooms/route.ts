import { NextRequest } from 'next/server';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db } from '@/db';
import { roomPlayers } from '@/db/schema';
import { requireUser } from '@/server/auth/session';
import { createRoom, listTeacherRooms, joinRoom, getRoom, getRoomByCode, assertHost } from '@/server/services/room-service';
import { listClassrooms } from '@/server/services/classroom-service';
import { listLevels } from '@/server/services/level-service';
import { roomSchema, joinRoomSchema } from '@/server/middleware/validation';
import { ok, fail, handleError } from '@/server/middleware/http';
import { generateId } from '@/server/auth/crypto';
import {
  addRejoinRequest,
  consumeRejoinRejection,
  getRejoinRequests,
  isPlayerKicked,
} from '@/server/services/presence-store';
import { publishToRoom } from '@/server/services/realtime-service';

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const isAdmin = user.role === 'admin';
    if (user.role === 'teacher' || isAdmin) {
      const bootstrap = req.nextUrl.searchParams.get('bootstrap') === '1';
      if (bootstrap) {
        const [rooms, classrooms, levels] = await Promise.all([
          listTeacherRooms(user.id, isAdmin),
          listClassrooms(user.id, isAdmin),
          listLevels(user.id, isAdmin),
        ]);
        return ok({ rooms, classrooms, levels });
      }
      return ok({ rooms: await listTeacherRooms(user.id, isAdmin) });
    }
    return ok({ rooms: [] });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();

    if ((user.role === 'teacher' || user.role === 'admin') && !body?.code) {
      const input = roomSchema.parse(body);
      const room = await createRoom(user.id, input);
      return ok({ room }, 201);
    }

    const { code } = joinRoomSchema.parse(body);
    const targetRoom = await getRoomByCode(code);
    if (user.role === 'student' && isPlayerKicked(targetRoom.id, user.id)) {
      addRejoinRequest(targetRoom.id, { userId: user.id, username: user.username });
      void publishToRoom(targetRoom.id, 'rejoin-request', {
        requests: getRejoinRequests(targetRoom.id),
      });
      return ok({ room: targetRoom, kicked: true }, 201);
    }

    const room = await joinRoom(code, user.id, user.avatar, user.role);
    return ok({ room }, 201);
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const { roomId } = z.object({ roomId: z.string().min(1) }).parse(body);

    if (user.role === 'teacher' || user.role === 'admin') {
      await assertHost(roomId, user.id);
      const existing = await db
        .select({ id: roomPlayers.id })
        .from(roomPlayers)
        .where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.userId, user.id)))
        .limit(1);
      if (existing.length === 0) {
        await db.insert(roomPlayers).values({
          id: generateId('rpl'),
          roomId,
          userId: user.id,
          avatar: user.avatar,
        });
      }
      return ok({ room: await getRoom(roomId) }, 201);
    }

    const room = await getRoom(roomId);
    if (room.status !== 'in_progress') {
      return fail(
        room.status === 'waiting'
          ? 'Game belum dimulai oleh guru'
          : 'Ruang game sudah berakhir',
        409,
      );
    }
    const existing = await db
      .select({ id: roomPlayers.id })
      .from(roomPlayers)
      .where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.userId, user.id)))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(roomPlayers).values({
        id: generateId('rpl'),
        roomId,
        userId: user.id,
        avatar: user.avatar,
      });
    }
    return ok({ room: await getRoom(roomId) }, 201);
  } catch (err) {
    return handleError(err);
  }
}
