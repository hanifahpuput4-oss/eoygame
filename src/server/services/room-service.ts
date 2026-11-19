import { and, eq, count, desc } from 'drizzle-orm';
import { db } from '@/db';
import {
  classroomMembers,
  classrooms,
  gameEvents,
  gameSessions,
  levels,
  roomPlayers,
  rooms,
  users,
} from '@/db/schema';
import { generateCode, generateId } from '@/server/auth/crypto';
import type { RoomInput } from '@/server/middleware/validation';

export class RoomError extends Error {
  constructor(
    message: string,
    public status: number = 400,
  ) {
    super(message);
  }
}

export async function createRoom(hostId: string, input: RoomInput) {
  const membership = await db
    .select({ id: classroomMembers.id })
    .from(classroomMembers)
    .where(
      and(
        eq(classroomMembers.classroomId, input.classroomId),
        eq(classroomMembers.studentId, hostId),
      ),
    )
    .limit(1);
  void membership;

  const id = generateId('room');
  await db.insert(rooms).values({
    id,
    hostId,
    classroomId: input.classroomId,
    levelId: input.levelId,
    name: input.name,
    code: generateCode(6),
    maxPlayers: input.maxPlayers,
    settings: JSON.stringify(input.settings),
    status: 'waiting',
  });
  return getRoom(id);
}

export async function getRoom(id: string) {
  const rows = await db.select().from(rooms).where(eq(rooms.id, id)).limit(1);
  if (!rows[0]) throw new RoomError('Ruang tidak ditemukan', 404);
  return withDetails(rows[0]);
}

export async function getRoomByCode(code: string) {
  const rows = await db.select().from(rooms).where(eq(rooms.code, code)).limit(1);
  if (!rows[0]) throw new RoomError('Kode ruang tidak ditemukan', 404);
  return withDetails(rows[0]);
}

async function withDetails(room: typeof rooms.$inferSelect) {
  const players = await db
    .select({
      id: roomPlayers.id,
      userId: roomPlayers.userId,
      username: users.username,
      fullName: users.fullName,
      avatar: roomPlayers.avatar,
      role: users.role,
      lastX: roomPlayers.lastX,
      lastY: roomPlayers.lastY,
      lastFacing: roomPlayers.lastFacing,
      ready: roomPlayers.ready,
    })
    .from(roomPlayers)
    .innerJoin(users, eq(roomPlayers.userId, users.id))
    .where(eq(roomPlayers.roomId, room.id));

  const [level, classroom] = await Promise.all([
    db.select().from(levels).where(eq(levels.id, room.levelId)).limit(1),
    db.select().from(classrooms).where(eq(classrooms.id, room.classroomId)).limit(1),
  ]);

  return {
    ...room,
    settings: JSON.parse(room.settings || '{}'),
    players,
    level: level[0] ?? null,
    classroom: classroom[0] ?? null,
  };
}

export async function updateRoomStatus(
  id: string,
  hostId: string,
  status: 'waiting' | 'starting' | 'in_progress' | 'paused' | 'completed',
) {
  await assertHost(id, hostId);
  await db
    .update(rooms)
    .set({
      status,
      updatedAt: new Date(),
      startedAt: status === 'in_progress' ? new Date() : undefined,
      endedAt: status === 'completed' ? new Date() : undefined,
    })
    .where(eq(rooms.id, id));
  return getRoom(id);
}

export async function removePlayer(roomId: string, hostId: string, playerId: string) {
  await assertHost(roomId, hostId);
  await db
    .delete(roomPlayers)
    .where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.userId, playerId)));
}

export async function listTeacherRooms(hostId: string) {
  const rows = await db
    .select()
    .from(rooms)
    .where(eq(rooms.hostId, hostId))
    .orderBy(desc(rooms.createdAt));
  return Promise.all(rows.map(withDetails));
}

export async function joinRoom(code: string, userId: string, avatar: string, role: string) {
  const room = await getRoomByCode(code);

  if (role !== 'teacher' && room.status !== 'in_progress') {
    throw new RoomError(
      room.status === 'waiting'
        ? 'Game belum dimulai oleh guru. Tunggu guru menekan "Mulai Game".'
        : 'Ruang game sudah berakhir.',
      409,
    );
  }
  const existing = await db
    .select({ id: roomPlayers.id })
    .from(roomPlayers)
    .where(and(eq(roomPlayers.roomId, room.id), eq(roomPlayers.userId, userId)))
    .limit(1);

  if (existing.length === 0 && room.players.length >= room.maxPlayers) {
    throw new RoomError('Ruang sudah penuh', 409);
  }

  const membership = await db
    .select({ id: classroomMembers.id })
    .from(classroomMembers)
    .where(
      and(
        eq(classroomMembers.classroomId, room.classroomId),
        eq(classroomMembers.studentId, userId),
      ),
    )
    .limit(1);
  if (membership.length === 0 && role !== 'teacher') {
    throw new RoomError('Anda belum tergabung di kelas ruang ini', 403);
  }

  if (existing.length === 0) {
    await db.insert(roomPlayers).values({
      id: generateId('rpl'),
      roomId: room.id,
      userId,
      avatar,
    });
  }
  return getRoom(room.id);
}

export async function leaveRoom(roomId: string, userId: string) {
  await db
    .delete(roomPlayers)
    .where(and(eq(roomPlayers.roomId, roomId), eq(roomPlayers.userId, userId)));
}

export async function assertHost(roomId: string, hostId: string) {
  const rows = await db
    .select({ hostId: rooms.hostId })
    .from(rooms)
    .where(eq(rooms.id, roomId))
    .limit(1);
  if (!rows[0]) throw new RoomError('Ruang tidak ditemukan', 404);
  if (rows[0].hostId !== hostId) throw new RoomError('Hanya host yang dapat melakukan ini', 403);
}

export async function logEvent(roomId: string, userId: string | null, eventType: string, payload: unknown) {
  await db.insert(gameEvents).values({
    id: generateId('evt'),
    roomId,
    userId,
    eventType,
    payload: JSON.stringify(payload),
  });
}

export async function countPlayers(roomId: string) {
  const rows = await db
    .select({ total: count() })
    .from(roomPlayers)
    .where(eq(roomPlayers.roomId, roomId));
  return rows[0]?.total ?? 0;
}

export async function ensureSession(roomId: string, userId: string, levelId: string) {
  const existing = await db
    .select()
    .from(gameSessions)
    .where(and(eq(gameSessions.roomId, roomId), eq(gameSessions.userId, userId)))
    .limit(1);
  if (existing[0]) return existing[0];

  const id = generateId('gsn');
  await db.insert(gameSessions).values({ id, roomId, userId, levelId });
  const rows = await db.select().from(gameSessions).where(eq(gameSessions.id, id)).limit(1);
  return rows[0];
}
