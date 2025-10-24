import { getSessionCookie } from 'better-auth/cookies';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/forgot-password'];

const isPublicPath = (pathname: string) =>
  PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (request.method !== 'GET') {
    return NextResponse.next();
  }

  if (isPublicPath(pathname) || pathname.startsWith('/api/') || pathname.startsWith('/_next/') || pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  try {
    const sessionCookie = getSessionCookie(request);

    if (sessionCookie) {
        return NextResponse.next();
    }
  } catch {
    // ignore network failures and fall back to redirect below
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/login';
  loginUrl.searchParams.set('redirect', `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
