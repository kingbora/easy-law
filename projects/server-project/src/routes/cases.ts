import { randomUUID } from 'node:crypto';

import { and, asc, desc, eq, ilike, inArray, or } from 'drizzle-orm';
import { sql, type SQL } from 'drizzle-orm';
import { Router, type Request, type Response } from 'express';

import { db } from '../db/client';
import {
  caseBillingMethodEnum,
  caseCategories,
  caseLawyers,
  caseMaterialFiles,
  caseStatusEnum,
  caseTypes,
  cases,
  clients,
  type CaseBillingMethod,
  type CaseStatus,
  type CaseLawyerRow,
  type CaseRow,
  clientTypeEnum,
  users,
  type UserRole
} from '../db/schema';

import { HttpError, ensureRoleAllowed, requireCurrentUser, type CurrentUserRow } from './utils/current-user';

const router = Router();

const CASE_READ_ROLES = new Set<UserRole>(['master', 'admin', 'lawyer', 'assistant']);
const CASE_MANAGE_ROLES = new Set<UserRole>(['master', 'admin', 'lawyer']);

const caseStatusSet = new Set(caseStatusEnum.enumValues);
const billingMethodSet = new Set(caseBillingMethodEnum.enumValues);
const opponentTypeSet = new Set(clientTypeEnum.enumValues);

interface CaseLawyerPayload {
  lawyerId: string;
  isPrimary?: boolean;
  hourlyRate?: string | null;
}

interface CasePayload {
  name: string;
  clientId: string;
  caseTypeId: string;
  caseCategoryId: string;
  status: CaseStatus;
  description?: string | null;
  court?: string | null;
  filingDate?: string | null;
  hearingDate?: string | null;
  evidenceDeadline?: string | null;
  appealDeadline?: string | null;
  disputedAmount?: string | null;
  billingMethod: CaseBillingMethod;
  lawyerFeeTotal?: string | null;
  estimatedHours?: number | null;
  contingencyRate?: string | null;
  otherFeeBudget?: string | null;
  paymentPlan?: string | null;
  opponentName: string;
  opponentType: 'individual' | 'company';
  opponentIdNumber?: string | null;
  opponentLawyer?: string | null;
  thirdParty?: string | null;
  lawyers: CaseLawyerPayload[];
  materials?: CaseMaterialsPayload;
}

interface CaseMaterialUpload {
  filename: string;
  fileType: string | null;
  fileSize: number | null;
  base64Data: string;
}

interface CaseMaterialsPayload {
  keepIds: string[];
  uploads: CaseMaterialUpload[];
}

interface CaseLawyerResponse {
  id: string;
  name: string | null;
  email: string | null;
  isPrimary: boolean;
  hourlyRate: string | null;
}

interface CaseListItemResponse {
  id: string;
  name: string;
  status: CaseStatus;
  billingMethod: CaseBillingMethod;
  client: {
    id: string;
    name: string;
  };
  caseType: {
    id: string;
    name: string;
  };
  caseCategory: {
    id: string;
    name: string;
  };
  lawyers: CaseLawyerResponse[];
  primaryLawyerId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

interface CaseDetailResponse extends CaseListItemResponse {
  description: string | null;
  court: string | null;
  filingDate: string | null;
  hearingDate: string | null;
  evidenceDeadline: string | null;
  appealDeadline: string | null;
  disputedAmount: string | null;
  materials: CaseMaterialResponse[];
  billing: {
    lawyerFeeTotal: string | null;
    estimatedHours: number | null;
    contingencyRate: string | null;
    otherFeeBudget: string | null;
    paymentPlan: string | null;
  };
  opponent: {
    name: string;
    type: 'individual' | 'company';
    idNumber: string | null;
    lawyer: string | null;
    thirdParty: string | null;
  };
}

interface CaseMaterialResponse {
  id: string;
  filename: string;
  fileType: string | null;
  fileSize: number | null;
  downloadUrl: string;
  uploadedAt: string | null;
  uploadedBy: string | null;
}

const normalizeString = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
const normalizeOptionalString = (value: unknown) => (typeof value === 'string' ? value.trim() || null : null);

const parseDateString = (value: unknown, field: string): string | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    throw new HttpError(400, `${field}格式不正确`);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    throw new HttpError(400, `${field}格式不正确，应为YYYY-MM-DD`);
  }
  return trimmed;
};

const parseMoneyString = (value: unknown, field: string, { allowZero = false } = {}): string | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const raw = typeof value === 'number' ? value.toString() : typeof value === 'string' ? value.trim() : '';
  if (!raw) {
    return null;
  }
  const normalized = raw.replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new HttpError(400, `${field}格式不正确，应为数字，最多两位小数`);
  }
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric)) {
    throw new HttpError(400, `${field}格式不正确`);
  }
  if (!allowZero && numeric <= 0) {
    throw new HttpError(400, `${field}必须大于0`);
  }
  if (numeric < 0) {
    throw new HttpError(400, `${field}不可为负数`);
  }
  return numeric.toFixed(2);
};

const parseNumericString = (value: unknown, field: string): string | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const raw = typeof value === 'number' ? value.toString() : typeof value === 'string' ? value.trim() : '';
  if (!raw) {
    return null;
  }
  const normalized = raw.replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new HttpError(400, `${field}格式不正确，应为数字，最多两位小数`);
  }
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new HttpError(400, `${field}格式不正确`);
  }
  return numeric.toFixed(2);
};

const parsePercentageString = (value: unknown, field: string): string | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const raw = typeof value === 'number' ? value.toString() : typeof value === 'string' ? value.trim() : '';
  if (!raw) {
    return null;
  }
  const normalized = raw.replace(/%/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new HttpError(400, `${field}格式不正确，应为百分比（如30或30%）`);
  }
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric) || numeric <= 0 || numeric > 100) {
    throw new HttpError(400, `${field}需要在0-100之间`);
  }
  return numeric.toFixed(2);
};

const parseEstimatedHours = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const intValue = Math.trunc(value);
    if (intValue < 0) {
      throw new HttpError(400, '预计小时数不可为负数');
    }
    return intValue;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new HttpError(400, '预计小时数格式不正确');
    }
    return parsed;
  }
  throw new HttpError(400, '预计小时数格式不正确');
};

const parseCaseLawyers = (value: unknown): CaseLawyerPayload[] => {
  if (!Array.isArray(value)) {
    throw new HttpError(400, '请至少选择一位负责律师');
  }
  const sanitized: CaseLawyerPayload[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const record = item as Record<string, unknown>;
    const lawyerIdRaw = normalizeString(record.lawyerId);
    if (!lawyerIdRaw) {
      continue;
    }
    if (seen.has(lawyerIdRaw)) {
      throw new HttpError(400, '同一位律师不可重复选择');
    }
    seen.add(lawyerIdRaw);
    const isPrimary = record.isPrimary === true;
    let hourlyRate: string | null = null;
    const hourlyRaw = record.hourlyRate;
    if (typeof hourlyRaw === 'string') {
      hourlyRate = hourlyRaw.trim() || null;
    } else if (typeof hourlyRaw === 'number' && Number.isFinite(hourlyRaw)) {
      hourlyRate = hourlyRaw.toString();
    }
    sanitized.push({
      lawyerId: lawyerIdRaw,
      isPrimary,
      hourlyRate
    });
  }
  if (sanitized.length === 0) {
    throw new HttpError(400, '请至少选择一位负责律师');
  }
  const primaryCount = sanitized.filter((item) => item.isPrimary).length;
  if (primaryCount === 0) {
    sanitized[0] = { ...sanitized[0], isPrimary: true };
  } else if (primaryCount > 1) {
    throw new HttpError(400, '仅能设置一位主办律师');
  }
  return sanitized;
};

const parseCaseMaterials = (value: unknown): CaseMaterialsPayload | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new HttpError(400, '附件参数格式不正确');
  }

  const keepIds: string[] = [];
  const uploads: CaseMaterialUpload[] = [];

  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const record = item as Record<string, unknown>;
    const id = normalizeOptionalString(record.id);
    const base64Raw = record.base64Data;
    const filename = normalizeString(record.filename);
    const fileType = normalizeOptionalString(record.fileType);
    const fileSizeRaw = record.fileSize;

    let fileSize: number | null = null;
    if (typeof fileSizeRaw === 'number' && Number.isFinite(fileSizeRaw) && fileSizeRaw >= 0) {
      fileSize = Math.trunc(fileSizeRaw);
    } else if (typeof fileSizeRaw === 'string') {
      const parsed = Number.parseInt(fileSizeRaw, 10);
      if (!Number.isNaN(parsed) && parsed >= 0) {
        fileSize = parsed;
      }
    }

    if (typeof base64Raw === 'string') {
      const normalized = base64Raw.replace(/^data:[^;]+;base64,/, '').trim();
      if (!normalized) {
        throw new HttpError(400, '附件内容无效');
      }
      if (!filename) {
        throw new HttpError(400, '附件缺少文件名');
      }
      uploads.push({
        filename,
        fileType: fileType ?? null,
        fileSize,
        base64Data: normalized
      });
      continue;
    }

    if (id) {
      keepIds.push(id);
    }
  }

  return { keepIds, uploads };
};

const parseCasePayload = (body: unknown): CasePayload => {
  if (!body || typeof body !== 'object') {
    throw new HttpError(400, '请求体格式不正确');
  }

  const data = body as Record<string, unknown>;
  const name = normalizeString(data.name);
  if (!name) {
    throw new HttpError(400, '案件名称不能为空');
  }

  const clientId = normalizeString(data.clientId);
  if (!clientId) {
    throw new HttpError(400, '客户不能为空');
  }

  const caseTypeId = normalizeString(data.caseTypeId);
  if (!caseTypeId) {
    throw new HttpError(400, '案件类型不能为空');
  }

  const caseCategoryId = normalizeString(data.caseCategoryId);
  if (!caseCategoryId) {
    throw new HttpError(400, '案由不能为空');
  }

  const statusRaw = normalizeString(data.status);
  if (!caseStatusSet.has(statusRaw as CaseStatus)) {
    throw new HttpError(400, '案件状态不合法');
  }

  const billingMethodRaw = normalizeString(data.billingMethod);
  if (!billingMethodSet.has(billingMethodRaw as CaseBillingMethod)) {
    throw new HttpError(400, '收费方式不合法');
  }

  const opponentName = normalizeString(data.opponentName);
  if (!opponentName) {
    throw new HttpError(400, '对方当事人不能为空');
  }

  const opponentTypeRaw = normalizeString(data.opponentType);
  if (!opponentTypeSet.has(opponentTypeRaw as 'individual' | 'company')) {
    throw new HttpError(400, '对方当事人类型不合法');
  }

  const lawyers = parseCaseLawyers(data.lawyers);
  const materials = parseCaseMaterials(data.materials);

  const payload: CasePayload = {
    name,
    clientId,
    caseTypeId,
    caseCategoryId,
    status: statusRaw as CaseStatus,
    description: normalizeOptionalString(data.description),
    court: normalizeOptionalString(data.court),
    filingDate: parseDateString(data.filingDate, '立案日期'),
    hearingDate: parseDateString(data.hearingDate, '开庭日期'),
    evidenceDeadline: parseDateString(data.evidenceDeadline, '举证截止日'),
    appealDeadline: parseDateString(data.appealDeadline, '上诉截止日'),
    disputedAmount: parseNumericString(data.disputedAmount, '标的额'),
    billingMethod: billingMethodRaw as CaseBillingMethod,
    lawyerFeeTotal: parseMoneyString(data.lawyerFeeTotal, '律师费总额'),
    estimatedHours: data.estimatedHours === undefined ? null : parseEstimatedHours(data.estimatedHours),
    contingencyRate: parsePercentageString(data.contingencyRate, '风险代理比例'),
    otherFeeBudget: parseNumericString(data.otherFeeBudget, '其他费用预算'),
    paymentPlan: normalizeOptionalString(data.paymentPlan),
    opponentName,
    opponentType: opponentTypeRaw as 'individual' | 'company',
    opponentIdNumber: normalizeOptionalString(data.opponentIdNumber),
    opponentLawyer: normalizeOptionalString(data.opponentLawyer),
    thirdParty: normalizeOptionalString(data.thirdParty),
    lawyers,
    materials
  };

  return payload;
};

const formatDate = (value: Date | string | null | undefined) => {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'string') {
    return value;
  }
  return null;
};

const formatNumeric = (value: unknown) => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number') {
    return value.toFixed(2);
  }
  return null;
};

const mapLawyerRows = (rows: Array<CaseLawyerRow & { name: string | null; email: string | null }>): CaseLawyerResponse[] => {
  return rows
    .map((item) => ({
      id: item.lawyerId,
      name: item.name,
      email: item.email,
      isPrimary: item.isPrimary ?? false,
      hourlyRate: formatNumeric(item.hourlyRate)
    }))
    .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
};

const buildCaseDetail = (
  base: {
    case: CaseRow;
    clientName: string;
    caseTypeName: string;
    caseCategoryName: string;
  },
  lawyers: CaseLawyerResponse[],
  materials: CaseMaterialResponse[]
): CaseDetailResponse => ({
  id: base.case.id,
  name: base.case.name,
  status: base.case.status,
  billingMethod: base.case.billingMethod,
  client: {
    id: base.case.clientId,
    name: base.clientName
  },
  caseType: {
    id: base.case.caseTypeId,
    name: base.caseTypeName
  },
  caseCategory: {
    id: base.case.caseCategoryId,
    name: base.caseCategoryName
  },
  lawyers,
  primaryLawyerId: lawyers.find((lawyer) => lawyer.isPrimary)?.id ?? null,
  createdAt: base.case.createdAt?.toISOString() ?? null,
  updatedAt: base.case.updatedAt?.toISOString() ?? null,
  description: base.case.description ?? null,
  court: base.case.court ?? null,
  filingDate: formatDate(base.case.filingDate),
  hearingDate: formatDate(base.case.hearingDate),
  evidenceDeadline: formatDate(base.case.evidenceDeadline),
  appealDeadline: formatDate(base.case.appealDeadline),
  disputedAmount: formatNumeric(base.case.disputedAmount),
  materials,
  billing: {
    lawyerFeeTotal: formatNumeric(base.case.lawyerFeeTotal),
    estimatedHours: base.case.estimatedHours ?? null,
    contingencyRate: formatNumeric(base.case.contingencyRate),
    otherFeeBudget: formatNumeric(base.case.otherFeeBudget),
    paymentPlan: base.case.paymentPlan ?? null
  },
  opponent: {
    name: base.case.opponentName,
    type: base.case.opponentType,
    idNumber: base.case.opponentIdNumber ?? null,
    lawyer: base.case.opponentLawyer ?? null,
    thirdParty: base.case.thirdParty ?? null
  }
});

const ensureManageAuthority = async (currentUser: CurrentUserRow, caseId: string) => {
  if (currentUser.role === 'master' || currentUser.role === 'admin') {
    return;
  }
  if (currentUser.role !== 'lawyer') {
    throw new HttpError(403, '无权限维护案件信息');
  }
  const [record] = await db
    .select({ id: caseLawyers.caseId })
    .from(caseLawyers)
    .where(and(eq(caseLawyers.caseId, caseId), eq(caseLawyers.lawyerId, currentUser.id)))
    .limit(1);
  if (!record) {
    throw new HttpError(403, '仅可维护自己负责的案件');
  }
};

const ensureLawyersExist = async (payload: CasePayload, currentUser: CurrentUserRow) => {
  const lawyerIds = payload.lawyers.map((item) => item.lawyerId);
  const rows = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(inArray(users.id, lawyerIds));

  if (rows.length !== lawyerIds.length) {
    throw new HttpError(400, '部分负责律师不存在');
  }

  const allowedRoles = new Set<UserRole>(['lawyer', 'master', 'admin']);
  for (const row of rows) {
    if (!allowedRoles.has(row.role)) {
      throw new HttpError(400, '负责律师仅能选择律师或管理员');
    }
  }

  if (currentUser.role === 'lawyer' && !lawyerIds.includes(currentUser.id)) {
    throw new HttpError(403, '律师仅可创建或维护自己负责的案件');
  }
};

const ensureReferences = async (payload: CasePayload) => {
  const [[client], [caseType], [category]] = await Promise.all([
    db.select({ id: clients.id }).from(clients).where(eq(clients.id, payload.clientId)).limit(1),
    db.select({ id: caseTypes.id }).from(caseTypes).where(eq(caseTypes.id, payload.caseTypeId)).limit(1),
    db.select({ id: caseCategories.id, caseTypeId: caseCategories.caseTypeId })
      .from(caseCategories)
      .where(eq(caseCategories.id, payload.caseCategoryId))
      .limit(1)
  ]);

  if (!client) {
    throw new HttpError(400, '客户不存在');
  }
  if (!caseType) {
    throw new HttpError(400, '案件类型不存在');
  }
  if (!category) {
    throw new HttpError(400, '案由不存在');
  }
  if (category.caseTypeId !== payload.caseTypeId) {
    throw new HttpError(400, '所选案由不属于当前案件类型');
  }
};

const validateBilling = (payload: CasePayload) => {
  if ((payload.billingMethod === 'fixed_fee') && !payload.lawyerFeeTotal) {
    throw new HttpError(400, '请填写律师费总额');
  }
  if (payload.billingMethod === 'contingency' && !payload.contingencyRate) {
    throw new HttpError(400, '请输入风险代理比例');
  }
  if ((payload.billingMethod === 'hourly' || payload.billingMethod === 'hybrid')) {
    for (const lawyer of payload.lawyers) {
      const hourlyRate = parseMoneyString(lawyer.hourlyRate, '小时费率', { allowZero: false });
      if (!hourlyRate) {
        throw new HttpError(400, '请为每位负责律师设置小时费率');
      }
      lawyer.hourlyRate = hourlyRate;
    }
  } else {
    for (const lawyer of payload.lawyers) {
      lawyer.hourlyRate = lawyer.hourlyRate ? parseMoneyString(lawyer.hourlyRate, '小时费率', { allowZero: false }) : null;
    }
  }

  if (payload.lawyerFeeTotal) {
    payload.lawyerFeeTotal = parseMoneyString(payload.lawyerFeeTotal, '律师费总额');
  }
  if (payload.otherFeeBudget) {
    payload.otherFeeBudget = parseNumericString(payload.otherFeeBudget, '其他费用预算');
  }
  if (payload.disputedAmount) {
    payload.disputedAmount = parseNumericString(payload.disputedAmount, '标的额');
  }
  if (payload.billingMethod !== 'contingency') {
    payload.contingencyRate = null;
  }
};

const fetchCaseDetail = async (caseId: string): Promise<CaseDetailResponse> => {
  const [record] = await db
    .select({
      case: cases,
      clientName: clients.name,
      caseTypeName: caseTypes.name,
      caseCategoryName: caseCategories.name
    })
    .from(cases)
    .innerJoin(clients, eq(cases.clientId, clients.id))
    .innerJoin(caseTypes, eq(cases.caseTypeId, caseTypes.id))
    .innerJoin(caseCategories, eq(cases.caseCategoryId, caseCategories.id))
    .where(eq(cases.id, caseId))
    .limit(1);

  if (!record) {
    throw new HttpError(404, '案件不存在');
  }

  const lawyersRows = await db
    .select({
      caseId: caseLawyers.caseId,
      lawyerId: caseLawyers.lawyerId,
      isPrimary: caseLawyers.isPrimary,
      hourlyRate: caseLawyers.hourlyRate,
      name: users.name,
      email: users.email
    })
    .from(caseLawyers)
    .leftJoin(users, eq(users.id, caseLawyers.lawyerId))
    .where(eq(caseLawyers.caseId, caseId))
    .orderBy(desc(caseLawyers.isPrimary), asc(users.name));

  const lawyers = mapLawyerRows(lawyersRows as Array<CaseLawyerRow & { name: string | null; email: string | null }>);

  const materialsRows = await db
    .select({
      id: caseMaterialFiles.id,
      filename: caseMaterialFiles.filename,
      fileType: caseMaterialFiles.fileType,
      fileSize: caseMaterialFiles.fileSize,
      uploadedAt: caseMaterialFiles.uploadedAt,
      uploadedBy: caseMaterialFiles.uploadedBy
    })
    .from(caseMaterialFiles)
    .where(eq(caseMaterialFiles.caseId, caseId))
    .orderBy(desc(caseMaterialFiles.uploadedAt), desc(caseMaterialFiles.id));

  const materials: CaseMaterialResponse[] = materialsRows.map((item) => ({
    id: item.id,
    filename: item.filename,
    fileType: item.fileType ?? null,
    fileSize: item.fileSize ?? null,
    downloadUrl: `/api/cases/${caseId}/materials/${item.id}/download`,
    uploadedAt: item.uploadedAt?.toISOString() ?? null,
    uploadedBy: item.uploadedBy ?? null
  }));

  return buildCaseDetail(record, lawyers, materials);
};

router.get('/', async (req: Request, res: Response, next) => {
  try {
    const currentUser = await requireCurrentUser(req);
    ensureRoleAllowed(currentUser.role, CASE_READ_ROLES, '无权限查看案件信息');

    const page = Math.max(Number.parseInt(String(req.query.page ?? '1'), 10) || 1, 1);
    const pageSize = Math.min(Math.max(Number.parseInt(String(req.query.pageSize ?? '20'), 10) || 20, 1), 100);

    const search = normalizeOptionalString(req.query.search);
    const clientId = normalizeOptionalString(req.query.clientId);
    const caseTypeId = normalizeOptionalString(req.query.caseTypeId);
    const caseCategoryId = normalizeOptionalString(req.query.caseCategoryId);
    const status = normalizeOptionalString(req.query.status);
    const lawyerId = normalizeOptionalString(req.query.lawyerId);
    const billingMethod = normalizeOptionalString(req.query.billingMethod);

    const conditions: SQL[] = [];

    if (search) {
      const likeValue = `%${search}%`;
      const searchCondition = or(ilike(cases.name, likeValue), ilike(clients.name, likeValue));
      conditions.push(searchCondition as unknown as SQL);
    }
    if (clientId) {
      conditions.push(eq(cases.clientId, clientId) as unknown as SQL);
    }
    if (caseTypeId) {
      conditions.push(eq(cases.caseTypeId, caseTypeId) as unknown as SQL);
    }
    if (caseCategoryId) {
      conditions.push(eq(cases.caseCategoryId, caseCategoryId) as unknown as SQL);
    }
    if (status) {
      if (!caseStatusSet.has(status as CaseStatus)) {
        throw new HttpError(400, '案件状态参数不合法');
      }
      conditions.push(eq(cases.status, status as CaseStatus) as unknown as SQL);
    }
    if (billingMethod) {
      if (!billingMethodSet.has(billingMethod as CaseBillingMethod)) {
        throw new HttpError(400, '收费方式参数不合法');
      }
      conditions.push(eq(cases.billingMethod, billingMethod as CaseBillingMethod) as unknown as SQL);
    }

    if (lawyerId) {
      const caseIds = await db
        .select({ caseId: caseLawyers.caseId })
        .from(caseLawyers)
        .where(eq(caseLawyers.lawyerId, lawyerId));
      const matchedIds = caseIds.map((item) => item.caseId);
      if (matchedIds.length === 0) {
        res.json({ items: [], pagination: { page, pageSize, total: 0 } });
        return;
      }
      conditions.push(inArray(cases.id, matchedIds) as unknown as SQL);
    }

    const whereClause =
      conditions.length === 0
        ? undefined
        : conditions.length === 1
        ? conditions[0]
        : and(...conditions);

    const [totalResult] = await db
      .select({ value: sql<number>`COUNT(*)` })
      .from(cases)
      .innerJoin(clients, eq(cases.clientId, clients.id))
      .where(whereClause);

    const total = Number(totalResult?.value ?? 0);

    const items = await db
      .select({
        case: cases,
        clientName: clients.name,
        caseTypeName: caseTypes.name,
        caseCategoryName: caseCategories.name
      })
      .from(cases)
      .innerJoin(clients, eq(cases.clientId, clients.id))
      .innerJoin(caseTypes, eq(cases.caseTypeId, caseTypes.id))
      .innerJoin(caseCategories, eq(cases.caseCategoryId, caseCategories.id))
      .where(whereClause)
      .orderBy(desc(cases.createdAt))
      .offset((page - 1) * pageSize)
      .limit(pageSize);

    const caseIds = items.map((item) => item.case.id);
    const lawyerRows = caseIds.length
      ? await db
          .select({
            caseId: caseLawyers.caseId,
            lawyerId: caseLawyers.lawyerId,
            isPrimary: caseLawyers.isPrimary,
            hourlyRate: caseLawyers.hourlyRate,
            name: users.name,
            email: users.email
          })
          .from(caseLawyers)
          .leftJoin(users, eq(users.id, caseLawyers.lawyerId))
          .where(inArray(caseLawyers.caseId, caseIds))
      : [];

    const groupedLawyers = new Map<string, CaseLawyerResponse[]>();
    for (const row of lawyerRows) {
      const list = groupedLawyers.get(row.caseId) ?? [];
      list.push({
        id: row.lawyerId,
        name: row.name,
        email: row.email,
        isPrimary: row.isPrimary ?? false,
        hourlyRate: formatNumeric(row.hourlyRate)
      });
      groupedLawyers.set(row.caseId, list);
    }

    const response: CaseListItemResponse[] = items.map((item) => {
      const lawyers = (groupedLawyers.get(item.case.id) ?? []).sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary));
      return {
        id: item.case.id,
        name: item.case.name,
        status: item.case.status,
        billingMethod: item.case.billingMethod,
        client: {
          id: item.case.clientId,
          name: item.clientName
        },
        caseType: {
          id: item.case.caseTypeId,
          name: item.caseTypeName
        },
        caseCategory: {
          id: item.case.caseCategoryId,
          name: item.caseCategoryName
        },
        lawyers,
        primaryLawyerId: lawyers.find((lawyer) => lawyer.isPrimary)?.id ?? null,
        createdAt: item.case.createdAt?.toISOString() ?? null,
        updatedAt: item.case.updatedAt?.toISOString() ?? null
      };
    });

    res.json({
      items: response,
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
    ensureRoleAllowed(currentUser.role, CASE_READ_ROLES, '无权限查看案件信息');

    const caseId = req.params.id;
    const detail = await fetchCaseDetail(caseId);
    res.json(detail);
  } catch (error) {
    if (error instanceof HttpError) {
      res.status(error.status).json({ message: error.message });
      return;
    }
    next(error);
  }
});

router.get('/:id/materials/:materialId/download', async (req: Request, res: Response, next) => {
  try {
    const currentUser = await requireCurrentUser(req);
    ensureRoleAllowed(currentUser.role, CASE_READ_ROLES, '无权限查看案件信息');

    const caseId = req.params.id;
    const materialId = req.params.materialId;

    const [material] = await db
      .select({
        id: caseMaterialFiles.id,
        caseId: caseMaterialFiles.caseId,
        filename: caseMaterialFiles.filename,
        fileType: caseMaterialFiles.fileType,
        fileData: caseMaterialFiles.fileData
      })
      .from(caseMaterialFiles)
      .where(and(eq(caseMaterialFiles.caseId, caseId), eq(caseMaterialFiles.id, materialId)))
      .limit(1);

    if (!material) {
      throw new HttpError(404, '附件不存在');
    }

    const buffer = Buffer.from(material.fileData, 'base64');
    const mimeType = material.fileType ?? 'application/octet-stream';
    const encodedFilename = encodeURIComponent(material.filename);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFilename}`);
    res.setHeader('Content-Length', buffer.byteLength.toString());
    res.send(buffer);
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
    ensureRoleAllowed(currentUser.role, CASE_MANAGE_ROLES, '无权限维护案件信息');

    const payload = parseCasePayload(req.body);
    await ensureReferences(payload);
    await ensureLawyersExist(payload, currentUser);
    validateBilling(payload);

    const created = await db.transaction(async (trx) => {
      const [inserted] = await trx
        .insert(cases)
        .values({
          name: payload.name,
          clientId: payload.clientId,
          caseTypeId: payload.caseTypeId,
          caseCategoryId: payload.caseCategoryId,
          status: payload.status,
          description: payload.description ?? null,
          court: payload.court ?? null,
          filingDate: payload.filingDate ?? null,
          hearingDate: payload.hearingDate ?? null,
          evidenceDeadline: payload.evidenceDeadline ?? null,
          appealDeadline: payload.appealDeadline ?? null,
          disputedAmount: payload.disputedAmount ?? null,
          billingMethod: payload.billingMethod,
          lawyerFeeTotal: payload.lawyerFeeTotal ?? null,
          estimatedHours: payload.estimatedHours ?? null,
          contingencyRate: payload.contingencyRate ?? null,
          otherFeeBudget: payload.otherFeeBudget ?? null,
          paymentPlan: payload.paymentPlan ?? null,
          opponentName: payload.opponentName,
          opponentType: payload.opponentType,
          opponentIdNumber: payload.opponentIdNumber ?? null,
          opponentLawyer: payload.opponentLawyer ?? null,
          thirdParty: payload.thirdParty ?? null,
          createdBy: currentUser.id,
          updatedBy: currentUser.id
        })
        .returning();

      if (!inserted) {
        throw new HttpError(500, '创建案件失败');
      }

      await trx.insert(caseLawyers).values(
        payload.lawyers.map((lawyer) => ({
          caseId: inserted.id,
          lawyerId: lawyer.lawyerId,
          isPrimary: lawyer.isPrimary ?? false,
          hourlyRate: lawyer.hourlyRate ?? null
        }))
      );

      if (payload.materials) {
        if (payload.materials.keepIds.length > 0) {
          throw new HttpError(400, '附件参数不合法');
        }
        if (payload.materials.uploads.length > 0) {
          await trx.insert(caseMaterialFiles).values(
            payload.materials.uploads.map((item) => ({
              id: randomUUID(),
              caseId: inserted.id,
              filename: item.filename,
              fileType: item.fileType,
              fileSize: item.fileSize ?? null,
              fileData: item.base64Data,
              uploadedBy: currentUser.id
            }))
          );
        }
      }

      return inserted.id;
    });

    const detail = await fetchCaseDetail(created);
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
    ensureRoleAllowed(currentUser.role, CASE_MANAGE_ROLES, '无权限维护案件信息');

    const caseId = req.params.id;
    await ensureManageAuthority(currentUser, caseId);

    const existing = await db
      .select({ id: cases.id })
      .from(cases)
      .where(eq(cases.id, caseId))
      .limit(1);

    if (existing.length === 0) {
      throw new HttpError(404, '案件不存在');
    }

    const payload = parseCasePayload(req.body);
    await ensureReferences(payload);
    await ensureLawyersExist(payload, currentUser);
    validateBilling(payload);

    await db.transaction(async (trx) => {
      await trx
        .update(cases)
        .set({
          name: payload.name,
          clientId: payload.clientId,
          caseTypeId: payload.caseTypeId,
          caseCategoryId: payload.caseCategoryId,
          status: payload.status,
          description: payload.description ?? null,
          court: payload.court ?? null,
          filingDate: payload.filingDate ?? null,
          hearingDate: payload.hearingDate ?? null,
          evidenceDeadline: payload.evidenceDeadline ?? null,
          appealDeadline: payload.appealDeadline ?? null,
          disputedAmount: payload.disputedAmount ?? null,
          billingMethod: payload.billingMethod,
          lawyerFeeTotal: payload.lawyerFeeTotal ?? null,
          estimatedHours: payload.estimatedHours ?? null,
          contingencyRate: payload.contingencyRate ?? null,
          otherFeeBudget: payload.otherFeeBudget ?? null,
          paymentPlan: payload.paymentPlan ?? null,
          opponentName: payload.opponentName,
          opponentType: payload.opponentType,
          opponentIdNumber: payload.opponentIdNumber ?? null,
          opponentLawyer: payload.opponentLawyer ?? null,
          thirdParty: payload.thirdParty ?? null,
          updatedBy: currentUser.id,
          updatedAt: new Date()
        })
        .where(eq(cases.id, caseId));

      const existingLawyers = await trx
        .select({
          lawyerId: caseLawyers.lawyerId
        })
        .from(caseLawyers)
        .where(eq(caseLawyers.caseId, caseId));

      const existingIds = new Set(existingLawyers.map((item) => item.lawyerId));
      const incomingIds = new Set(payload.lawyers.map((item) => item.lawyerId));

      const toDelete = [...existingIds].filter((id) => !incomingIds.has(id));
      const toInsert = payload.lawyers.filter((lawyer) => !existingIds.has(lawyer.lawyerId));
      const toUpdate = payload.lawyers.filter((lawyer) => existingIds.has(lawyer.lawyerId));

      if (toDelete.length > 0) {
        await trx.delete(caseLawyers).where(and(eq(caseLawyers.caseId, caseId), inArray(caseLawyers.lawyerId, toDelete)));
      }

      if (toInsert.length > 0) {
        await trx.insert(caseLawyers).values(
          toInsert.map((lawyer) => ({
            caseId,
            lawyerId: lawyer.lawyerId,
            isPrimary: lawyer.isPrimary ?? false,
            hourlyRate: lawyer.hourlyRate ?? null
          }))
        );
      }

      for (const lawyer of toUpdate) {
        await trx
          .update(caseLawyers)
          .set({
            isPrimary: lawyer.isPrimary ?? false,
            hourlyRate: lawyer.hourlyRate ?? null
          })
          .where(and(eq(caseLawyers.caseId, caseId), eq(caseLawyers.lawyerId, lawyer.lawyerId)));
      }

      if (payload.materials) {
        const existingMaterials = await trx
          .select({ id: caseMaterialFiles.id })
          .from(caseMaterialFiles)
          .where(eq(caseMaterialFiles.caseId, caseId));

        const existingIds = new Set(existingMaterials.map((item) => item.id));
        const keepIds = new Set(payload.materials.keepIds);

        for (const id of keepIds) {
          if (!existingIds.has(id)) {
            throw new HttpError(400, '附件参数不合法');
          }
        }

        const toDelete = [...existingIds].filter((id) => !keepIds.has(id));
        if (toDelete.length > 0) {
          await trx
            .delete(caseMaterialFiles)
            .where(and(eq(caseMaterialFiles.caseId, caseId), inArray(caseMaterialFiles.id, toDelete)));
        }

        if (payload.materials.uploads.length > 0) {
          await trx.insert(caseMaterialFiles).values(
            payload.materials.uploads.map((item) => ({
              id: randomUUID(),
              caseId,
              filename: item.filename,
              fileType: item.fileType,
              fileSize: item.fileSize ?? null,
              fileData: item.base64Data,
              uploadedBy: currentUser.id
            }))
          );
        }
      }
    });

    const detail = await fetchCaseDetail(caseId);
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
    ensureRoleAllowed(currentUser.role, CASE_MANAGE_ROLES, '无权限维护案件信息');

    const caseId = req.params.id;

    const existing = await db
      .select({ id: cases.id })
      .from(cases)
      .where(eq(cases.id, caseId))
      .limit(1);

    if (existing.length === 0) {
      throw new HttpError(404, '案件不存在');
    }

    await ensureManageAuthority(currentUser, caseId);

    await db.delete(cases).where(eq(cases.id, caseId));

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
