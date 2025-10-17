import { and, eq, ilike, or } from 'drizzle-orm';
import type { Request, Response } from 'express';
import { Router } from 'express';

import { db } from '../db/client';
import { users, type UserRole } from '../db/schema';

import { HttpError, ensureRoleAllowed, requireCurrentUser } from './utils/current-user';

const router = Router();

const MAINTAINER_VISIBLE_ROLES = new Set<UserRole>(['master', 'admin', 'sale']);

const normalizeOptionalString = (value: unknown) => (typeof value === 'string' ? value.trim() || null : null);

router.get('/search', async (req: Request, res: Response, next) => {
  try {
    const currentUser = await requireCurrentUser(req);
    ensureRoleAllowed(currentUser.role, MAINTAINER_VISIBLE_ROLES, '无权限查询维护人');

    const keyword = normalizeOptionalString(req.query.keyword);

    const baseCondition = eq(users.role, 'sale');
    let whereClause = baseCondition;

    if (keyword) {
      const likeKeyword = `%${keyword}%`;
      const searchCondition = or(ilike(users.name, likeKeyword), ilike(users.email, likeKeyword));
      const combined = and(baseCondition, searchCondition);
      if (!combined) {
        throw new HttpError(400, '查询条件无效');
      }
      whereClause = combined;
    }

    const results = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(whereClause);

    res.json(
      results.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email
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
