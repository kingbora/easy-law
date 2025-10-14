import { randomUUID } from 'node:crypto';

import { and, desc, eq, ilike, sql } from 'drizzle-orm';
import type { Request, Response } from 'express';
import { Router } from 'express';

import { db } from '../db/client';
import {
  clientAttachments,
  clientCompanies,
  clients,
  clientGenderEnum,
  clientIndividuals,
  clientSourceEnum,
  clientStatusEnum,
  clientTypeEnum,
  type ClientSource,
  type ClientStatus,
  type ClientType,
  users,
  type UserRole
} from '../db/schema';

import { HttpError, ensureRoleAllowed, requireCurrentUser, type CurrentUserRow } from './utils/current-user';

const router = Router();

const CLIENT_READ_ROLES = new Set<UserRole>(['master', 'admin', 'lawyer', 'assistant']);
const CLIENT_MANAGE_ROLES = new Set<UserRole>(['master', 'admin', 'lawyer']);
const CLIENT_ASSIGN_ALL_ROLES = new Set<UserRole>(['master', 'admin']);

const clientTypeSet = new Set<ClientType>(clientTypeEnum.enumValues);
const clientStatusSet = new Set<ClientStatus>(clientStatusEnum.enumValues);
const clientSourceSet = new Set<ClientSource>(clientSourceEnum.enumValues);
const clientGenderSet = new Set(clientGenderEnum.enumValues);

interface AttachmentInput {
  filename: string;
  fileUrl: string;
  fileType?: string | null;
  description?: string | null;
}

interface IndividualProfileInput {
  idCardNumber: string;
  gender?: 'male' | 'female' | null;
  occupation?: string | null;
}

interface CompanyProfileInput {
  unifiedCreditCode: string;
  companyType?: string | null;
  industry?: string | null;
  registeredCapital?: string | number | null;
  legalRepresentative?: string | null;
}

interface ClientPayload {
  name: string;
  type: ClientType;
  phone: string;
  email?: string | null;
  address?: string | null;
  source?: ClientSource | null;
  sourceRemark?: string | null;
  status?: ClientStatus | null;
  responsibleLawyerId?: string;
  tags?: string[];
  remark?: string | null;
  individualProfile?: IndividualProfileInput | null;
  companyProfile?: CompanyProfileInput | null;
  attachments?: AttachmentInput[];
}

const normalizeString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const normalizeOptionalString = (value: unknown) => (typeof value === 'string' ? value.trim() || null : null);

const normalizeStringArray = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }
  const items = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item) => item.length > 0);
  return items.length > 0 ? items : null;
};

const parseClientPayload = (body: unknown): ClientPayload => {
  if (!body || typeof body !== 'object') {
    throw new HttpError(400, '请求体格式不正确');
  }

  const data = body as Record<string, unknown>;
  const typeValue = normalizeString(data.type);
  if (!clientTypeSet.has(typeValue as ClientType)) {
    throw new HttpError(400, '客户类型不合法');
  }

  const name = normalizeString(data.name);
  const phone = normalizeString(data.phone);

  if (!name) {
    throw new HttpError(400, '客户名称不能为空');
  }

  if (!phone) {
    throw new HttpError(400, '联系电话不能为空');
  }

  const statusValue = normalizeOptionalString(data.status);
  if (statusValue && !clientStatusSet.has(statusValue as ClientStatus)) {
    throw new HttpError(400, '客户状态不合法');
  }

  const sourceValue = normalizeOptionalString(data.source);
  if (sourceValue && !clientSourceSet.has(sourceValue as ClientSource)) {
    throw new HttpError(400, '客户来源不合法');
  }

  const payload: ClientPayload = {
    name,
    type: typeValue as ClientType,
    phone,
    email: normalizeOptionalString(data.email),
    address: normalizeOptionalString(data.address),
    source: sourceValue ? (sourceValue as ClientSource) : null,
    sourceRemark: normalizeOptionalString(data.sourceRemark),
    status: statusValue ? (statusValue as ClientStatus) : null,
    responsibleLawyerId: normalizeOptionalString(data.responsibleLawyerId) ?? undefined,
    tags: normalizeStringArray(data.tags) ?? undefined,
    remark: normalizeOptionalString(data.remark),
    attachments: parseAttachments(data.attachments)
  };

  if (payload.type === 'individual') {
    payload.individualProfile = parseIndividualProfile(data.individualProfile);
  } else {
    payload.companyProfile = parseCompanyProfile(data.companyProfile);
  }

  return payload;
};

const parseAttachments = (value: unknown): AttachmentInput[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const items: AttachmentInput[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const record = item as Record<string, unknown>;
    const filename = normalizeString(record.filename);
    const fileUrl = normalizeString(record.fileUrl);
    if (!filename || !fileUrl) {
      continue;
    }
    items.push({
      filename,
      fileUrl,
      fileType: normalizeOptionalString(record.fileType),
      description: normalizeOptionalString(record.description)
    });
  }
  return items.length > 0 ? items : undefined;
};

const parseIndividualProfile = (value: unknown): IndividualProfileInput => {
  if (!value || typeof value !== 'object') {
    throw new HttpError(400, '请填写自然人客户信息');
  }
  const record = value as Record<string, unknown>;
  const idCardNumber = normalizeString(record.idCardNumber);
  if (!idCardNumber) {
    throw new HttpError(400, '身份证号不能为空');
  }
  const gender = normalizeOptionalString(record.gender);
  if (gender && !clientGenderSet.has(gender as (typeof clientGenderEnum.enumValues)[number])) {
    throw new HttpError(400, '性别信息不合法');
  }
  return {
    idCardNumber,
    gender: gender ? (gender as 'male' | 'female') : undefined,
    occupation: normalizeOptionalString(record.occupation) ?? undefined
  };
};

const parseCompanyProfile = (value: unknown): CompanyProfileInput => {
  if (!value || typeof value !== 'object') {
    throw new HttpError(400, '请填写企业客户信息');
  }
  const record = value as Record<string, unknown>;
  const unifiedCreditCode = normalizeString(record.unifiedCreditCode);
  if (!unifiedCreditCode) {
    throw new HttpError(400, '统一社会信用代码不能为空');
  }
  const registeredCapitalValue = record.registeredCapital as unknown;
  let registeredCapital: string | number | null | undefined = undefined;
  if (typeof registeredCapitalValue === 'number' || typeof registeredCapitalValue === 'string') {
    registeredCapital = registeredCapitalValue;
  } else if (registeredCapitalValue === null) {
    registeredCapital = null;
  }

  return {
    unifiedCreditCode,
    companyType: normalizeOptionalString(record.companyType) ?? undefined,
    industry: normalizeOptionalString(record.industry) ?? undefined,
    registeredCapital,
    legalRepresentative: normalizeOptionalString(record.legalRepresentative) ?? undefined
  };
};

const deriveGenderFromIdCard = (idCard: string): 'male' | 'female' | null => {
  const normalized = idCard.trim();
  if (!/^\d{17}[\dXx]$/.test(normalized)) {
    return null;
  }
  const genderDigit = Number.parseInt(normalized.charAt(16), 10);
  if (Number.isNaN(genderDigit)) {
    return null;
  }
  return genderDigit % 2 === 0 ? 'female' : 'male';
};

const ensureManageAccessForClient = (currentUser: CurrentUserRow, existing: typeof clients.$inferSelect) => {
  ensureRoleAllowed(currentUser.role, CLIENT_MANAGE_ROLES, '无权限维护客户信息');
  if (!CLIENT_ASSIGN_ALL_ROLES.has(currentUser.role) && existing.responsibleLawyerId !== currentUser.id) {
    throw new HttpError(403, '无权限操作该客户');
  }
};

const ensureManageTarget = (currentUser: CurrentUserRow, responsibleLawyerId?: string) => {
  ensureRoleAllowed(currentUser.role, CLIENT_MANAGE_ROLES, '无权限维护客户信息');
  if (!responsibleLawyerId) {
    throw new HttpError(400, '负责律师不能为空');
  }
  if (!CLIENT_ASSIGN_ALL_ROLES.has(currentUser.role) && responsibleLawyerId !== currentUser.id) {
    throw new HttpError(403, '仅可维护自己负责的客户');
  }
};

const fetchClientDetail = async (clientId: string, currentUser: CurrentUserRow) => {
  const [client] = await db
    .select({
      id: clients.id,
      name: clients.name,
      type: clients.type,
      phone: clients.phone,
      email: clients.email,
      address: clients.address,
      source: clients.source,
      sourceRemark: clients.sourceRemark,
      status: clients.status,
      responsibleLawyerId: clients.responsibleLawyerId,
      tags: clients.tags,
      remark: clients.remark,
      createdAt: clients.createdAt,
      updatedAt: clients.updatedAt,
      responsibleLawyerName: users.name
    })
    .from(clients)
    .leftJoin(users, eq(users.id, clients.responsibleLawyerId))
    .where(eq(clients.id, clientId))
    .limit(1);

  if (!client) {
    throw new HttpError(404, '客户不存在');
  }

  if (!CLIENT_ASSIGN_ALL_ROLES.has(currentUser.role) && client.responsibleLawyerId !== currentUser.id) {
    throw new HttpError(403, '无权限查看该客户');
  }

  const [individualProfile] = await db
    .select()
    .from(clientIndividuals)
    .where(eq(clientIndividuals.clientId, clientId))
    .limit(1);

  const [companyProfile] = await db
    .select()
    .from(clientCompanies)
    .where(eq(clientCompanies.clientId, clientId))
    .limit(1);

  const attachmentsList = await db
    .select({
      id: clientAttachments.id,
      filename: clientAttachments.filename,
      fileType: clientAttachments.fileType,
      fileUrl: clientAttachments.fileUrl,
      description: clientAttachments.description,
      uploadedAt: clientAttachments.uploadedAt,
      uploadedBy: clientAttachments.uploadedBy
    })
    .from(clientAttachments)
    .where(eq(clientAttachments.clientId, clientId))
    .orderBy(desc(clientAttachments.uploadedAt));

  return {
    id: client.id,
    name: client.name,
    type: client.type,
    phone: client.phone,
    email: client.email,
    address: client.address,
    source: client.source,
    sourceRemark: client.sourceRemark,
    status: client.status,
    responsibleLawyer: {
      id: client.responsibleLawyerId,
      name: client.responsibleLawyerName ?? null
    },
    tags: client.tags ?? [],
    remark: client.remark,
    createdAt: client.createdAt?.toISOString() ?? null,
    updatedAt: client.updatedAt?.toISOString() ?? null,
    individualProfile: individualProfile
      ? {
          idCardNumber: individualProfile.idCardNumber,
          gender: individualProfile.gender,
          occupation: individualProfile.occupation
        }
      : null,
    companyProfile: companyProfile
      ? {
          unifiedCreditCode: companyProfile.unifiedCreditCode,
          companyType: companyProfile.companyType,
          industry: companyProfile.industry,
          registeredCapital: companyProfile.registeredCapital,
          legalRepresentative: companyProfile.legalRepresentative
        }
      : null,
    attachments: attachmentsList.map((item) => ({
      id: item.id,
      filename: item.filename,
      fileType: item.fileType,
      fileUrl: item.fileUrl,
      description: item.description,
      uploadedAt: item.uploadedAt?.toISOString() ?? null,
      uploadedBy: item.uploadedBy ?? null
    }))
  };
};

router.get('/', async (req: Request, res: Response, next) => {
  try {
    const currentUser = await requireCurrentUser(req);
    ensureRoleAllowed(currentUser.role, CLIENT_READ_ROLES, '无权限查看客户信息');

    const name = normalizeOptionalString(req.query.name);
    const type = normalizeOptionalString(req.query.type);
    const source = normalizeOptionalString(req.query.source);
    const status = normalizeOptionalString(req.query.status);
    const pageParam = normalizeOptionalString(req.query.page) ?? '1';
    const pageSizeParam = normalizeOptionalString(req.query.pageSize) ?? '20';

    const page = Math.max(Number.parseInt(pageParam, 10) || 1, 1);
    const pageSize = Math.min(Math.max(Number.parseInt(pageSizeParam, 10) || 20, 1), 100);

    const conditions = [] as ReturnType<typeof eq>[];

    if (name) {
      conditions.push(ilike(clients.name, `%${name}%`));
    }

    if (type && clientTypeSet.has(type as ClientType)) {
      conditions.push(eq(clients.type, type as ClientType));
    }

    if (source && clientSourceSet.has(source as ClientSource)) {
      conditions.push(eq(clients.source, source as ClientSource));
    }

    if (status && clientStatusSet.has(status as ClientStatus)) {
      conditions.push(eq(clients.status, status as ClientStatus));
    }

    if (!CLIENT_ASSIGN_ALL_ROLES.has(currentUser.role)) {
      conditions.push(eq(clients.responsibleLawyerId, currentUser.id));
    }

    const whereClause =
      conditions.length === 0
        ? undefined
        : conditions.length === 1
        ? conditions[0]
        : and(...conditions);

    const baseQuery = db
      .select({
        id: clients.id,
        name: clients.name,
        type: clients.type,
        phone: clients.phone,
        responsibleLawyerId: clients.responsibleLawyerId,
        responsibleLawyerName: users.name,
        status: clients.status,
        tags: clients.tags,
        source: clients.source,
        createdAt: clients.createdAt
      })
      .from(clients)
      .leftJoin(users, eq(users.id, clients.responsibleLawyerId))
      .orderBy(desc(clients.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const results = whereClause ? await baseQuery.where(whereClause) : await baseQuery;

    const countQuery = db
      .select({ value: sql<number>`count(*)` })
      .from(clients);
    const [countResult] = whereClause ? await countQuery.where(whereClause) : await countQuery;
    const total = Number(countResult?.value ?? 0);

    res.json({
      items: results.map((item) => ({
        id: item.id,
        name: item.name,
        type: item.type,
        phone: item.phone,
        responsibleLawyer: {
          id: item.responsibleLawyerId,
          name: item.responsibleLawyerName ?? null
        },
        status: item.status,
        tags: item.tags ?? [],
        source: item.source,
        createdAt: item.createdAt?.toISOString() ?? null
      })),
      pagination: {
        page,
        pageSize,
        total
      }
    });
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json({ message: error.message });
      return;
    }
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next) => {
  try {
    const currentUser = await requireCurrentUser(req);
    ensureRoleAllowed(currentUser.role, CLIENT_READ_ROLES, '无权限查看客户信息');

    const detail = await fetchClientDetail(req.params.id, currentUser);
    res.json(detail);
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
  const payload = parseClientPayload(req.body);

    ensureManageTarget(currentUser, payload.responsibleLawyerId);

    const responsibleLawyerId = payload.responsibleLawyerId!;

    const [responsible] = await db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, responsibleLawyerId))
      .limit(1);

    if (!responsible || !['master', 'admin', 'lawyer'].includes(responsible.role)) {
      throw new HttpError(400, '负责律师无效');
    }

    if (payload.type === 'individual' && !payload.individualProfile?.idCardNumber) {
      throw new HttpError(400, '请填写自然人客户身份证号');
    }

    if (payload.type === 'company' && !payload.companyProfile?.unifiedCreditCode) {
      throw new HttpError(400, '请填写企业统一社会信用代码');
    }

    const clientId = await db.transaction(async (trx) => {
      const [inserted] = await trx
        .insert(clients)
        .values({
          name: payload.name,
          type: payload.type,
          phone: payload.phone,
          email: payload.email ?? null,
          address: payload.address ?? null,
          source: payload.source ?? null,
          sourceRemark: payload.sourceRemark ?? null,
          status: payload.status ?? 'active',
          responsibleLawyerId,
          tags: payload.tags ?? null,
          remark: payload.remark ?? null
        })
        .returning({ id: clients.id, type: clients.type });

      if (!inserted) {
        throw new HttpError(500, '创建客户失败');
      }

      if (payload.type === 'individual' && payload.individualProfile) {
        const idCardNumber = payload.individualProfile.idCardNumber.trim().toUpperCase();
        const gender = payload.individualProfile.gender ?? deriveGenderFromIdCard(idCardNumber);
        await trx.insert(clientIndividuals).values({
          clientId: inserted.id,
          idCardNumber,
          gender: gender ?? null,
          occupation: payload.individualProfile.occupation ?? null
        });
      }

      if (payload.type === 'company' && payload.companyProfile) {
        await trx.insert(clientCompanies).values({
          clientId: inserted.id,
          unifiedCreditCode: payload.companyProfile.unifiedCreditCode.trim().toUpperCase(),
          companyType: payload.companyProfile.companyType ?? null,
          industry: payload.companyProfile.industry ?? null,
          registeredCapital:
            payload.companyProfile.registeredCapital !== undefined &&
            payload.companyProfile.registeredCapital !== null &&
            payload.companyProfile.registeredCapital !== ''
              ? String(payload.companyProfile.registeredCapital)
              : null,
          legalRepresentative: payload.companyProfile.legalRepresentative ?? null
        });
      }

      if (payload.attachments && payload.attachments.length > 0) {
        await trx.insert(clientAttachments).values(
          payload.attachments.map((attachment) => ({
            id: randomUUID(),
            clientId: inserted.id,
            filename: attachment.filename,
            fileType: attachment.fileType ?? null,
            fileUrl: attachment.fileUrl,
            description: attachment.description ?? null,
            uploadedBy: currentUser.id
          }))
        );
      }

      return inserted.id;
    });

    const detail = await fetchClientDetail(clientId, currentUser);
    res.status(201).json(detail);
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
    const clientId = req.params.id;
  const payload = parseClientPayload({ ...req.body, responsibleLawyerId: req.body?.responsibleLawyerId ?? undefined });

    const [existing] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
    if (!existing) {
      throw new HttpError(404, '客户不存在');
    }

    ensureManageAccessForClient(currentUser, existing);

    const nextResponsible = payload.responsibleLawyerId || existing.responsibleLawyerId;
    ensureManageTarget(currentUser, nextResponsible);

    await db.transaction(async (trx) => {
      const updates: Partial<typeof clients.$inferInsert> = {
        name: payload.name || existing.name,
        phone: payload.phone || existing.phone,
        email: payload.email ?? existing.email,
        address: payload.address ?? existing.address,
        source: payload.source ?? existing.source,
        sourceRemark: payload.sourceRemark ?? existing.sourceRemark,
        status: payload.status ?? existing.status,
        responsibleLawyerId: payload.responsibleLawyerId || existing.responsibleLawyerId,
        tags: payload.tags ?? existing.tags,
        remark: payload.remark ?? existing.remark,
        type: payload.type || existing.type,
        updatedAt: new Date()
      };

      await trx.update(clients).set(updates).where(eq(clients.id, clientId));

      const targetType = updates.type ?? existing.type;

      await trx.delete(clientIndividuals).where(eq(clientIndividuals.clientId, clientId));
      await trx.delete(clientCompanies).where(eq(clientCompanies.clientId, clientId));

      if (targetType === 'individual' && payload.individualProfile) {
        const idCardNumber = payload.individualProfile.idCardNumber.trim().toUpperCase();
        const gender = payload.individualProfile.gender ?? deriveGenderFromIdCard(idCardNumber);
        await trx.insert(clientIndividuals).values({
          clientId,
          idCardNumber,
          gender: gender ?? null,
          occupation: payload.individualProfile.occupation ?? null
        });
      }

      if (targetType === 'company' && payload.companyProfile) {
        await trx.insert(clientCompanies).values({
          clientId,
          unifiedCreditCode: payload.companyProfile.unifiedCreditCode.trim().toUpperCase(),
          companyType: payload.companyProfile.companyType ?? null,
          industry: payload.companyProfile.industry ?? null,
          registeredCapital:
            payload.companyProfile.registeredCapital !== undefined &&
            payload.companyProfile.registeredCapital !== null &&
            payload.companyProfile.registeredCapital !== ''
              ? String(payload.companyProfile.registeredCapital)
              : null,
          legalRepresentative: payload.companyProfile.legalRepresentative ?? null
        });
      }

      await trx.delete(clientAttachments).where(eq(clientAttachments.clientId, clientId));
      if (payload.attachments && payload.attachments.length > 0) {
        await trx.insert(clientAttachments).values(
          payload.attachments.map((attachment) => ({
            id: randomUUID(),
            clientId,
            filename: attachment.filename,
            fileType: attachment.fileType ?? null,
            fileUrl: attachment.fileUrl,
            description: attachment.description ?? null,
            uploadedBy: currentUser.id
          }))
        );
      }
    });

    const detail = await fetchClientDetail(clientId, currentUser);
    res.json(detail);
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
    const clientId = req.params.id;

    const [existing] = await db.select().from(clients).where(eq(clients.id, clientId)).limit(1);
    if (!existing) {
      throw new HttpError(404, '客户不存在');
    }

    ensureManageAccessForClient(currentUser, existing);

    await db.delete(clients).where(eq(clients.id, clientId));
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
