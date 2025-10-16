import { and, asc, eq, inArray, ne } from 'drizzle-orm';
import { Router, type Request, type Response } from 'express';

import { db } from '../db/client';
import {
  caseCategories,
  caseTypes,
  type CaseCategoryRow,
  type CaseTypeRow,
  type UserRole
} from '../db/schema';

import { HttpError, ensureRoleAllowed, requireCurrentUser } from './utils/current-user';

const router = Router();

const CASE_SETTINGS_READ_ROLES = new Set<UserRole>(['master', 'admin']);
const CASE_SETTINGS_MANAGE_ROLES = new Set<UserRole>(['master', 'admin']);

interface CaseCategoryPayload {
  id?: string;
  name: string;
}

interface CaseTypePayload {
  name: string;
  description?: string | null;
  categories?: CaseCategoryPayload[];
}

interface CaseTypeResponse {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  categories: Array<{
    id: string;
    name: string;
    sortIndex: number;
    isSystem: boolean;
    createdAt: string | null;
    updatedAt: string | null;
  }>;
}

const normalizeString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

const parseCaseTypePayload = (body: unknown): CaseTypePayload => {
  if (!body || typeof body !== 'object') {
    throw new HttpError(400, '请求体格式不正确');
  }

  const data = body as Record<string, unknown>;

  const name = normalizeString(data.name);
  if (!name) {
    throw new HttpError(400, '案件类型名称不能为空');
  }

  let description: string | null = null;
  if (typeof data.description === 'string') {
    description = data.description.trim() || null;
  }

  const categoriesData = Array.isArray(data.categories) ? data.categories : [];
  const categories: CaseCategoryPayload[] = [];

  for (const item of categoriesData) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const record = item as Record<string, unknown>;
    const categoryName = normalizeString(record.name);
    if (!categoryName) {
      continue;
    }
    const idValue = record.id;
    categories.push({
      id: typeof idValue === 'string' && idValue.trim().length > 0 ? idValue.trim() : undefined,
      name: categoryName
    });
  }

  return {
    name,
    description,
    categories
  };
};

const mapCaseTypeToResponse = (
  type: CaseTypeRow & { categories?: CaseCategoryRow[] }
): CaseTypeResponse => ({
  id: type.id,
  name: type.name,
  description: type.description ?? null,
  isSystem: type.isSystem,
  createdAt: type.createdAt?.toISOString() ?? null,
  updatedAt: type.updatedAt?.toISOString() ?? null,
  categories:
    type.categories?.map((category) => ({
      id: category.id,
      name: category.name,
      sortIndex: category.sortIndex ?? 0,
      isSystem: category.isSystem,
      createdAt: category.createdAt?.toISOString() ?? null,
      updatedAt: category.updatedAt?.toISOString() ?? null
    })) ?? []
});

router.get('/', async (req: Request, res: Response, next) => {
  try {
    const currentUser = await requireCurrentUser(req);
    ensureRoleAllowed(currentUser.role, CASE_SETTINGS_READ_ROLES, '无权限查看案件设置');

    const types = await db
      .select()
      .from(caseTypes)
      .orderBy(asc(caseTypes.createdAt));

    const typeIds = types.map((item) => item.id);
    const categories = typeIds.length
      ? await db
          .select()
          .from(caseCategories)
          .where(inArray(caseCategories.caseTypeId, typeIds))
          .orderBy(asc(caseCategories.sortIndex), asc(caseCategories.createdAt))
      : [];

    const grouped = new Map<string, CaseCategoryRow[]>();
    for (const category of categories) {
      const list = grouped.get(category.caseTypeId) ?? [];
      list.push(category);
      grouped.set(category.caseTypeId, list);
    }

    const response = types.map((type) =>
      mapCaseTypeToResponse({
        ...type,
        categories: grouped.get(type.id) ?? []
      })
    );

    res.json(response);
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
    ensureRoleAllowed(currentUser.role, CASE_SETTINGS_MANAGE_ROLES, '无权限维护案件设置');

    const payload = parseCaseTypePayload(req.body);

    const [conflict] = await db
      .select({ id: caseTypes.id })
      .from(caseTypes)
      .where(eq(caseTypes.name, payload.name))
      .limit(1);

    if (conflict) {
      throw new HttpError(409, '案件类型名称已存在');
    }

    const result = await db.transaction(async (trx) => {
      const [createdType] = await trx
        .insert(caseTypes)
        .values({
          name: payload.name,
          description: payload.description ?? null,
          isSystem: false
        })
        .returning();

      if (!createdType) {
        throw new HttpError(500, '创建案件类型失败');
      }

      if (payload.categories && payload.categories.length > 0) {
        await trx.insert(caseCategories).values(
          payload.categories.map((category, index) => ({
            caseTypeId: createdType.id,
            name: category.name,
            sortIndex: index,
            isSystem: false
          }))
        );
      }

      const categoriesForType = await trx
        .select()
        .from(caseCategories)
        .where(eq(caseCategories.caseTypeId, createdType.id))
        .orderBy(asc(caseCategories.sortIndex), asc(caseCategories.createdAt));

      return mapCaseTypeToResponse({ ...createdType, categories: categoriesForType });
    });

    res.status(201).json(result);
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
    ensureRoleAllowed(currentUser.role, CASE_SETTINGS_MANAGE_ROLES, '无权限维护案件设置');

    const caseTypeId = req.params.id;
    const payload = parseCaseTypePayload(req.body);

    const [existingType] = await db
      .select()
      .from(caseTypes)
      .where(eq(caseTypes.id, caseTypeId))
      .limit(1);

    if (!existingType) {
      throw new HttpError(404, '案件类型不存在');
    }

    if (existingType.isSystem && payload.name !== existingType.name) {
      throw new HttpError(400, '系统内置案件类型不可重命名');
    }

    if (!existingType.isSystem) {
      const [conflict] = await db
        .select({ id: caseTypes.id })
        .from(caseTypes)
        .where(and(eq(caseTypes.name, payload.name), ne(caseTypes.id, caseTypeId)))
        .limit(1);

      if (conflict) {
        throw new HttpError(409, '案件类型名称已存在');
      }
    }

    const updated = await db.transaction(async (trx) => {
      await trx
        .update(caseTypes)
        .set({
          name: payload.name,
          description: payload.description ?? null,
          updatedAt: new Date()
        })
        .where(eq(caseTypes.id, caseTypeId));

      const existingCategories = await trx
        .select()
        .from(caseCategories)
        .where(eq(caseCategories.caseTypeId, caseTypeId));

      const existingMap = new Map(existingCategories.map((item) => [item.id, item] as const));
      const incoming = (payload.categories ?? []).map((category, index) => ({
        id: category.id,
        name: category.name,
        sortIndex: index
      }));

      const incomingIds = incoming
        .map((item) => item.id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0);

      for (const systemCategory of existingCategories.filter((item) => item.isSystem)) {
        if (!incomingIds.includes(systemCategory.id)) {
          throw new HttpError(400, `系统内置分类「${systemCategory.name}」不可删除`);
        }
        const incomingMatch = incoming.find((item) => item.id === systemCategory.id);
        if (incomingMatch && incomingMatch.name !== systemCategory.name) {
          throw new HttpError(400, `系统内置分类「${systemCategory.name}」不可重命名`);
        }
      }

      const toDelete = existingCategories
        .filter((item) => !incomingIds.includes(item.id))
        .map((item) => item.id);

      if (toDelete.length > 0) {
        await trx
          .delete(caseCategories)
          .where(inArray(caseCategories.id, toDelete));
      }

      for (const item of incoming) {
        if (item.id && existingMap.has(item.id)) {
          await trx
            .update(caseCategories)
            .set({
              name: item.name,
              sortIndex: item.sortIndex,
              updatedAt: new Date()
            })
            .where(eq(caseCategories.id, item.id));
        } else {
          await trx.insert(caseCategories).values({
            caseTypeId,
            name: item.name,
            sortIndex: item.sortIndex,
            isSystem: false
          });
        }
      }

      const freshCategories = await trx
        .select()
        .from(caseCategories)
        .where(eq(caseCategories.caseTypeId, caseTypeId))
        .orderBy(asc(caseCategories.sortIndex), asc(caseCategories.createdAt));

      const [nextType] = await trx
        .select()
        .from(caseTypes)
        .where(eq(caseTypes.id, caseTypeId))
        .limit(1);

      if (!nextType) {
        throw new HttpError(500, '更新案件类型失败');
      }

      return mapCaseTypeToResponse({ ...nextType, categories: freshCategories });
    });

    res.json(updated);
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
    ensureRoleAllowed(currentUser.role, CASE_SETTINGS_MANAGE_ROLES, '无权限维护案件设置');

    const caseTypeId = req.params.id;

    const [existing] = await db
      .select({ id: caseTypes.id, isSystem: caseTypes.isSystem })
      .from(caseTypes)
      .where(eq(caseTypes.id, caseTypeId))
      .limit(1);

    if (!existing) {
      throw new HttpError(404, '案件类型不存在');
    }

    if (existing.isSystem) {
      throw new HttpError(400, '系统内置案件类型不可删除');
    }

    await db.delete(caseTypes).where(eq(caseTypes.id, caseTypeId));

    res.status(204).send();
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json({ message: error.message });
      return;
    }
    next(error);
  }
});

export default router;
