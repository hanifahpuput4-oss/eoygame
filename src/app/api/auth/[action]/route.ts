import { NextRequest } from 'next/server';
import { register, login, logout } from '@/server/services/auth-service';
import { registerSchema, loginSchema } from '@/server/middleware/validation';
import { ok, handleError } from '@/server/middleware/http';

export async function POST(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  try {
    const { action } = await ctx.params;
    const body = await req.json().catch(() => ({}));

    if (action === 'register') {
      const input = registerSchema.parse(body);
      const user = await register(input);
      return ok({ user }, 201);
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
