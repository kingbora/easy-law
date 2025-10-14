import { fromNodeHeaders } from 'better-auth/node';
import { eq } from 'drizzle-orm';
import type { Request } from 'express';

import { auth } from '../../auth';
import { db } from '../../db/client';
import { users, type UserRole } from '../../db/schema';

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type CurrentUserRow = typeof users.$inferSelect;

export const requireCurrentUser = async (req: Request): Promise<CurrentUserRow> => {
  const headers = fromNodeHeaders(req.headers);
  const session = await auth.api.getSession({
    headers,
    asResponse: false,
    returnHeaders: false
  });

  const sessionUser = session?.user as { id?: string } | undefined;

  if (!sessionUser?.id) {
    throw new HttpError(401, '未登录或登录状态已过期');
  }

  const [currentUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, sessionUser.id))
    .limit(1);

  if (!currentUser) {
    throw new HttpError(401, '未找到当前用户信息');
  }

  return currentUser;
};

export const ensureRoleAllowed = (role: UserRole, allowedRoles: ReadonlySet<UserRole>, message: string) => {
  if (!allowedRoles.has(role)) {
    throw new HttpError(403, message);
  }
};
