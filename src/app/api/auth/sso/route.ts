import { NextRequest, NextResponse } from 'next/server';
import { eq, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { createSession } from '@/server/auth/session';
import { hashPassword, generateId } from '@/server/auth/crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SiakadVerifyResponse {
  nisOrNip: string;
  nama: string;
  email: string | null;
  role: 'student' | 'teacher';
}

function safeRedirect(req: NextRequest): string {
  const next = req.nextUrl.searchParams.get('next');
  if (next && next.startsWith('/') && !next.startsWith('//')) return next;
  return '/';
}

// Bangun base URL dari header host (req.url di dev kadang jadi 0.0.0.0/https)
function baseUrl(req: NextRequest): string {
  const host = req.headers.get('host') || 'localhost:3000';
  const proto = req.headers.get('x-forwarded-proto') || (host.startsWith('localhost') || host.startsWith('127.') || host.startsWith('0.0.0.0') ? 'http' : 'https');
  return `${proto}://${host}`;
}

function loginRedirect(req: NextRequest, error: string): NextResponse {
  return NextResponse.redirect(new URL(`/login?sso_error=${error}`, baseUrl(req)));
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const redirectTarget = safeRedirect(req);

  if (!token) {
    return loginRedirect(req, 'missing_token');
  }

  const siakadUrl = process.env.SIAKAD_URL;
  const ssoSecret = process.env.SSO_SECRET;
  if (!siakadUrl || !ssoSecret) {
    return loginRedirect(req, 'not_configured');
  }

  // Tukar one-time token jadi data user di Siakad (server-to-server)
  let verifyRes: Response;
  try {
    verifyRes = await fetch(`${siakadUrl.replace(/\/$/, '')}/api/sso/verify?token=${encodeURIComponent(token)}`, {
      headers: { 'X-SSO-Secret': ssoSecret },
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    });
  } catch {
    return loginRedirect(req, 'siakad_unreachable');
  }

  if (!verifyRes.ok) {
    return loginRedirect(req, 'invalid_token');
  }

  let payload: SiakadVerifyResponse;
  try {
    payload = (await verifyRes.json()) as SiakadVerifyResponse;
  } catch {
    return loginRedirect(req, 'bad_response');
  }

  if (!payload || typeof payload.nisOrNip !== 'string' || !payload.nisOrNip.trim()) {
    return loginRedirect(req, 'bad_response');
  }
  if (payload.role !== 'student' && payload.role !== 'teacher') {
    return loginRedirect(req, 'bad_role');
  }

  const externalId = payload.nisOrNip.trim();
  const fullName = (payload.nama || externalId).trim().slice(0, 80);
  const email = (payload.email || '').trim().toLowerCase() || null;

  // Cari user berdasarkan externalId, lalu email (kalau Siakad kasih)
  let rows = await db.select().from(users).where(eq(users.externalId, externalId)).limit(1);
  if (rows.length === 0 && email) {
    rows = await db.select().from(users).where(eq(sql`lower(${users.email})`, email)).limit(1);
  }

  let userId: string;

  if (rows.length > 0) {
    // User sudah ada: pastikan externalId ke-link & role ikutin Siakad terbaru
    const existing = rows[0];
    userId = existing.id;
    const needsUpdate =
      existing.externalId !== externalId ||
      existing.role !== payload.role ||
      (fullName && existing.fullName !== fullName);
    if (needsUpdate) {
      await db
        .update(users)
        .set({
          externalId,
          role: payload.role,
          ...(fullName ? { fullName } : {}),
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
    }
  } else {
    // Auto-create akun (tanpa daftar manual)
    userId = generateId('usr');
    // Username unik dari externalId; kalau tabrakan, tambah suffix
    let username = externalId.toLowerCase().replace(/[^a-z0-9_.-]/g, '');
    if (!username) username = `user_${userId.slice(-6).toLowerCase()}`;
    const suffix = await db.select({ id: users.id }).from(users).where(eq(sql`lower(${users.username})`, username)).limit(1);
    if (suffix.length > 0) username = `${username}_${userId.slice(-4).toLowerCase()}`;

    // Password random (tidak bisa dipakai login manual karena tidak diketahui siapa pun)
    const randomPassword = `${generateId('pwd')}${Date.now()}`;
    const passwordHash = hashPassword(randomPassword);

    // Email unik: pakai dari Siakad kalau ada, kalau g ada buat placeholder
    const finalEmail = email || `${username}@siakad.local`;
    const emailTaken = await db.select({ id: users.id }).from(users).where(eq(sql`lower(${users.email})`, finalEmail)).limit(1);
    const safeEmail = emailTaken.length > 0 ? `${username}_${userId.slice(-4).toLowerCase()}@siakad.local` : finalEmail;

    await db.insert(users).values({
      id: userId,
      email: safeEmail,
      username,
      fullName,
      passwordHash,
      externalId,
      role: payload.role,
    });
  }

  await createSession(userId);
  return NextResponse.redirect(new URL(redirectTarget, baseUrl(req)));
}
