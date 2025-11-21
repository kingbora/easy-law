import { cache } from 'react';
import { cookies } from 'next/headers';

import { authClient } from './auth-client';
import { mapSingularPayload, type CurrentUserResponse, type BetterAuthResponse } from './users-api';

interface SessionResponsePayload {
  user?: unknown;
  session?: Record<string, unknown> | null;
  permissions?: unknown;
}

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

  try {
    // 在服务端调用客户端 SDK 时需要手动转发 Cookie，否则 Better Auth 无法识别当前会话
    const requestHeaders = new Headers();
    requestHeaders.set('cookie', cookieHeader);
    requestHeaders.set('accept', 'application/json');

    const sessionResult = (await authClient.getSession({
      fetchOptions: {
        headers: requestHeaders,
        cache: 'no-store'
      }
    })) as BetterAuthResponse<SessionResponsePayload | null> | null;

    if (!sessionResult || sessionResult.error) {
      return null;
    }

    return sessionResult.data ?? null;
  } catch (error) {
    return null;
  }
}

export const fetchCurrentUserServer = cache(async (): Promise<CurrentUserResponse | null> => {
  const payload = await requestSession();
  if (!payload?.session) {
    return null;
  }
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
