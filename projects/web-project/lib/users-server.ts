import { cache } from 'react';
import { cookies } from 'next/headers';

import { mapSingularPayload, type CurrentUserResponse } from './users-api';

interface SessionResponsePayload {
  user?: unknown;
  session?: Record<string, unknown> | null;
  permissions?: unknown;
}

const AUTH_BASE_URL = `${process.env.NEXT_PUBLIC_RESTFUL_BASE_URL ?? ''}/api/auth`;

function buildCookieHeader(): string | null {
  const cookieStore = cookies();
  const allCookies = cookieStore.getAll();
  if (!allCookies.length) {
    return null;
  }
  return allCookies.map((item) => `${item.name}=${item.value}`).join('; ');
}

async function requestSession(): Promise<SessionResponsePayload | null> {
  const cookieHeader = buildCookieHeader();
  if (!cookieHeader) {
    return null;
  }

  if (!AUTH_BASE_URL) {
    return null;
  }

  const sessionUrl = `${AUTH_BASE_URL}/get-session?disableCookieCache=true`;
  const requestHeaders = new Headers();
  requestHeaders.set('cookie', cookieHeader);
  requestHeaders.set('accept', 'application/json');

  const requestInit: RequestInit = {
    method: 'GET',
    headers: requestHeaders,
    cache: 'no-store',
    credentials: 'include'
  };

  const response = await fetch(sessionUrl, requestInit).catch(() => null);

  if (!response || !response.ok) {
    return null;
  }

  try {
    return (await response.json()) as SessionResponsePayload;
  } catch (error) {
    return null;
  }
}

export const fetchCurrentUserServer = cache(async (): Promise<CurrentUserResponse | null> => {
  const payload = await requestSession();
  if (!payload?.user) {
    return null;
  }

  try {
    const user = mapSingularPayload(payload, '获取当前用户信息失败：返回数据无效');
    const permissions = Array.isArray(payload.permissions)
      ? (payload.permissions as unknown[]).map((item) => String(item))
      : [];

    return {
      ...user,
      permissions
    } satisfies CurrentUserResponse;
  } catch (error) {
    return null;
  }
});
