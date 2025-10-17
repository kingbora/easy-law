import { asc, eq } from 'drizzle-orm';
import type { Request, Response } from 'express';
import { Router } from 'express';

import { db } from '../db/client';
import { permissions, rolePermissions, userRoleEnum, type PermissionCategory, type UserRole } from '../db/schema';

import { ensureRoleAllowed, HttpError, requireCurrentUser } from './utils/current-user';

const router = Router();

const ROLE_LABELS: Record<UserRole, string> = {
  master: '超级管理员',
  admin: '管理员',
  sale: '销售',
  lawyer: '律师',
  assistant: '业务助理'
};

const ROLE_DESCRIPTIONS: Partial<Record<UserRole, string>> = {
  master: '系统最高权限，默认拥有所有能力',
  admin: '运营或管理员角色，可管理团队与业务数据',
  sale: '销售成员，用于客户拓展与跟进',
  lawyer: '律师成员，可处理案件业务',
  assistant: '业务助理，用于协同案件和客户'
};

const EDITABLE_ROLES = new Set<UserRole>(['admin', 'sale', 'lawyer', 'assistant']);

type PermissionDefinition = {
  code: string;
  name: string;
  category: PermissionCategory;
  description: string | null;
};

type UpdateAssignmentsPayload = {
  assignments?: Array<{
    role: string;
    permissions: string[];
  }>;
};

const buildAssignmentsMap = (rows: Array<{ role: UserRole; permissionCode: string }>) => {
  const assignments = {} as Record<UserRole, string[]>;

  for (const role of userRoleEnum.enumValues) {
    assignments[role] = [];
  }

  for (const row of rows) {
    assignments[row.role]?.push(row.permissionCode);
  }

  for (const role of Object.keys(assignments) as UserRole[]) {
    assignments[role] = Array.from(new Set(assignments[role] ?? [])).sort();
  }

  return assignments;
};

router.get('/', async (req: Request, res: Response, next) => {
  try {
    const currentUser = await requireCurrentUser(req);
    ensureRoleAllowed(currentUser.role, new Set<UserRole>(['master']), '仅超级管理员可访问权限管理');

    const permissionRows = await db
      .select()
      .from(permissions)
      .orderBy(asc(permissions.category), asc(permissions.code));

    const assignmentRows = await db.select().from(rolePermissions);
    const assignments = buildAssignmentsMap(assignmentRows);

    const response = {
      roles: userRoleEnum.enumValues.map((role) => ({
        role,
        label: ROLE_LABELS[role],
        description: ROLE_DESCRIPTIONS[role] ?? null,
        editable: EDITABLE_ROLES.has(role)
      })),
      permissions: permissionRows.map<PermissionDefinition>((item) => ({
        code: item.code,
        name: item.name,
        category: item.category,
        description: item.description ?? null
      })),
      assignments
    };

    res.json(response);
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json({ message: error.message });
      return;
    }
    next(error);
  }
});

router.put('/assignments', async (req: Request, res: Response, next) => {
  try {
    const currentUser = await requireCurrentUser(req);
    ensureRoleAllowed(currentUser.role, new Set<UserRole>(['master']), '仅超级管理员可调整权限');

    const payload = req.body as UpdateAssignmentsPayload | undefined;
    const assignments = Array.isArray(payload?.assignments) ? payload?.assignments ?? [] : null;

    if (!assignments) {
      throw new HttpError(400, '请求体格式不正确');
    }

    const allPermissionRows = await db.select({ code: permissions.code }).from(permissions);
    const knownCodes = new Set(allPermissionRows.map((item) => item.code));

    const entries: Array<{ role: UserRole; permissions: string[] }> = [];

    for (const entry of assignments) {
      if (!entry || typeof entry.role !== 'string' || !Array.isArray(entry.permissions)) {
        throw new HttpError(400, '权限分配数据格式不正确');
      }

      const normalizedRole = entry.role.trim() as UserRole;

      if (!EDITABLE_ROLES.has(normalizedRole)) {
        throw new HttpError(400, '仅支持调整特定角色的权限');
      }

      const cleanedCodes = Array.from(
        new Set(
          entry.permissions
            .map((code) => (typeof code === 'string' ? code.trim() : ''))
            .filter((code) => code.length > 0)
        )
      );

      for (const code of cleanedCodes) {
        if (!knownCodes.has(code)) {
          throw new HttpError(400, `权限编码 ${code} 不存在`);
        }
      }

      entries.push({ role: normalizedRole, permissions: cleanedCodes });
    }

    await db.transaction(async (trx) => {
      for (const { role, permissions: codes } of entries) {
        await trx.delete(rolePermissions).where(eq(rolePermissions.role, role));

        if (codes.length > 0) {
          await trx.insert(rolePermissions).values(
            codes.map((code) => ({
              role,
              permissionCode: code
            }))
          );
        }
      }
    });

    res.json({ success: true });
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json({ message: error.message });
      return;
    }
    next(error);
  }
});

export default router;
