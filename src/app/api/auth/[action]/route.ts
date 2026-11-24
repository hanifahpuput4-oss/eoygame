import { NextRequest } from 'next/server';
import { login, logout } from '@/server/services/auth-service';
import { getCurrentUser } from '@/server/auth/session';
import { loginSchema } from '@/server/middleware/validation';
import { ok, fail, handleError } from '@/server/middleware/http';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  try {
    const { action } = await ctx.params;
    if (action === 'check') {
      const user = await getCurrentUser();
      if (!user) return fail('SESSION_REPLACED', 401);
      return ok({ authenticated: true, userId: user.id });
    }
    return fail('Unknown auth action', 404);
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  try {
    const { action } = await ctx.params;
    if (action === 'check') {
      const user = await getCurrentUser();
      if (!user) return fail('SESSION_REPLACED', 401);
      return ok({ authenticated: true, userId: user.id });
    }
    const body = await req.json().catch(() => ({}));

    if (action === 'register') {
      // Pendaftaran manual dinonaktifkan: semua user masuk via SSO Siakad
      return fail('Pendaftaran akun baru dinonaktifkan. Masuk lewat akun Siakad.', 403);
    }
    if (action === 'login') {
      const input = loginSchema.parse(body);
      const user = await login(input);
      return ok({ user });
    }
    if (action === 'logout') {
      await logout();
      return ok({ success: true });
    }
    return handleError(new Error('Unknown auth action'));
  } catch (err) {
    return handleError(err);
  }
}
