import { and, eq, notInArray } from 'drizzle-orm';

import { db } from '../client';
import { permissions, rolePermissions, type UserRole } from '../schema';

const PERMISSION_DEFINITIONS = [
  {
    code: 'menu.dashboard',
    name: '仪表盘菜单',
    category: 'menu' as const,
    description: '访问仪表盘页面'
  },
  {
    code: 'menu.team',
    name: '团队管理菜单',
    category: 'menu' as const,
    description: '访问团队管理页面'
  },
  {
    code: 'action.team.read',
    name: '团队管理查看',
    category: 'action' as const,
    description: '查看团队成员列表'
  },
  {
    code: 'action.team.manage',
    name: '团队成员管理',
    category: 'action' as const,
    description: '创建、更新或删除团队成员'
  }
];

const ROLE_PERMISSION_MAP: Record<UserRole, string[]> = {
  master: PERMISSION_DEFINITIONS.map((item) => item.code),
  admin: ['menu.dashboard', 'menu.team', 'action.team.read', 'action.team.manage'],
  sale: ['menu.dashboard'],
  lawyer: ['menu.dashboard'],
  assistant: ['menu.dashboard']
};

export const ensureDefaultPermissions = async () => {
  await db.transaction(async (trx) => {
    for (const definition of PERMISSION_DEFINITIONS) {
      await trx
        .insert(permissions)
        .values({
          code: definition.code,
          name: definition.name,
          category: definition.category,
          description: definition.description
        })
        .onConflictDoUpdate({
          target: permissions.code,
          set: {
            name: definition.name,
            category: definition.category,
            description: definition.description,
            updatedAt: new Date()
          }
        });
    }

    for (const role of Object.keys(ROLE_PERMISSION_MAP) as UserRole[]) {
      const assigned = ROLE_PERMISSION_MAP[role];

      if (assigned.length === 0) {
        await trx.delete(rolePermissions).where(eq(rolePermissions.role, role));
        continue;
      }

      await trx
        .delete(rolePermissions)
        .where(
          and(
            eq(rolePermissions.role, role),
            notInArray(rolePermissions.permissionCode, assigned)
          )
        );

      await trx
        .insert(rolePermissions)
        .values(
          assigned.map((code) => ({
            role,
            permissionCode: code
          }))
        )
        .onConflictDoNothing();
    }
  });
};
