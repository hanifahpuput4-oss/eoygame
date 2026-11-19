import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AuthError } from '@/server/auth/session';
import { AuthServiceError } from '@/server/services/auth-service';
import { ClassroomError } from '@/server/services/classroom-service';
import { QuestionError } from '@/server/services/question-service';
import { RoomError } from '@/server/services/room-service';

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleError(err: unknown) {
  if (err instanceof AuthError) {
    if (err.message === 'FORBIDDEN') return fail('Akses ditolak', 403);
    return fail('Silakan login terlebih dahulu', 401);
  }
  const domainErrors = [AuthServiceError, ClassroomError, QuestionError, RoomError];
  for (const E of domainErrors) {
    if (err instanceof E) return fail(err.message, (err as { status: number }).status);
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return fail(first ? `${first.path.join('.')}: ${first.message}` : 'Data tidak valid', 422);
  }
  console.error(err);
  return fail('Terjadi kesalahan pada server', 500);
}
