import { desc, eq } from 'drizzle-orm';
import type { Request, Response } from 'express';
import { Router } from 'express';

import { auth } from '../auth';
import env from '../config/env';
import { db } from '../db/client';
import { users, userRoleEnum } from '../db/schema';

type UserRow = typeof users.$inferSelect;

type UserRoleValue = (typeof userRoleEnum.enumValues)[number];

const router = Router();

const DEFAULT_INITIAL_PASSWORD = env.defaultUserPassword ?? 'a@000123';
const roleSet = new Set<UserRoleValue>(userRoleEnum.enumValues);

const toUserResponse = (row: UserRow) => ({
  id: row.id,
  name: row.name ?? '',
  email: row.email,
  role: row.role,
  image: row.image ?? null,
  createdAt: row.createdAt ? row.createdAt.toISOString() : null,
  updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null
});

router.get('/', async (_req: Request, res: Response, next) => {
  try {
    const rows = await db.select().from(users).orderBy(desc(users.createdAt));
    res.json(rows.map(toUserResponse));
  } catch (error) {
    next(error);
  }
});

router.post('/', async (req: Request, res: Response, next) => {
  try {
    const { name, email, role } = req.body ?? {};

    const sanitizedName = typeof name === 'string' ? name.trim() : '';
    const sanitizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const sanitizedRole = typeof role === 'string' ? (role.trim() as UserRoleValue) : undefined;

    if (!sanitizedName) {
      return res.status(400).json({ message: '成员名称不能为空' });
    }

    if (!sanitizedEmail) {
      return res.status(400).json({ message: '成员邮箱不能为空' });
    }

    if (!sanitizedRole || !roleSet.has(sanitizedRole)) {
      return res.status(400).json({ message: '角色类型不合法' });
    }

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, sanitizedEmail))
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({ message: '该邮箱已被使用' });
    }

    await auth.api.signUpEmail({
      body: {
        email: sanitizedEmail,
        password: DEFAULT_INITIAL_PASSWORD,
        name: sanitizedName,
        image: undefined
      },
      asResponse: false
    });

    const [created] = await db
      .update(users)
      .set({ role: sanitizedRole, updatedAt: new Date() })
      .where(eq(users.email, sanitizedEmail))
      .returning();

    const createdUser = created ?? (await db
      .select()
      .from(users)
      .where(eq(users.email, sanitizedEmail))
      .limit(1))[0];

    if (!createdUser) {
      return res.status(500).json({ message: '创建成员失败，请稍后重试' });
    }

    const responsePayload = {
      ...toUserResponse(createdUser),
      initialPassword: DEFAULT_INITIAL_PASSWORD
    };

    return res.status(201).json(responsePayload);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;
    const { name, email, role, image } = req.body ?? {};

    if (!id) {
      return res.status(400).json({ message: '缺少成员ID' });
    }

    const updateData: Partial<UserRow> & { updatedAt?: Date } = {};

    if (typeof name === 'string') {
      const trimmedName = name.trim();
      if (!trimmedName) {
        return res.status(400).json({ message: '成员名称不能为空' });
      }
      updateData.name = trimmedName;
    }

    if (typeof email === 'string') {
      const trimmedEmail = email.trim().toLowerCase();
      if (!trimmedEmail) {
        return res.status(400).json({ message: '成员邮箱不能为空' });
      }

      const duplicate = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, trimmedEmail))
        .limit(1);

      if (duplicate.length > 0 && duplicate[0]?.id !== id) {
        return res.status(409).json({ message: '该邮箱已被使用' });
      }

      updateData.email = trimmedEmail;
    }

    if (typeof role === 'string') {
      const normalizedRole = role.trim() as UserRoleValue;
      if (!roleSet.has(normalizedRole)) {
        return res.status(400).json({ message: '角色类型不合法' });
      }
      updateData.role = normalizedRole;
    }

    if (typeof image === 'string') {
      updateData.image = image;
    } else if (image === null) {
      updateData.image = null;
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: '未提供可更新的字段' });
    }

    updateData.updatedAt = new Date();

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();

    if (!updated) {
      return res.status(404).json({ message: '成员不存在' });
    }

    return res.json(toUserResponse(updated));
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: '缺少成员ID' });
    }

    const [deleted] = await db.delete(users).where(eq(users.id, id)).returning();

    if (!deleted) {
      return res.status(404).json({ message: '成员不存在' });
    }

    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
