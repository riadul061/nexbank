import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { eq } from 'drizzle-orm';
import { z, ZodError } from 'zod';
import { authOptions } from '@/lib/auth';
import { db } from '@/db';
import { users } from '@/db/schema';
import { ApiError, forbidden, pgError, unauthorized } from '@/lib/errors';
import type { Role } from '@/types';

export interface AuthUser { id: string; name: string; email: string; role: Role }
type Ctx<P> = { req: NextRequest; user: AuthUser; params: P };

/**
 * Wraps a route handler with: authentication, a fresh DB check of the user's status and role
 * (the JWT is never trusted for authority), role-based authorization, and uniform error handling.
 * Authorization therefore lives on the server for every endpoint.
 */
export function route<P = Record<string, string>>(roles: Role[] | 'any', fn: (ctx: Ctx<P>) => Promise<unknown>) {
  return async (req: NextRequest, segment: { params: Promise<P> }) => {
    try {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) throw unauthorized();
      const [u] = await db.select({ id: users.id, name: users.name, email: users.email, role: users.role, status: users.status })
        .from(users).where(eq(users.id, session.user.id)).limit(1);
      if (!u) throw unauthorized('Session is no longer valid');
      if (u.status !== 'ACTIVE') throw new ApiError(403, 'Your account has been deactivated or blocked. Contact the bank.', 'ACCOUNT_DISABLED');
      if (roles !== 'any' && !roles.includes(u.role)) throw forbidden();
      const params = (await segment.params) ?? ({} as P);
      const result = await fn({ req, user: { id: u.id, name: u.name, email: u.email, role: u.role }, params });
      if (result instanceof Response) return result;
      return NextResponse.json(result ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown) {
  if (e instanceof ApiError) return NextResponse.json({ error: e.message, code: e.code, details: e.details }, { status: e.status });
  if (e instanceof ZodError) {
    const first = e.issues[0];
    const msg = first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid input';
    return NextResponse.json({ error: msg, code: 'VALIDATION', details: e.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) }, { status: 422 });
  }
  const pg = pgError(e);
  if (pg?.code === '23514') return NextResponse.json({ error: 'Operation rejected by a database integrity rule', code: 'INTEGRITY' }, { status: 409 });
  console.error('[api] unhandled', e);
  return NextResponse.json({ error: 'Something went wrong. Please try again.', code: 'INTERNAL' }, { status: 500 });
}

export async function body<T extends z.ZodType>(req: NextRequest, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try { raw = await req.json(); } catch { throw new ApiError(400, 'Request body must be valid JSON', 'BAD_JSON'); }
  return schema.parse(raw);
}
export function query<T extends z.ZodType>(req: NextRequest, schema: T): z.infer<T> {
  return schema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));
}
export const amountSchema = z.coerce.number().positive('Amount must be greater than zero').max(10_000_000)
  .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, 'Amount can have at most 2 decimal places');
