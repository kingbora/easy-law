import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password'];
const AUTH_BASE_URL = (process.env.NEXT_PUBLIC_AUTH_BASE_URL ?? 'http://localhost:4000/api/auth').replace(/\/$/, '');

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
    const sessionResponse = await fetch(`${AUTH_BASE_URL}/get-session`, {
      headers: {
        cookie: request.headers.get('cookie') ?? '',
        accept: 'application/json',
        'user-agent': request.headers.get('user-agent') ?? ''
      },
      cache: 'no-store',
      redirect: 'manual'
    });

    if (sessionResponse.ok) {
      const result = await sessionResponse.json().catch(() => null);
      const session = result?.session;
      const user = result?.user;

      if (session && user) {
        const response = NextResponse.next();
        const setCookie = sessionResponse.headers.get('set-cookie');
        if (setCookie) {
          const cookies = setCookie.split(/,(?=\s*[A-Za-z0-9_-]+=)/);
          cookies.forEach((cookie) => {
            if (cookie) {
              response.headers.append('set-cookie', cookie.trim());
            }
          });
        }
        return response;
      }
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
