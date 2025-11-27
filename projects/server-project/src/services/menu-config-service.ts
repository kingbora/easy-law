import {
  DEFAULT_MENU_DATA_SOURCES,
  DEFAULT_TRIAL_STAGE_ORDER,
  TRIAL_STAGES,
  USER_DEPARTMENTS,
  type DepartmentMenuConfig,
  type TrialStage,
  type UpdateDepartmentMenuConfigPayload,
  type UserDepartment
} from '@easy-law/shared-types';
import { eq } from 'drizzle-orm';

import { db } from '../db/client';
import { departmentMenuConfigs } from '../db/schema/case-schema';
import type { SessionUser } from '../utils/auth-session';
import { AuthorizationError, BadRequestError } from '../utils/http-errors';

const ADMIN_ROLES = new Set<SessionUser['role']>(['super_admin', 'admin']);
const ALLOWED_DEPARTMENTS = new Set<UserDepartment>(USER_DEPARTMENTS);
const ALLOWED_TRIAL_STAGES = new Set<TrialStage>(TRIAL_STAGES);

type MenuConfigRow = typeof departmentMenuConfigs.$inferSelect;

type MaybeDepartment = UserDepartment | null | undefined;

type MaybeStringArray = string[] | null | undefined;

type MaybeTrialStageArray = TrialStage[] | string[] | null | undefined;

const DEFAULT_DATA_SOURCES_ARRAY: string[] = [...DEFAULT_MENU_DATA_SOURCES];
const DEFAULT_STAGE_ARRAY: TrialStage[] = [...DEFAULT_TRIAL_STAGE_ORDER];

function castDepartment(value: unknown): UserDepartment | null {
  if (typeof value !== 'string') {
    return null;
  }
  return ALLOWED_DEPARTMENTS.has(value as UserDepartment) ? (value as UserDepartment) : null;
}

function sanitizeDataSources(input?: MaybeStringArray): string[] {
  const source = Array.isArray(input) ? input : [];
  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const item of source) {
    if (typeof item !== 'string') {
      continue;
    }
    const trimmed = item.trim();
    if (!trimmed || seen.has(trimmed)) {
      continue;
    }
    seen.add(trimmed);
    cleaned.push(trimmed);
  }

  return cleaned.length > 0 ? cleaned : [...DEFAULT_DATA_SOURCES_ARRAY];
}

function sanitizeTrialStages(input?: MaybeTrialStageArray): TrialStage[] {
  const source = Array.isArray(input) ? input : [];
  const seen = new Set<TrialStage>();
  const cleaned: TrialStage[] = [];

  for (const item of source) {
    const stage = typeof item === 'string' && ALLOWED_TRIAL_STAGES.has(item as TrialStage) ? (item as TrialStage) : null;
    if (!stage || seen.has(stage)) {
      continue;
    }
    seen.add(stage);
    cleaned.push(stage);
  }

  return cleaned.length > 0 ? cleaned : [...DEFAULT_STAGE_ARRAY];
}

function buildDefaultConfig(department: UserDepartment): DepartmentMenuConfig {
  return {
    department,
    dataSources: [...DEFAULT_DATA_SOURCES_ARRAY],
    trialStages: [...DEFAULT_STAGE_ARRAY],
    updatedAt: null,
    updatedBy: null
  };
}

function mapRowToConfig(row: MenuConfigRow | null, fallbackDepartment: UserDepartment): DepartmentMenuConfig {
  if (!row) {
    return buildDefaultConfig(fallbackDepartment);
  }

  const updatedAt = row.updatedAt instanceof Date ? row.updatedAt.toISOString() : null;

  return {
    department: row.department as UserDepartment,
    dataSources: sanitizeDataSources(row.dataSources),
    trialStages: sanitizeTrialStages(row.trialStages as TrialStage[] | undefined),
    updatedBy: row.updatedBy ?? null,
    updatedAt
  };
}

function resolveDepartmentForWrite(user: SessionUser, requested?: MaybeDepartment): UserDepartment {
  if (!ADMIN_ROLES.has(user.role as SessionUser['role'])) {
    throw new AuthorizationError('您没有权限访问菜单配置');
  }

  if ((user.role as SessionUser['role']) === 'super_admin') {
    if (requested && ALLOWED_DEPARTMENTS.has(requested)) {
      return requested;
    }
    throw new BadRequestError('超级管理员请先选择要配置的部门');
  }

  const scopedDepartment = castDepartment(user.department);

  if (!scopedDepartment) {
    throw new AuthorizationError('管理员未设置所属部门，无法配置菜单');
  }

  if (requested && requested !== scopedDepartment) {
    throw new AuthorizationError('管理员仅可配置所属部门');
  }

  return scopedDepartment;
}

function resolveDepartmentForRead(user: SessionUser, requested?: MaybeDepartment): UserDepartment {
  if (requested && ALLOWED_DEPARTMENTS.has(requested)) {
    return requested;
  }

  const scopedDepartment = castDepartment(user.department);
  if (scopedDepartment) {
    return scopedDepartment;
  }

  throw new BadRequestError('请提供要查询的部门');
}

export async function getDepartmentMenuConfig(
  requestedDepartment: MaybeDepartment,
  user: SessionUser
): Promise<DepartmentMenuConfig> {
  const department = resolveDepartmentForRead(user, castDepartment(requestedDepartment));
  const existing = await db.query.departmentMenuConfigs.findFirst({
    where: eq(departmentMenuConfigs.department, department)
  });

  return mapRowToConfig(existing ?? null, department);
}

export async function updateDepartmentMenuConfig(
  requestedDepartment: MaybeDepartment,
  payload: UpdateDepartmentMenuConfigPayload,
  user: SessionUser
): Promise<DepartmentMenuConfig> {
  const department = resolveDepartmentForWrite(user, castDepartment(requestedDepartment));

  const existing = await db.query.departmentMenuConfigs.findFirst({
    where: eq(departmentMenuConfigs.department, department)
  });

  const nextDataSources = sanitizeDataSources(payload.dataSources ?? existing?.dataSources);
  const nextTrialStages = sanitizeTrialStages(
    (payload.trialStages as TrialStage[] | undefined) ?? (existing?.trialStages as TrialStage[] | undefined)
  );

  const [record] = await db
    .insert(departmentMenuConfigs)
    .values({
      department,
      dataSources: nextDataSources,
      trialStages: nextTrialStages,
      updatedBy: user.id
    })
    .onConflictDoUpdate({
      target: departmentMenuConfigs.department,
      set: {
        dataSources: nextDataSources,
        trialStages: nextTrialStages,
        updatedBy: user.id,
        updatedAt: new Date()
      }
    })
    .returning();

  return mapRowToConfig(record ?? null, department);
}
