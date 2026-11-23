import { NextResponse, type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import type { Role } from '@/types';

// Page-level route protection (edge). API routes are protected independently in `lib/api.ts` —
// this middleware is a UX guard, the server-side checks are the security boundary.
const ALLOWED: Record<Role, string[]> = {
  ADMIN: ['*'],
  STAFF: ['/dashboard', '/customers', '/accounts', '/transactions', '/requests', '/loans', '/notifications'],
  CUSTOMER: ['/dashboard', '/accounts', '/transfer', '/transactions', '/requests', '/loans', '/notifications', '/profile'],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    const url = new URL('/login', req.url);
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }
  const role = token.role as Role;
  const rules = ALLOWED[role] ?? [];
  const ok = rules.includes('*') || rules.some((p) => pathname === p || pathname.startsWith(p + '/'));
  if (!ok) return NextResponse.redirect(new URL('/dashboard', req.url));
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/customers/:path*', '/accounts/:path*', '/transactions/:path*', '/requests/:path*', '/loans/:path*', '/transfer/:path*', '/notifications/:path*', '/profile/:path*', '/settings/:path*'],
};
