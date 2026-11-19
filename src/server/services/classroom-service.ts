import { eq, and, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { classroomMembers, classrooms, users } from '@/db/schema';
import { generateCode, generateId } from '@/server/auth/crypto';

export class ClassroomError extends Error {
  constructor(
    message: string,
    public status: number = 400,
  ) {
    super(message);
  }
}

export async function createClassroom(
  teacherId: string,
  data: { name: string; subject: string; grade: string; description: string },
) {
  const id = generateId('cls');
  await db.insert(classrooms).values({ id, teacherId, ...data, joinCode: generateCode(6) });
  const rows = await db.select().from(classrooms).where(eq(classrooms.id, id)).limit(1);
  return rows[0];
}

export async function listClassrooms(teacherId: string) {
  return db.select().from(classrooms).where(eq(classrooms.teacherId, teacherId));
}

export async function getClassroomForTeacher(id: string, teacherId: string) {
  const rows = await db
    .select()
    .from(classrooms)
    .where(and(eq(classrooms.id, id), eq(classrooms.teacherId, teacherId)))
    .limit(1);
  if (!rows[0]) throw new ClassroomError('Kelas tidak ditemukan', 404);
  return rows[0];
}

export async function updateClassroom(
  id: string,
  teacherId: string,
  data: Partial<{ name: string; subject: string; grade: string; description: string }>,
) {
  await getClassroomForTeacher(id, teacherId);
  await db
    .update(classrooms)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(classrooms.id, id));
  return getClassroomForTeacher(id, teacherId);
}

export async function deleteClassroom(id: string, teacherId: string) {
  await getClassroomForTeacher(id, teacherId);
  await db.delete(classrooms).where(eq(classrooms.id, id));
}

export async function regenerateJoinCode(id: string, teacherId: string) {
  await getClassroomForTeacher(id, teacherId);
  const code = generateCode(6);
  await db.update(classrooms).set({ joinCode: code }).where(eq(classrooms.id, id));
  return code;
}

export async function listStudents(classroomId: string, teacherId: string) {
  await getClassroomForTeacher(classroomId, teacherId);
  const members = await db
    .select({ userId: classroomMembers.studentId })
    .from(classroomMembers)
    .where(eq(classroomId ? classroomMembers.classroomId : classroomMembers.classroomId, classroomId));
  if (members.length === 0) return [];
  const ids = members.map((m) => m.userId);
  return db
    .select({
      id: users.id,
      username: users.username,
      fullName: users.fullName,
      avatar: users.avatar,
      totalPoints: users.totalPoints,
      totalStars: users.totalStars,
    })
    .from(users)
    .where(inArray(users.id, ids));
}

export async function joinClassroom(code: string, studentId: string) {
  const rows = await db.select().from(classrooms).where(eq(classrooms.joinCode, code)).limit(1);
  const classroom = rows[0];
  if (!classroom) throw new ClassroomError('Kode kelas tidak ditemukan', 404);

  const existing = await db
    .select({ id: classroomMembers.id })
    .from(classroomMembers)
    .where(
      and(
        eq(classroomMembers.classroomId, classroom.id),
        eq(classroomMembers.studentId, studentId),
      ),
    )
    .limit(1);

  if (existing.length === 0) {
    await db.insert(classroomMembers).values({
      id: generateId('cmb'),
      classroomId: classroom.id,
      studentId,
    });
  }
  return classroom;
}

export async function listStudentClassrooms(studentId: string) {
  const memberships = await db
    .select({ classroomId: classroomMembers.classroomId })
    .from(classroomMembers)
    .where(eq(classroomMembers.studentId, studentId));
  if (memberships.length === 0) return [];
  return db
    .select()
    .from(classrooms)
    .where(
      inArray(
        classrooms.id,
        memberships.map((m) => m.classroomId),
      ),
    );
}
