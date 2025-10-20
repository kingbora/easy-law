import type { SQL } from 'drizzle-orm';
import { and, ilike, inArray, or } from 'drizzle-orm';
import type { Request, Response } from 'express';
import { Router } from 'express';

import { db } from '../db/client';
import { users, type UserRole } from '../db/schema';

import { HttpError, ensureRoleAllowed, requireCurrentUser } from './utils/current-user';

const router = Router();

const LAWYER_VISIBLE_ROLES = new Set<UserRole>(['master', 'admin', 'lawyer', 'assistant', 'administrative']);

const normalizeOptionalString = (value: unknown) => (typeof value === 'string' ? value.trim() || null : null);

router.get('/search', async (req: Request, res: Response, next) => {
  try {
    const currentUser = await requireCurrentUser(req);
    ensureRoleAllowed(currentUser.role, LAWYER_VISIBLE_ROLES, '无权限查询律师');

    const keyword = normalizeOptionalString(req.query.keyword);
    const roleCondition = inArray(users.role, ['lawyer', 'master', 'admin']);
    if (!roleCondition) {
      throw new HttpError(500, '查询条件构建失败');
    }
    let whereClause: SQL<unknown> = roleCondition;

    if (keyword) {
      const searchKeyword = `%${keyword}%`;
      const searchCondition = or(ilike(users.name, searchKeyword), ilike(users.email, searchKeyword));
      if (!searchCondition) {
        throw new HttpError(400, '查询条件无效');
      }
      const combined = and(whereClause, searchCondition);
      if (!combined) {
        throw new HttpError(400, '查询条件无效');
      }
      whereClause = combined;
    }

    const results = await db
      .select({ id: users.id, name: users.name, email: users.email, role: users.role })
      .from(users)
      .where(whereClause);

    const allowedRoles = new Set<UserRole>(['lawyer', 'master', 'admin']);
    const filtered = results.filter((user) => allowedRoles.has(user.role));

    res.json(
      filtered.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      }))
    );
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json({ message: error.message });
      return;
    }
    next(error);
  }
});

export default router;
