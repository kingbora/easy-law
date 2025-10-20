import { desc, eq, inArray } from 'drizzle-orm';
import type { Request, Response } from 'express';
import { Router } from 'express';

import { auth } from '../auth';
import { db } from '../db/client';
import { rolePermissions, userDepartmentEnum, userGenderEnum, users, userRoleEnum } from '../db/schema';

import { HttpError, requireCurrentUser } from './utils/current-user';

type UserRow = typeof users.$inferSelect;

type UserRoleValue = (typeof userRoleEnum.enumValues)[number];
type UserGenderValue = (typeof userGenderEnum.enumValues)[number];
type UserDepartmentValue = (typeof userDepartmentEnum.enumValues)[number];

const router = Router();

const DEFAULT_INITIAL_PASSWORD = 'a@000123';
const roleSet = new Set<UserRoleValue>(userRoleEnum.enumValues);
const genderSet = new Set<UserGenderValue>(userGenderEnum.enumValues);
const departmentSet = new Set<UserDepartmentValue>(userDepartmentEnum.enumValues);

const MANAGER_ROLES = new Set<UserRoleValue>(['master', 'admin']);
const ADMIN_RESTRICTED_ROLES: UserRoleValue[] = ['master', 'admin'];
const ADMIN_ASSIGNABLE_ROLES: UserRoleValue[] = ['sale', 'lawyer', 'assistant', 'administrative'];
const SUPERVISOR_ALLOWED_ROLES = new Set<UserRoleValue>(['lawyer']);

const toUserResponse = (
  row: UserRow,
  options?: {
    supervisor?: { id: string; name: string | null } | null;
  }
) => ({
  id: row.id,
  name: row.name ?? '',
  email: row.email,
  role: row.role,
  image: row.image ?? null,
  gender: row.gender ?? null,
  department: row.department ?? null,
  supervisor: options?.supervisor ?? (row.supervisorId ? { id: row.supervisorId, name: null } : null),
  createdAt: row.createdAt ? row.createdAt.toISOString() : null,
  updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null
});

const getPermissionsForRole = async (role: UserRoleValue) => {
  const rows = await db
    .select({ code: rolePermissions.permissionCode })
    .from(rolePermissions)
    .where(eq(rolePermissions.role, role));

  return rows.map((item) => item.code);
};

const ensureTeamAccess = (user: UserRow) => {
  if (!MANAGER_ROLES.has(user.role)) {
    throw new HttpError(403, '无权限访问团队成员数据');
  }
};

const ensureAdminCanAssignRole = (user: UserRow, targetRole: UserRoleValue) => {
  if (user.role === 'admin' && ADMIN_RESTRICTED_ROLES.includes(targetRole)) {
    throw new HttpError(403, '管理员无法创建或调整为该角色');
  }
};

const ensureAdminCanModifyTarget = (user: UserRow, target: UserRow) => {
  if (user.role === 'admin' && ADMIN_RESTRICTED_ROLES.includes(target.role)) {
    throw new HttpError(403, '管理员无法操作该成员');
  }
};

router.get('/me', async (req: Request, res: Response, next) => {
  try {
    const currentUser = await requireCurrentUser(req);
    const permissionCodes = await getPermissionsForRole(currentUser.role);

    let supervisorInfo: { id: string; name: string | null } | null = null;
    if (currentUser.supervisorId) {
      const [supervisor] = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(eq(users.id, currentUser.supervisorId))
        .limit(1);
      supervisorInfo = supervisor ? { id: supervisor.id, name: supervisor.name ?? null } : null;
    }

    res.json({
      ...toUserResponse(currentUser, { supervisor: supervisorInfo }),
      permissions: permissionCodes
    });
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json({ message: error.message });
      return;
    }
    next(error);
  }
});

router.get('/', async (req: Request, res: Response, next) => {
  try {
    const currentUser = await requireCurrentUser(req);
    ensureTeamAccess(currentUser);

    const baseQuery = db.select().from(users);
    const filteredQuery =
      currentUser.role === 'admin'
        ? baseQuery.where(inArray(users.role, ADMIN_ASSIGNABLE_ROLES))
        : baseQuery;

    const rows = await filteredQuery.orderBy(desc(users.createdAt));
    const nameMap = new Map(rows.map((item) => [item.id, item.name ?? null]));
    res.json(
      rows.map((row) =>
        toUserResponse(row, {
          supervisor: row.supervisorId ? { id: row.supervisorId, name: nameMap.get(row.supervisorId) ?? null } : null
        })
      )
    );
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json({ message: error.message });
      return;
    }
    next(error);
  }
});

router.post('/', async (req: Request, res: Response, next) => {
  try {
    const currentUser = await requireCurrentUser(req);
    ensureTeamAccess(currentUser);

    const { name, email, role, gender, department, supervisorId } = req.body ?? {};

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

    ensureAdminCanAssignRole(currentUser, sanitizedRole);

    let normalizedGender: UserGenderValue | null = null;
    if (typeof gender === 'string') {
      const trimmedGender = gender.trim().toLowerCase();
      if (trimmedGender) {
        if (!genderSet.has(trimmedGender as UserGenderValue)) {
          return res.status(400).json({ message: '性别取值不合法' });
        }
        normalizedGender = trimmedGender as UserGenderValue;
      }
    } else if (gender === null || gender === undefined) {
      normalizedGender = null;
    } else if (gender !== undefined) {
      return res.status(400).json({ message: '性别取值不合法' });
    }

    let normalizedDepartment: UserDepartmentValue | null = null;
    if (typeof department === 'string') {
      const trimmedDepartment = department.trim();
      if (trimmedDepartment) {
        if (!departmentSet.has(trimmedDepartment as UserDepartmentValue)) {
          return res.status(400).json({ message: '部门取值不合法' });
        }
        normalizedDepartment = trimmedDepartment as UserDepartmentValue;
      }
    } else if (department === null || department === undefined) {
      normalizedDepartment = null;
    } else {
      return res.status(400).json({ message: '部门取值不合法' });
    }

    let normalizedSupervisorId: string | null = null;
    let supervisorRecord: { id: string; name: string | null } | null = null;
    if (typeof supervisorId === 'string') {
      const trimmedSupervisorId = supervisorId.trim();
      if (trimmedSupervisorId) {
        if (sanitizedRole === 'master') {
          return res.status(400).json({ message: '超级管理员无需设置直属上级' });
        }
        const [supervisor] = await db
          .select({ id: users.id, role: users.role, name: users.name })
          .from(users)
          .where(eq(users.id, trimmedSupervisorId))
          .limit(1);

        if (!supervisor) {
          return res.status(400).json({ message: '直属上级不存在' });
        }

        if (!SUPERVISOR_ALLOWED_ROLES.has(supervisor.role)) {
          return res.status(400).json({ message: '直属上级必须为律师角色' });
        }

        normalizedSupervisorId = supervisor.id;
        supervisorRecord = { id: supervisor.id, name: supervisor.name ?? null };
      }
    } else if (supervisorId === null || supervisorId === undefined) {
      normalizedSupervisorId = null;
    } else {
      return res.status(400).json({ message: '直属上级取值不合法' });
    }

    if (sanitizedRole === 'master') {
      normalizedDepartment = null;
      normalizedSupervisorId = null;
      supervisorRecord = null;
    } else if (!normalizedDepartment) {
      return res.status(400).json({ message: '请为该成员选择所属部门' });
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
      .set({
        role: sanitizedRole,
        gender: normalizedGender,
        department: normalizedDepartment,
        supervisorId: normalizedSupervisorId,
        updatedAt: new Date()
      })
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
      ...toUserResponse(createdUser, { supervisor: supervisorRecord }),
      initialPassword: DEFAULT_INITIAL_PASSWORD
    };

    return res.status(201).json(responsePayload);
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json({ message: error.message });
      return;
    }
    next(error);
  }
});

router.put('/:id', async (req: Request, res: Response, next) => {
  try {
    const currentUser = await requireCurrentUser(req);
    ensureTeamAccess(currentUser);

    const { id } = req.params;
    const { name, email, role, image, gender, department, supervisorId } = req.body ?? {};

    if (!id) {
      return res.status(400).json({ message: '缺少成员ID' });
    }

    const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);

    if (!target) {
      return res.status(404).json({ message: '成员不存在' });
    }

    ensureAdminCanModifyTarget(currentUser, target);

    const updateData: Partial<UserRow> & { updatedAt?: Date } = {};
    let supervisorRecord: { id: string; name: string | null } | null = null;

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
      ensureAdminCanAssignRole(currentUser, normalizedRole);
      updateData.role = normalizedRole;
    }

    if (typeof image === 'string') {
      updateData.image = image;
    } else if (image === null) {
      updateData.image = null;
    }

    if (typeof gender === 'string') {
      const trimmedGender = gender.trim().toLowerCase();
      if (trimmedGender) {
        if (!genderSet.has(trimmedGender as UserGenderValue)) {
          return res.status(400).json({ message: '性别取值不合法' });
        }
        updateData.gender = trimmedGender as UserGenderValue;
      } else {
        updateData.gender = null;
      }
    } else if (gender === null) {
      updateData.gender = null;
    } else if (gender !== undefined) {
      return res.status(400).json({ message: '性别取值不合法' });
    }

    if (department !== undefined) {
      if (typeof department === 'string') {
        const trimmedDepartment = department.trim();
        if (trimmedDepartment) {
          if (!departmentSet.has(trimmedDepartment as UserDepartmentValue)) {
            return res.status(400).json({ message: '部门取值不合法' });
          }
          updateData.department = trimmedDepartment as UserDepartmentValue;
        } else {
          updateData.department = null;
        }
      } else if (department === null) {
        updateData.department = null;
      } else {
        return res.status(400).json({ message: '部门取值不合法' });
      }
    }

    if (supervisorId !== undefined) {
      if (typeof supervisorId === 'string') {
        const trimmedSupervisorId = supervisorId.trim();
        if (trimmedSupervisorId) {
          if (trimmedSupervisorId === id) {
            return res.status(400).json({ message: '成员不能设置自己为直属上级' });
          }

          const [supervisor] = await db
            .select({ id: users.id, role: users.role, name: users.name, supervisorId: users.supervisorId })
            .from(users)
            .where(eq(users.id, trimmedSupervisorId))
            .limit(1);

          if (!supervisor) {
            return res.status(400).json({ message: '直属上级不存在' });
          }

          if (!SUPERVISOR_ALLOWED_ROLES.has(supervisor.role)) {
            return res.status(400).json({ message: '直属上级必须为律师角色' });
          }

          if (supervisor.supervisorId && supervisor.supervisorId === id) {
            return res.status(400).json({ message: '直属上级不能为该成员的下属' });
          }

          updateData.supervisorId = supervisor.id;
          supervisorRecord = { id: supervisor.id, name: supervisor.name ?? null };
        } else {
          updateData.supervisorId = null;
        }
      } else if (supervisorId === null) {
        updateData.supervisorId = null;
      } else {
        return res.status(400).json({ message: '直属上级取值不合法' });
      }
    }

    const finalRole = (updateData.role ?? target.role) as UserRoleValue;
    const finalDepartment = updateData.department !== undefined ? updateData.department : target.department;
    const finalSupervisorId = updateData.supervisorId !== undefined ? updateData.supervisorId : target.supervisorId;

    if (finalRole === 'master') {
      if (finalSupervisorId) {
        updateData.supervisorId = null;
      }
    } else if (!finalDepartment) {
      return res.status(400).json({ message: '请为该成员选择所属部门' });
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

    let supervisorInfo: { id: string; name: string | null } | null = supervisorRecord;
    const resolvedSupervisorId = updateData.supervisorId !== undefined ? updateData.supervisorId : target.supervisorId;
    if (!supervisorInfo && resolvedSupervisorId) {
      const [supervisor] = await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(eq(users.id, resolvedSupervisorId))
        .limit(1);
      supervisorInfo = supervisor ? { id: supervisor.id, name: supervisor.name ?? null } : null;
    }

    return res.json(toUserResponse(updated, { supervisor: supervisorInfo }));
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json({ message: error.message });
      return;
    }
    next(error);
  }
});

router.delete('/:id', async (req: Request, res: Response, next) => {
  try {
    const currentUser = await requireCurrentUser(req);
    ensureTeamAccess(currentUser);
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({ message: '缺少成员ID' });
    }

    const [target] = await db.select().from(users).where(eq(users.id, id)).limit(1);

    if (!target) {
      return res.status(404).json({ message: '成员不存在' });
    }

    ensureAdminCanModifyTarget(currentUser, target);

    const [deleted] = await db.delete(users).where(eq(users.id, id)).returning();

    if (!deleted) {
      return res.status(404).json({ message: '成员不存在' });
    }

    return res.status(204).send();
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json({ message: error.message });
      return;
    }
    next(error);
  }
});

export default router;
