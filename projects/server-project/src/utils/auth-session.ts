import { fromNodeHeaders } from 'better-auth/node';
import type { Request as ExpressRequest } from 'express';

export interface SessionUser {
  id: string;
  role: string;
  email?: string | null;
  name?: string | null;
  department?: string | null;
  supervisorId?: string | null;
}

export interface SessionContext {
  user: SessionUser;
  session: {
    id: string;
    userId: string;
    expiresAt?: string;
    createdAt?: string;
    updatedAt?: string;
    token?: string;
  };
}

const AUTH_BASE_PATH = process.env.AUTH_BASE_PATH;

function buildRequestUrl(req: ExpressRequest): URL {
  const originHost = req.get('host') ?? 'localhost';
  const originProtocol = req.protocol ?? 'http';
  const origin = `${originProtocol}://${originHost}`;
  const normalizedBasePath = AUTH_BASE_PATH?.endsWith('/') ? AUTH_BASE_PATH.slice(0, -1) : AUTH_BASE_PATH;
  return new URL(`${normalizedBasePath}/get-session`, origin);
}

export async function fetchSessionFromRequest(req: ExpressRequest): Promise<SessionContext | null> {
  try {
    const headers = fromNodeHeaders(req.headers);
    // Ensure cookies are forwarded even if fromNodeHeaders filtered them
    if (req.headers.cookie && !headers.has('cookie')) {
      headers.set('cookie', req.headers.cookie);
    }

    const requestUrl = buildRequestUrl(req);
    requestUrl.searchParams.set('disableCookieCache', 'true');

    const response = await fetch(requestUrl, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response
      .json()
      .catch(() => null)) as { session?: Record<string, unknown>; user?: Record<string, unknown> } | null;

    if (!payload?.session || !payload?.user) {
      return null;
    }

    const session = payload.session;
    const user = payload.user;

    const id = typeof session.id === 'string' ? session.id : typeof session.token === 'string' ? session.token : '';
    const userId = typeof session.userId === 'string' ? session.userId : typeof user.id === 'string' ? user.id : '';

    if (!id || !userId) {
      return null;
    }

    return {
      session: {
        id,
        userId,
        token: typeof session.token === 'string' ? session.token : undefined,
        expiresAt: typeof session.expiresAt === 'string' ? session.expiresAt : undefined,
        createdAt: typeof session.createdAt === 'string' ? session.createdAt : undefined,
        updatedAt: typeof session.updatedAt === 'string' ? session.updatedAt : undefined
      },
      user: {
        id: typeof user.id === 'string' ? user.id : userId,
        role: typeof user.role === 'string' ? user.role : '',
        email: typeof user.email === 'string' ? user.email : null,
        name: typeof user.name === 'string' ? user.name : null,
        department: typeof user.department === 'string' ? user.department : null,
        supervisorId: typeof user.supervisorId === 'string' ? user.supervisorId : null
      }
    };
  } catch (error) {
    return null;
  }
}
