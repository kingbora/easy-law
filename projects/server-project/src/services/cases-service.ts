import { and, count, eq, inArray, or, sql, type SQL } from 'drizzle-orm';

import { db } from '../db/client';
import { departmentEnum, users } from '../db/schema/auth-schema';
import type {
  caseLevelEnum,
  caseStatusEnum,
  caseTypeEnum,
  participantEntityEnum,
  participantRoleEnum,
  timelineNodeEnum
} from '../db/schema/case-schema';
import {
  caseChangeLogs,
  caseCollections,
  caseParticipants,
  cases,
  caseHearings,
  caseTimeline,
  trialStageEnum,
  type CaseChangeDetail
} from '../db/schema/case-schema';
import type { SessionUser } from '../utils/auth-session';
import { BadRequestError } from '../utils/http-errors';

export class AuthorizationError extends Error {
  status: number;

  constructor(message = 'Forbidden', status = 403) {
    super(message);
    this.name = 'AuthorizationError';
    this.status = status;
  }
}

type CaseAction = 'list' | 'create' | 'update' | 'delete';

const CASE_PERMISSIONS: Record<string, Set<CaseAction>> = {
  super_admin: new Set(['list', 'create', 'update', 'delete']),
  admin: new Set(['list', 'create', 'update']),
  administration: new Set(['list', 'update']),
  lawyer: new Set(['list', 'create', 'update', 'delete']),
  assistant: new Set(['list', 'create', 'update']),
  sale: new Set(['list', 'create', 'update'])
};

export type CaseType = (typeof caseTypeEnum.enumValues)[number];
export type CaseLevel = (typeof caseLevelEnum.enumValues)[number];
export type CaseStatus = (typeof caseStatusEnum.enumValues)[number];
export type ParticipantRole = (typeof participantRoleEnum.enumValues)[number];
export type ParticipantEntity = (typeof participantEntityEnum.enumValues)[number];
export type TrialStage = (typeof trialStageEnum.enumValues)[number];

export interface CaseParticipantInput {
  entityType?: ParticipantEntity | null;
  name?: string | null;
  idNumber?: string | null;
  phone?: string | null;
  address?: string | null;
  isDishonest?: boolean | null;
  sortOrder?: number | null;
}

export interface CaseParticipantsInput {
  claimants?: CaseParticipantInput[];
  respondents?: CaseParticipantInput[];
}

export interface CaseCollectionInput {
  id?: string;
  amount?: string | number | null;
  receivedAt?: string | Date | null;
}

export type CaseTimelineNode = (typeof timelineNodeEnum.enumValues)[number];

export interface CaseTimelineInput {
  id?: string;
  nodeType: CaseTimelineNode;
  occurredOn: string | Date;
  note?: string | null;
  followerId?: string | null;
}

export interface CaseHearingInput {
  hearingTime?: string | Date | null;
  hearingLocation?: string | null;
  tribunal?: string | null;
  judge?: string | null;
  caseNumber?: string | null;
  contactPhone?: string | null;
  trialStage?: TrialStage | null;
  hearingResult?: string | null;
}

export interface CaseInput {
  referenceNo?: string | null;
  caseType: CaseType;
  caseLevel: CaseLevel;
  provinceCity?: string | null;
  targetAmount?: string | number | null;
  feeStandard?: string | null;
  agencyFeeEstimate?: string | number | null;
  dataSource?: string | null;
  hasContract?: boolean | null;
  hasSocialSecurity?: boolean | null;
  entryDate?: string | Date | null;
  injuryLocation?: string | null;
  injurySeverity?: string | null;
  injuryCause?: string | null;
  workInjuryCertified?: boolean | null;
  monthlySalary?: string | number | null;
  appraisalLevel?: string | null;
  appraisalEstimate?: string | null;
  existingEvidence?: string | null;
  customerCooperative?: boolean | null;
  witnessCooperative?: boolean | null;
  remark?: string | null;
  department?: (typeof cases.$inferInsert)['department'];
  ownerId?: string | null;
  assignedLawyerId?: string | null;
  assignedAssistantId?: string | null;
  assignedTrialLawyerId?: string | null;
  caseStatus?: CaseStatus | null;
  closedReason?: string | null;
  voidReason?: string | null;
  lawyerProgress?: Record<string, unknown> | null;
  salesCommission?: string | number | null;
  handlingFee?: string | number | null;
  participants?: CaseParticipantsInput;
  collections?: CaseCollectionInput[];
  timeline?: CaseTimelineInput[];
  hearing?: CaseHearingInput | null;
}

export interface CaseListFilters {
  department?: (typeof cases.$inferSelect)['department'];
  ownerId?: string;
  assignedLawyerId?: string;
  caseType?: CaseType;
  caseLevel?: CaseLevel;
  caseStatus?: CaseStatus;
  search?: string;
}

export interface ListCasesOptions extends CaseListFilters {
  page?: number;
  pageSize?: number;
  orderBy?: 'createdAt' | 'updatedAt';
  orderDirection?: 'asc' | 'desc';
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CaseParticipantDTO {
  id: string;
  entityType: ParticipantEntity | null;
  name: string;
  idNumber: string | null;
  phone: string | null;
  address: string | null;
  isDishonest: boolean;
  sortOrder: number | null;
}

export interface CaseCollectionDTO {
  id: string;
  amount: string;
  receivedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CaseTimelineDTO {
  id: string;
  nodeType: CaseTimelineInput['nodeType'];
  occurredOn: string;
  createdAt: string;
  updatedAt: string;
  note: string | null;
  followerId: string | null;
  followerName: string | null;
}

export interface CaseHearingDTO {
  hearingTime: string | null;
  hearingLocation: string | null;
  tribunal: string | null;
  judge: string | null;
  caseNumber: string | null;
  contactPhone: string | null;
  trialStage: TrialStage | null;
  hearingResult: string | null;
}

export interface CaseDTO {
  id: string;
  referenceNo: string | null;
  caseType: CaseType;
  caseLevel: CaseLevel;
  provinceCity: string | null;
  targetAmount: string | null;
  feeStandard: string | null;
  agencyFeeEstimate: string | null;
  dataSource: string | null;
  hasContract: boolean | null;
  hasSocialSecurity: boolean | null;
  entryDate: string | null;
  injuryLocation: string | null;
  injurySeverity: string | null;
  injuryCause: string | null;
  workInjuryCertified: boolean | null;
  monthlySalary: string | null;
  appraisalLevel: string | null;
  appraisalEstimate: string | null;
  existingEvidence: string | null;
  customerCooperative: boolean | null;
  witnessCooperative: boolean | null;
  remark: string | null;
  department: (typeof cases.$inferSelect)['department'];
  ownerId: string | null;
  ownerName: string | null;
  assignedLawyerId: string | null;
  assignedLawyerName: string | null;
  assignedAssistantId: string | null;
  assignedAssistantName: string | null;
  assignedTrialLawyerId: string | null;
  assignedTrialLawyerName: string | null;
  caseStatus: CaseStatus | null;
  closedReason: string | null;
  voidReason: string | null;
  lawyerProgress: Record<string, unknown> | null;
  salesCommission: string | null;
  handlingFee: string | null;
  createdAt: string;
  updatedAt: string;
  participants: {
    claimants: CaseParticipantDTO[];
    respondents: CaseParticipantDTO[];
  };
  collections: CaseCollectionDTO[];
  timeline: CaseTimelineDTO[];
  hearing: CaseHearingDTO | null;
}

export interface CaseChangeLogDTO {
  id: string;
  action: string;
  description: string | null;
  changes: CaseChangeDetail[] | null;
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
  createdAt: string;
}

type CaseRecord = typeof cases.$inferSelect;
type CaseParticipantRecord = typeof caseParticipants.$inferSelect;
type CaseCollectionRecord = typeof caseCollections.$inferSelect;
type CaseTimelineRecord = typeof caseTimeline.$inferSelect;
type CaseHearingRecord = typeof caseHearings.$inferSelect;
type UserRecord = typeof users.$inferSelect;

type CaseTimelineRecordWithFollower = CaseTimelineRecord & {
  follower?: UserRecord | null;
};

type CaseWithRelations = CaseRecord & {
  participants: CaseParticipantRecord[];
  collections: CaseCollectionRecord[];
  timeline: CaseTimelineRecordWithFollower[];
  hearing?: CaseHearingRecord | null;
  owner?: Pick<UserRecord, 'id' | 'name' | 'role'> | null;
  assignedLawyer?: Pick<UserRecord, 'id' | 'name' | 'role'> | null;
  assignedAssistant?: Pick<UserRecord, 'id' | 'name' | 'role'> | null;
  assignedTrialLawyer?: Pick<UserRecord, 'id' | 'name' | 'role'> | null;
};

type CaseChangeLogRecord = typeof caseChangeLogs.$inferSelect & {
  actor?: Pick<UserRecord, 'id' | 'name' | 'role'> | null;
};

function isSuperAdmin(user: SessionUser) {
  return user.role === 'super_admin';
}

function ensureCasePermission(user: SessionUser, action: CaseAction) {
  const permissions = CASE_PERMISSIONS[user.role] ?? new Set<CaseAction>();
  if (!permissions.has(action)) {
    throw new AuthorizationError('Insufficient permissions');
  }
}

function combineOr(conditions: SQL<unknown>[]): SQL<unknown> | undefined {
  if (conditions.length === 0) {
    return undefined;
  }
  if (conditions.length === 1) {
    return conditions[0];
  }
  const [first, second, ...rest] = conditions;
  return or(first, second, ...rest);
}

type CaseAccessProjection = Pick<
  CaseRecord,
  'department' | 'ownerId' | 'assignedLawyerId' | 'assignedAssistantId' | 'assignedTrialLawyerId'
>;

interface CaseAccessContext {
  allowAll: boolean;
  departments: Set<(typeof departmentEnum.enumValues)[number]>;
  ownerIds: Set<string>;
  assignedLawyerIds: Set<string>;
  assignedAssistantIds: Set<string>;
  assignedTrialLawyerIds: Set<string>;
}

async function buildCaseAccessContext(user: SessionUser): Promise<CaseAccessContext> {
  if (isSuperAdmin(user)) {
    return {
      allowAll: true,
      departments: new Set(),
      ownerIds: new Set(),
      assignedLawyerIds: new Set(),
      assignedAssistantIds: new Set(),
      assignedTrialLawyerIds: new Set()
    } satisfies CaseAccessContext;
  }

  const context: CaseAccessContext = {
    allowAll: false,
    departments: new Set(),
    ownerIds: new Set([user.id]),
    assignedLawyerIds: new Set([user.id]),
    assignedAssistantIds: new Set([user.id]),
    assignedTrialLawyerIds: new Set([user.id])
  };

  if ((user.role === 'admin' || user.role === 'administration') && user.department) {
    context.departments.add(user.department as (typeof departmentEnum.enumValues)[number]);
  }

  if (user.role === 'lawyer') {
    const assistants = await db.query.users.findMany({
      columns: {
        id: true,
        role: true
      },
      where: eq(users.supervisorId, user.id)
    });

    assistants
      .filter((member) => member.role === 'assistant')
      .forEach((assistant) => {
        context.assignedAssistantIds.add(assistant.id);
        context.ownerIds.add(assistant.id);
      });
  }

  if (user.role === 'assistant' && user.supervisorId) {
    const supervisor = await db.query.users.findFirst({
      columns: {
        id: true,
        role: true
      },
      where: eq(users.id, user.supervisorId)
    });

    if (supervisor?.role === 'lawyer') {
      context.assignedLawyerIds.add(supervisor.id);
      context.assignedTrialLawyerIds.add(supervisor.id);
      context.ownerIds.add(supervisor.id);
    }
  }

  return context;
}

function buildColumnCondition(
  column:
    | typeof cases.ownerId
    | typeof cases.assignedLawyerId
    | typeof cases.assignedAssistantId
    | typeof cases.assignedTrialLawyerId,
  ids: Set<string>
): SQL<unknown> | undefined {
  const values = Array.from(ids).filter((value) => Boolean(value && value.trim().length > 0));
  if (values.length === 0) {
    return undefined;
  }
  if (values.length === 1) {
    return eq(column, values[0]);
  }
  return inArray(column, values);
}

function buildAccessWhere(context: CaseAccessContext): SQL<unknown> | undefined {
  if (context.allowAll) {
    return undefined;
  }

  const orConditions: SQL<unknown>[] = [];

  for (const department of context.departments) {
    orConditions.push(eq(cases.department, department));
  }

  const ownerCondition = buildColumnCondition(cases.ownerId, context.ownerIds);
  if (ownerCondition) {
    orConditions.push(ownerCondition);
  }

  const assignedLawyerCondition = buildColumnCondition(cases.assignedLawyerId, context.assignedLawyerIds);
  if (assignedLawyerCondition) {
    orConditions.push(assignedLawyerCondition);
  }

  const assistantCondition = buildColumnCondition(cases.assignedAssistantId, context.assignedAssistantIds);
  if (assistantCondition) {
    orConditions.push(assistantCondition);
  }

  const trialLawyerCondition = buildColumnCondition(cases.assignedTrialLawyerId, context.assignedTrialLawyerIds);
  if (trialLawyerCondition) {
    orConditions.push(trialLawyerCondition);
  }

  return combineOr(orConditions);
}

function canAccessCase(context: CaseAccessContext, record: CaseAccessProjection): boolean {
  if (context.allowAll) {
    return true;
  }

  if (record.department && context.departments.has(record.department)) {
    return true;
  }

  if (record.ownerId && context.ownerIds.has(record.ownerId)) {
    return true;
  }

  if (record.assignedLawyerId && context.assignedLawyerIds.has(record.assignedLawyerId)) {
    return true;
  }

  if (record.assignedAssistantId && context.assignedAssistantIds.has(record.assignedAssistantId)) {
    return true;
  }

  if (record.assignedTrialLawyerId && context.assignedTrialLawyerIds.has(record.assignedTrialLawyerId)) {
    return true;
  }

  return false;
}

function mergeWhere(base?: SQL<unknown>, access?: SQL<unknown>): SQL<unknown> | undefined {
  if (base && access) {
    return and(base, access);
  }
  return base ?? access ?? undefined;
}

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_ORDER_BY: ListCasesOptions['orderBy'] = 'createdAt';
const DEFAULT_ORDER_DIRECTION: ListCasesOptions['orderDirection'] = 'desc';

function normalizeNumericInput(value: string | number | null | undefined): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return typeof value === 'number' ? value.toString() : value;
}

function normalizeDateInput(value: string | Date | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toISOString().slice(0, 10);
}

function normalizeTimestampInput(value: string | Date | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed;
}

function normalizeTextInput(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeTrialStageInput(value: TrialStage | string | null | undefined): TrialStage | null {
  if (!value) {
    return null;
  }
  const normalized = String(value) as TrialStage;
  return (trialStageEnum.enumValues as readonly TrialStage[]).includes(normalized) ? normalized : null;
}

function formatValueForLog(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return formatTimestamp(value);
  }
  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toString() : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return JSON.stringify(value);
}

const CHANGE_FIELD_LABEL_MAP: Record<
  | 'caseType'
  | 'caseLevel'
  | 'provinceCity'
  | 'targetAmount'
  | 'feeStandard'
  | 'agencyFeeEstimate'
  | 'dataSource'
  | 'hasContract'
  | 'hasSocialSecurity'
  | 'entryDate'
  | 'injuryLocation'
  | 'injurySeverity'
  | 'injuryCause'
  | 'workInjuryCertified'
  | 'monthlySalary'
  | 'appraisalLevel'
  | 'appraisalEstimate'
  | 'existingEvidence'
  | 'customerCooperative'
  | 'witnessCooperative'
  | 'remark'
  | 'department'
  | 'ownerId'
  | 'assignedLawyerId'
  | 'assignedAssistantId'
  | 'assignedTrialLawyerId'
  | 'caseStatus'
  | 'closedReason'
  | 'voidReason'
  | 'salesCommission'
  | 'handlingFee',
  string
> = {
  caseType: '案件类型',
  caseLevel: '案件级别',
  provinceCity: '省市',
  targetAmount: '诉求金额',
  feeStandard: '收费标准',
  agencyFeeEstimate: '预估服务费',
  dataSource: '数据来源',
  hasContract: '合同签订',
  hasSocialSecurity: '社保情况',
  entryDate: '进件日期',
  injuryLocation: '受伤地点',
  injurySeverity: '伤情程度',
  injuryCause: '受伤原因',
  workInjuryCertified: '工伤认定',
  monthlySalary: '月工资',
  appraisalLevel: '鉴定等级',
  appraisalEstimate: '鉴定预估',
  existingEvidence: '现有证据',
  customerCooperative: '客户配合度',
  witnessCooperative: '证人配合度',
  remark: '备注',
  department: '所属部门',
  ownerId: '跟进人',
  assignedLawyerId: '签约律师',
  assignedAssistantId: '律师助理',
  assignedTrialLawyerId: '诉讼律师',
  caseStatus: '案件状态',
  closedReason: '结案原因',
  voidReason: '废单原因',
  salesCommission: '销售提成',
  handlingFee: '办案费用'
};

type ChangeFieldKey = keyof typeof CHANGE_FIELD_LABEL_MAP;

function buildChangeDetails(
  previous: typeof cases.$inferSelect,
  next: typeof cases.$inferSelect
): CaseChangeDetail[] {
  const details: CaseChangeDetail[] = [];

  (Object.keys(CHANGE_FIELD_LABEL_MAP) as ChangeFieldKey[]).forEach((field) => {
    const prevRaw = previous[field];
    const nextRaw = next[field];

    const prevValue = formatValueForLog(prevRaw);
    const nextValue = formatValueForLog(nextRaw);

    if (prevValue === nextValue) {
      return;
    }

    details.push({
      field,
      label: CHANGE_FIELD_LABEL_MAP[field],
      previousValue: prevValue,
      currentValue: nextValue
    });
  });

  return details;
}

function buildChangeDescription(changes: CaseChangeDetail[], input?: CaseInput): string {
  if (changes.length === 1) {
    const change = changes[0];
    const prev = change.previousValue ?? '—';
    const next = change.currentValue ?? '—';
    return `更新${change.label}：${prev} -> ${next}`;
  }

  if (changes.length > 1) {
    const fieldLabels = changes.slice(0, 3).map((item) => item.label).join('、');
    const suffix = changes.length > 3 ? '等' : '';
    return `更新${fieldLabels}${suffix}`;
  }

  if (input?.timeline) {
    return '更新案件跟进记录';
  }
  if (input?.hearing !== undefined) {
    return '更新庭审信息';
  }
  if (input?.participants) {
    return '更新参与人员';
  }
  if (input?.collections) {
    return '更新回款记录';
  }

  return '更新案件信息';
}

function buildCaseValues(input: CaseInput): typeof cases.$inferInsert {
  const values: Partial<typeof cases.$inferInsert> = {
    caseType: input.caseType,
    caseLevel: input.caseLevel
  };

  if (input.referenceNo !== undefined) {
    values.referenceNo = input.referenceNo ?? null;
  }
  if (input.provinceCity !== undefined) {
    values.provinceCity = input.provinceCity ?? null;
  }
  if (input.targetAmount !== undefined) {
    values.targetAmount = normalizeNumericInput(input.targetAmount);
  }
  if (input.feeStandard !== undefined) {
    values.feeStandard = input.feeStandard ?? null;
  }
  if (input.agencyFeeEstimate !== undefined) {
    values.agencyFeeEstimate = normalizeNumericInput(input.agencyFeeEstimate);
  }
  if (input.dataSource !== undefined) {
    values.dataSource = input.dataSource ?? null;
  }
  if (input.hasContract !== undefined) {
    values.hasContract = input.hasContract ?? null;
  }
  if (input.hasSocialSecurity !== undefined) {
    values.hasSocialSecurity = input.hasSocialSecurity ?? null;
  }
  if (input.entryDate !== undefined) {
    values.entryDate = normalizeDateInput(input.entryDate);
  }
  if (input.injuryLocation !== undefined) {
    values.injuryLocation = input.injuryLocation ?? null;
  }
  if (input.injurySeverity !== undefined) {
    values.injurySeverity = input.injurySeverity ?? null;
  }
  if (input.injuryCause !== undefined) {
    values.injuryCause = input.injuryCause ?? null;
  }
  if (input.workInjuryCertified !== undefined) {
    values.workInjuryCertified = input.workInjuryCertified ?? null;
  }
  if (input.monthlySalary !== undefined) {
    values.monthlySalary = normalizeNumericInput(input.monthlySalary);
  }
  if (input.appraisalLevel !== undefined) {
    values.appraisalLevel = input.appraisalLevel ?? null;
  }
  if (input.appraisalEstimate !== undefined) {
    values.appraisalEstimate = input.appraisalEstimate ?? null;
  }
  if (input.existingEvidence !== undefined) {
    values.existingEvidence = input.existingEvidence ?? null;
  }
  if (input.customerCooperative !== undefined) {
    values.customerCooperative = input.customerCooperative ?? null;
  }
  if (input.witnessCooperative !== undefined) {
    values.witnessCooperative = input.witnessCooperative ?? null;
  }
  if (input.remark !== undefined) {
    values.remark = input.remark ?? null;
  }
  if (input.department !== undefined) {
    values.department = input.department ?? null;
  }
  if (input.ownerId !== undefined) {
    values.ownerId = input.ownerId ?? null;
  }
  if (input.assignedLawyerId !== undefined) {
    values.assignedLawyerId = input.assignedLawyerId ?? null;
  }
  if (input.assignedAssistantId !== undefined) {
    values.assignedAssistantId = input.assignedAssistantId ?? null;
  }
  if (input.assignedTrialLawyerId !== undefined) {
    values.assignedTrialLawyerId = input.assignedTrialLawyerId ?? null;
  }
  if (input.caseStatus !== undefined) {
    values.caseStatus = input.caseStatus ?? '未结案';
  }
  if (input.closedReason !== undefined) {
    values.closedReason = input.closedReason ?? null;
  }
  if (input.voidReason !== undefined) {
    values.voidReason = input.voidReason ?? null;
  }
  if (input.lawyerProgress !== undefined) {
    values.lawyerProgress = input.lawyerProgress ?? null;
  }
  if (input.salesCommission !== undefined) {
    values.salesCommission = normalizeNumericInput(input.salesCommission);
  }
  if (input.handlingFee !== undefined) {
    values.handlingFee = normalizeNumericInput(input.handlingFee);
  }

  return values as typeof cases.$inferInsert;
}

function flattenParticipantsInput(participants?: CaseParticipantsInput, caseId?: string) {
  const results: (typeof caseParticipants.$inferInsert)[] = [];
  if (!participants || !caseId) {
    return results;
  }

  const pushParticipant = (
    role: ParticipantRole,
    list: CaseParticipantInput[] | undefined,
    offset = 0
  ) => {
    if (!list) {
      return;
    }
    list.forEach((participant, index) => {
      if (!participant?.name) {
        return;
      }
      results.push({
        caseId,
        role,
        entityType: participant.entityType ?? null,
        name: participant.name,
        idNumber: participant.idNumber ?? null,
        phone: participant.phone ?? null,
        address: participant.address ?? null,
        isDishonest: participant.isDishonest ?? false,
        sortOrder:
          participant.sortOrder ??
          index + offset
      });
    });
  };

  pushParticipant('claimant', participants.claimants);
  pushParticipant('respondent', participants.respondents, participants.claimants?.length ?? 0);
  return results;
}



function formatDateOnly(value: string | Date | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (value.length === 10 && value.match(/\d{4}-\d{2}-\d{2}/)) {
    return value;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString().slice(0, 10);
}

function formatTimestamp(value: string | Date | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

function formatNumeric(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return typeof value === 'string' ? value : value.toString();
}

function mapParticipant(record: CaseParticipantRecord): CaseParticipantDTO {
  return {
    id: record.id,
    entityType: record.entityType,
    name: record.name,
    idNumber: record.idNumber,
    phone: record.phone,
    address: record.address,
    isDishonest: record.isDishonest ?? false,
    sortOrder: record.sortOrder ?? null
  };
}

function mapCollection(record: CaseCollectionRecord): CaseCollectionDTO {
  return {
    id: record.id,
    amount: formatNumeric(record.amount) ?? '0',
    receivedAt: formatDateOnly(record.receivedAt) ?? formatDateOnly(new Date())!,
    createdAt: formatTimestamp(record.createdAt) ?? new Date().toISOString(),
    updatedAt: formatTimestamp(record.updatedAt) ?? new Date().toISOString()
  };
}

function mapTimeline(record: CaseTimelineRecordWithFollower): CaseTimelineDTO {
  return {
    id: record.id,
    nodeType: record.nodeType,
    occurredOn: formatDateOnly(record.occurredOn) ?? formatDateOnly(new Date())!,
    createdAt: formatTimestamp(record.createdAt) ?? new Date().toISOString(),
    updatedAt: formatTimestamp(record.updatedAt) ?? new Date().toISOString(),
    note: record.note ?? null,
    followerId: record.followerId ?? null,
    followerName: record.follower ? record.follower.name ?? null : null
  };
}

function mapHearing(record?: CaseHearingRecord | null): CaseHearingDTO | null {
  if (!record) {
    return null;
  }

  return {
    hearingTime: formatTimestamp(record.hearingTime),
    hearingLocation: record.hearingLocation ?? null,
    tribunal: record.tribunal ?? null,
    judge: record.judge ?? null,
    caseNumber: record.caseNumber ?? null,
    contactPhone: record.contactPhone ?? null,
    trialStage: record.trialStage ?? null,
    hearingResult: record.hearingResult ?? null
  } satisfies CaseHearingDTO;
}

function mapCaseRecord(record: CaseWithRelations): CaseDTO {
  const participants = [...(record.participants ?? [])].sort((a, b) => {
    const aOrder = a.sortOrder ?? 0;
    const bOrder = b.sortOrder ?? 0;
    return aOrder - bOrder;
  });

  const claimants = participants
    .filter((participant) => participant.role === 'claimant')
    .map(mapParticipant);

  const respondents = participants
    .filter((participant) => participant.role === 'respondent')
    .map(mapParticipant);

  const collections = [...(record.collections ?? [])]
    .sort((a, b) => {
      const aDate = new Date(a.receivedAt ?? 0).getTime();
      const bDate = new Date(b.receivedAt ?? 0).getTime();
      return bDate - aDate;
    })
    .map(mapCollection);

  const timeline = [...(record.timeline ?? [])]
    .sort((a, b) => {
      const aDate = new Date(a.occurredOn ?? 0).getTime();
      const bDate = new Date(b.occurredOn ?? 0).getTime();
      return aDate - bDate;
    })
    .map(mapTimeline);

  return {
    id: record.id,
    referenceNo: record.referenceNo ?? null,
    caseType: record.caseType,
    caseLevel: record.caseLevel,
    provinceCity: record.provinceCity ?? null,
    targetAmount: formatNumeric(record.targetAmount),
    feeStandard: record.feeStandard ?? null,
    agencyFeeEstimate: formatNumeric(record.agencyFeeEstimate),
    dataSource: record.dataSource ?? null,
    hasContract: record.hasContract ?? null,
    hasSocialSecurity: record.hasSocialSecurity ?? null,
    entryDate: formatDateOnly(record.entryDate),
    injuryLocation: record.injuryLocation ?? null,
    injurySeverity: record.injurySeverity ?? null,
    injuryCause: record.injuryCause ?? null,
    workInjuryCertified: record.workInjuryCertified ?? null,
    monthlySalary: formatNumeric(record.monthlySalary),
    appraisalLevel: record.appraisalLevel ?? null,
    appraisalEstimate: record.appraisalEstimate ?? null,
    existingEvidence: record.existingEvidence ?? null,
    customerCooperative: record.customerCooperative ?? null,
    witnessCooperative: record.witnessCooperative ?? null,
    remark: record.remark ?? null,
    department: record.department ?? null,
    ownerId: record.ownerId ?? null,
  ownerName: record.owner?.name ?? null,
    assignedLawyerId: record.assignedLawyerId ?? null,
  assignedLawyerName: record.assignedLawyer?.name ?? null,
    assignedAssistantId: record.assignedAssistantId ?? null,
  assignedAssistantName: record.assignedAssistant?.name ?? null,
    assignedTrialLawyerId: record.assignedTrialLawyerId ?? null,
  assignedTrialLawyerName: record.assignedTrialLawyer?.name ?? null,
    caseStatus: record.caseStatus ?? null,
    closedReason: record.closedReason ?? null,
    voidReason: record.voidReason ?? null,
    lawyerProgress: (record.lawyerProgress ?? null) as Record<string, unknown> | null,
  salesCommission: formatNumeric(record.salesCommission),
  handlingFee: formatNumeric(record.handlingFee),
    createdAt: formatTimestamp(record.createdAt) ?? new Date().toISOString(),
    updatedAt: formatTimestamp(record.updatedAt) ?? new Date().toISOString(),
    participants: {
      claimants,
      respondents
    },
    collections,
    timeline,
    hearing: mapHearing(record.hearing)
  };
}

function mapCaseChangeLog(record: CaseChangeLogRecord): CaseChangeLogDTO {
  return {
    id: record.id,
    action: record.action,
    description: record.description ?? null,
    changes: (record.changes ?? null) as CaseChangeDetail[] | null,
    actorId: record.actorId ?? null,
    actorName: record.actor?.name ?? record.actorName ?? null,
    actorRole: record.actorRole ?? record.actor?.role ?? null,
    createdAt: formatTimestamp(record.createdAt) ?? new Date().toISOString()
  } satisfies CaseChangeLogDTO;
}

function buildWhereClause(options: CaseListFilters): SQL<unknown> | undefined {
  const conditions: SQL<unknown>[] = [];

  if (options.department) {
    conditions.push(eq(cases.department, options.department));
  }
  if (options.ownerId) {
    conditions.push(eq(cases.ownerId, options.ownerId));
  }
  if (options.assignedLawyerId) {
    conditions.push(eq(cases.assignedLawyerId, options.assignedLawyerId));
  }
  if (options.caseType) {
    conditions.push(eq(cases.caseType, options.caseType));
  }
  if (options.caseLevel) {
    conditions.push(eq(cases.caseLevel, options.caseLevel));
  }
  if (options.caseStatus) {
    conditions.push(eq(cases.caseStatus, options.caseStatus));
  }

  const trimmedSearch = options.search?.trim();
  if (trimmedSearch) {
    const term = `%${trimmedSearch}%`;

    const searchCondition = sql<unknown>`
      (
        ${cases.referenceNo} ILIKE ${term}
        OR ${cases.provinceCity} ILIKE ${term}
        OR EXISTS (
          SELECT 1
          FROM ${caseHearings}
          WHERE ${caseHearings.caseId} = ${cases.id}
            AND (
              ${caseHearings.caseNumber} ILIKE ${term}
              OR ${caseHearings.tribunal} ILIKE ${term}
              OR ${caseHearings.judge} ILIKE ${term}
            )
        )
      )
    `;

    conditions.push(searchCondition);
  }

  if (conditions.length === 0) {
    return undefined;
  }

  if (conditions.length === 1) {
    return conditions[0];
  }

  return and(...conditions);
}

function normalizeCollectionsInput(collections?: CaseCollectionInput[], caseId?: string) {
  if (!collections || !caseId) {
    return [] as (typeof caseCollections.$inferInsert)[];
  }

  return collections
    .filter((item): item is CaseCollectionInput => Boolean(item))
    .map((item) => {
      const amount = normalizeNumericInput(item.amount) ?? '0';
      const receivedAt =
        normalizeDateInput(item.receivedAt) ?? new Date().toISOString().slice(0, 10);
      return {
        caseId,
        amount,
        receivedAt
      } satisfies typeof caseCollections.$inferInsert;
    });
}

function normalizeTimelineInput(timeline?: CaseTimelineInput[], caseId?: string) {
  if (!timeline || !caseId) {
    return [] as (typeof caseTimeline.$inferInsert)[];
  }

  return timeline
    .filter((item): item is CaseTimelineInput => Boolean(item && item.nodeType && item.occurredOn))
    .map((item) => {
      const occurredOn =
        normalizeDateInput(item.occurredOn) ?? new Date().toISOString().slice(0, 10);
      const note = typeof item.note === 'string' ? item.note.trim() : null;
      return {
        caseId,
        nodeType: item.nodeType,
        occurredOn,
        note: note && note.length > 0 ? note : null,
        followerId: item.followerId ?? null
      } satisfies typeof caseTimeline.$inferInsert;
    });
}

function normalizeHearingInput(hearing?: CaseHearingInput | null, caseId?: string) {
  if (!hearing || !caseId) {
    return null;
  }

  const result = {
    caseId,
    hearingTime: normalizeTimestampInput(hearing.hearingTime) ?? null,
    hearingLocation: normalizeTextInput(hearing.hearingLocation),
    tribunal: normalizeTextInput(hearing.tribunal),
    judge: normalizeTextInput(hearing.judge),
    caseNumber: normalizeTextInput(hearing.caseNumber),
    contactPhone: normalizeTextInput(hearing.contactPhone),
    trialStage: normalizeTrialStageInput(hearing.trialStage ?? null),
    hearingResult: normalizeTextInput(hearing.hearingResult)
  } satisfies typeof caseHearings.$inferInsert;

  const hasData =
    result.hearingTime !== null ||
    result.hearingLocation !== null ||
    result.tribunal !== null ||
    result.judge !== null ||
    result.caseNumber !== null ||
    result.contactPhone !== null ||
    result.trialStage !== null ||
    result.hearingResult !== null;

  return hasData ? result : null;
}

export async function listCases(options: ListCasesOptions = {}, user: SessionUser) {
  ensureCasePermission(user, 'list');

  const page = Math.max(options.page ?? DEFAULT_PAGE, 1);
  const pageSize = Math.min(Math.max(options.pageSize ?? DEFAULT_PAGE_SIZE, 1), 100);
  const offset = (page - 1) * pageSize;
  const orderDirection = options.orderDirection ?? DEFAULT_ORDER_DIRECTION;
  const orderByField = options.orderBy ?? DEFAULT_ORDER_BY;

  const filterWhere = buildWhereClause(options);
  const accessContext = await buildCaseAccessContext(user);
  const accessWhere = buildAccessWhere(accessContext);
  const where = mergeWhere(filterWhere, accessWhere);

  const records = await db.query.cases.findMany({
    with: {
      owner: {
        columns: {
          id: true,
          name: true,
          role: true
        }
      },
      assignedLawyer: {
        columns: {
          id: true,
          name: true,
          role: true
        }
      },
      assignedAssistant: {
        columns: {
          id: true,
          name: true,
          role: true
        }
      },
      assignedTrialLawyer: {
        columns: {
          id: true,
          name: true,
          role: true
        }
      },
      participants: true,
      collections: true,
      timeline: {
        with: {
          follower: true
        }
      },
      hearing: true
    },
    where,
    orderBy: (casesTable, operators) => {
      const column = orderByField === 'updatedAt' ? casesTable.updatedAt : casesTable.createdAt;
      return orderDirection === 'asc' ? operators.asc(column) : operators.desc(column);
    },
    limit: pageSize,
    offset
  });

  const totalResult = where
    ? await db.select({ value: count() }).from(cases).where(where)
    : await db.select({ value: count() }).from(cases);

  const total = Number(totalResult?.[0]?.value ?? 0);
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return {
    data: records.map(mapCaseRecord),
    pagination: {
      page,
      pageSize,
      total,
      totalPages
    } satisfies PaginationMeta
  };
}

export async function getCaseById(id: string, user: SessionUser) {
  ensureCasePermission(user, 'list');

  const accessContext = await buildCaseAccessContext(user);
  const accessWhere = buildAccessWhere(accessContext);
  const whereClause = accessWhere ? and(eq(cases.id, id), accessWhere) : eq(cases.id, id);

  const record = await db.query.cases.findFirst({
    where: whereClause,
    with: {
      owner: {
        columns: {
          id: true,
          name: true,
          role: true
        }
      },
      assignedLawyer: {
        columns: {
          id: true,
          name: true,
          role: true
        }
      },
      assignedAssistant: {
        columns: {
          id: true,
          name: true,
          role: true
        }
      },
      assignedTrialLawyer: {
        columns: {
          id: true,
          name: true,
          role: true
        }
      },
      participants: true,
      collections: true,
      timeline: {
        with: {
          follower: true
        }
      },
      hearing: true
    }
  });

  if (!record) {
    return null;
  }

  return mapCaseRecord(record);
}

export async function createCase(input: CaseInput, user: SessionUser) {
  ensureCasePermission(user, 'create');

  return db.transaction(async (tx) => {
    const caseValues = buildCaseValues(input);
    caseValues.creatorId = user.id;
    caseValues.updaterId = user.id;

    if (isSuperAdmin(user)) {
      if (!caseValues.department) {
        throw new BadRequestError('缺少案件所属部门');
      }
    } else {
      if (!user.department) {
        throw new BadRequestError('当前账号未分配部门，无法创建案件');
      }
      caseValues.department = user.department as (typeof cases.$inferInsert)['department'];
    }

    if (!caseValues.ownerId) {
      caseValues.ownerId = user.id;
    }

    const [created] = await tx.insert(cases).values(caseValues).returning();
    if (!created) {
      throw new Error('Failed to create case');
    }

    const caseId = created.id;

    const participantValues = flattenParticipantsInput(input.participants, caseId);
    if (participantValues.length > 0) {
      await tx.insert(caseParticipants).values(participantValues);
    }

    const collectionValues = normalizeCollectionsInput(input.collections, caseId);
    if (collectionValues.length > 0) {
      await tx.insert(caseCollections).values(collectionValues);
    }

    const timelineValues = normalizeTimelineInput(input.timeline, caseId);
    if (timelineValues.length > 0) {
      await tx.insert(caseTimeline).values(timelineValues);
    }

    const hearingValue = normalizeHearingInput(input.hearing, caseId);
    if (hearingValue) {
      await tx.insert(caseHearings).values(hearingValue);
    }

    const actor = extractActorContext(user);
    await tx.insert(caseChangeLogs).values({
      caseId,
      action: 'create',
      description: '创建案件',
      changes: null,
      actorId: actor.actorId,
      actorName: actor.actorName,
      actorRole: actor.actorRole
    });

    const fullRecord = await tx.query.cases.findFirst({
      where: eq(cases.id, caseId),
      with: {
        owner: {
          columns: {
            id: true,
            name: true,
            role: true
          }
        },
        assignedLawyer: {
          columns: {
            id: true,
            name: true,
            role: true
          }
        },
        assignedAssistant: {
          columns: {
            id: true,
            name: true,
            role: true
          }
        },
        assignedTrialLawyer: {
          columns: {
            id: true,
            name: true,
            role: true
          }
        },
        participants: true,
        collections: true,
        timeline: {
          with: {
            follower: true
          }
        },
        hearing: true
      }
    });

    if (!fullRecord) {
      throw new Error('Failed to load created case');
    }

    return mapCaseRecord(fullRecord);
  });
}

export async function updateCase(id: string, input: CaseInput, user: SessionUser) {
  ensureCasePermission(user, 'update');

  const accessContext = await buildCaseAccessContext(user);

  const existing = await db.query.cases.findFirst({
    where: eq(cases.id, id)
  });

  if (!existing) {
    return null;
  }

  if (!canAccessCase(accessContext, existing)) {
    throw new AuthorizationError();
  }

  return db.transaction(async (tx) => {
    const caseValues = buildCaseValues(input);
    caseValues.updaterId = user.id;
    caseValues.updatedAt = new Date();

    if (input.department === undefined) {
      if (existing.department) {
        caseValues.department = existing.department;
      } else if ((user.role === 'admin' || user.role === 'administration' || isSuperAdmin(user)) && user.department) {
        caseValues.department = user.department as (typeof cases.$inferInsert)['department'];
      }
    }

    if (input.ownerId === undefined) {
      if (existing.ownerId) {
        caseValues.ownerId = existing.ownerId;
      } else if (user.role === 'admin' || user.role === 'administration' || isSuperAdmin(user)) {
        caseValues.ownerId = user.id;
      }
    }

    const [updatedCase] = await tx
      .update(cases)
      .set(caseValues)
      .where(eq(cases.id, id))
      .returning();

    if (!updatedCase) {
      return null;
    }

    const changeDetails = buildChangeDetails(existing, updatedCase);
    const shouldLog =
      changeDetails.length > 0 ||
      Boolean(input.timeline || input.hearing !== undefined || input.participants || input.collections);

    if (shouldLog) {
      const actor = extractActorContext(user);
      await tx.insert(caseChangeLogs).values({
        caseId: id,
        action: 'update',
        description: buildChangeDescription(changeDetails, input),
        changes: changeDetails.length > 0 ? changeDetails : null,
        actorId: actor.actorId,
        actorName: actor.actorName,
        actorRole: actor.actorRole
      });
    }

    if (input.participants) {
      await tx.delete(caseParticipants).where(eq(caseParticipants.caseId, id));
      const participantValues = flattenParticipantsInput(input.participants, id);
      if (participantValues.length > 0) {
        await tx.insert(caseParticipants).values(participantValues);
      }
    }

    if (input.collections) {
      await tx.delete(caseCollections).where(eq(caseCollections.caseId, id));
      const collectionValues = normalizeCollectionsInput(input.collections, id);
      if (collectionValues.length > 0) {
        await tx.insert(caseCollections).values(collectionValues);
      }
    }

    if (input.timeline) {
      await tx.delete(caseTimeline).where(eq(caseTimeline.caseId, id));
      const timelineValues = normalizeTimelineInput(input.timeline, id);
      if (timelineValues.length > 0) {
        await tx.insert(caseTimeline).values(timelineValues);
      }
    }

    if (input.hearing !== undefined) {
      await tx.delete(caseHearings).where(eq(caseHearings.caseId, id));
      const hearingValue = normalizeHearingInput(input.hearing, id);
      if (hearingValue) {
        await tx.insert(caseHearings).values(hearingValue);
      }
    }

    const fullRecord = await tx.query.cases.findFirst({
      where: eq(cases.id, id),
      with: {
        owner: {
          columns: {
            id: true,
            name: true,
            role: true
          }
        },
        assignedLawyer: {
          columns: {
            id: true,
            name: true,
            role: true
          }
        },
        assignedAssistant: {
          columns: {
            id: true,
            name: true,
            role: true
          }
        },
        assignedTrialLawyer: {
          columns: {
            id: true,
            name: true,
            role: true
          }
        },
        participants: true,
        collections: true,
        timeline: {
          with: {
            follower: true
          }
        },
        hearing: true
      }
    });

    if (!fullRecord) {
      return null;
    }

    return mapCaseRecord(fullRecord);
  });
}

export async function deleteCase(id: string, user: SessionUser) {
  ensureCasePermission(user, 'delete');

  const accessContext = await buildCaseAccessContext(user);

  const existing = await db.query.cases.findFirst({
    where: eq(cases.id, id),
    columns: {
      id: true,
      ownerId: true,
      department: true,
      assignedLawyerId: true,
      assignedAssistantId: true,
      assignedTrialLawyerId: true
    }
  });

  if (!existing) {
    return null;
  }

  if (!canAccessCase(accessContext, existing)) {
    throw new AuthorizationError();
  }

  const [deleted] = await db.delete(cases).where(eq(cases.id, id)).returning({ id: cases.id });
  return deleted?.id ?? null;
}

export async function getCaseChangeLogs(
  caseId: string,
  user: SessionUser
): Promise<CaseChangeLogDTO[] | null> {
  ensureCasePermission(user, 'list');

  const accessContext = await buildCaseAccessContext(user);

  const existing = await db.query.cases.findFirst({
    where: eq(cases.id, caseId),
    columns: {
      id: true,
      ownerId: true,
      department: true,
      assignedLawyerId: true,
      assignedAssistantId: true,
      assignedTrialLawyerId: true
    }
  });

  if (!existing) {
    return null;
  }

  if (!canAccessCase(accessContext, existing)) {
    throw new AuthorizationError();
  }

  const records = await db.query.caseChangeLogs.findMany({
    where: eq(caseChangeLogs.caseId, caseId),
    orderBy: (table, operators) => operators.desc(table.createdAt),
    with: {
      actor: {
        columns: {
          id: true,
          name: true,
          role: true
        }
      }
    }
  });

  return records.map(mapCaseChangeLog);
}

interface AssignableStaffMemberDTO {
  id: string;
  name: string | null;
  role: string;
  department: (typeof departmentEnum.enumValues)[number] | null;
}

export interface AssignableStaffDTO {
  lawyers: AssignableStaffMemberDTO[];
  assistants: AssignableStaffMemberDTO[];
}

const ASSIGNABLE_ROLES = new Set(['super_admin', 'admin', 'administration']);

function extractActorContext(user: SessionUser) {
  return {
    actorId: user.id,
    actorName: user.name ?? null,
    actorRole: user.role
  };
}

function sortStaff(list: AssignableStaffMemberDTO[]): AssignableStaffMemberDTO[] {
  return [...list].sort((a, b) => {
    const nameA = a.name ?? '';
    const nameB = b.name ?? '';
    return nameA.localeCompare(nameB, 'zh-Hans-CN');
  });
}

export async function getAssignableStaff(
  user: SessionUser,
  department?: string | null
): Promise<AssignableStaffDTO> {
  if (!ASSIGNABLE_ROLES.has(user.role)) {
    throw new AuthorizationError('Insufficient permissions');
  }

  const validDepartments = new Set<string>(departmentEnum.enumValues);
  const normalizedDepartment = department && validDepartments.has(department) ? department : undefined;

  const members = await db.query.users.findMany({
    columns: {
      id: true,
      name: true,
      role: true,
      department: true,
      supervisorId: true,
      banned: true
    }
  });

  const activeMembers = members.filter((member) => !member.banned);

  const toDTO = (member: typeof members[number]): AssignableStaffMemberDTO => ({
    id: member.id,
    name: member.name ?? null,
    role: member.role ?? '',
    department: (member.department as (typeof departmentEnum.enumValues)[number] | null) ?? null
  });

  const filterByDepartment = <T extends typeof members[number]>(
    list: T[],
    fallbackDepartment?: string | null
  ) => {
    const targetDepartment = normalizedDepartment ?? fallbackDepartment ?? null;
    if (!targetDepartment) {
      return list;
    }
    return list.filter((member) => member.department === targetDepartment);
  };

  let lawyerCandidates: typeof members = [];
  let assistantCandidates: typeof members = [];

  if (user.role === 'super_admin') {
    if (!normalizedDepartment) {
      throw new BadRequestError('缺少部门参数');
    }
    const filtered = filterByDepartment(activeMembers, normalizedDepartment);
    lawyerCandidates = filtered.filter((member) => member.role === 'lawyer');
    assistantCandidates = filtered.filter((member) => member.role === 'assistant');
  } else if (user.role === 'admin') {
    const subordinates = activeMembers.filter((member) => member.supervisorId === user.id);
    const filtered = filterByDepartment(subordinates, user.department ?? null);
    lawyerCandidates = filtered.filter((member) => member.role === 'lawyer');
    assistantCandidates = filtered.filter((member) => member.role === 'assistant');
  } else {
    const managerId = user.supervisorId;
    if (!managerId) {
      throw new AuthorizationError('未找到上级管理员，无法获取候选人员');
    }
    const manager = activeMembers.find((member) => member.id === managerId && member.role === 'admin');
    if (!manager) {
      throw new AuthorizationError('未找到上级管理员，无法获取候选人员');
    }
    const managerSubordinates = activeMembers.filter((member) => member.supervisorId === manager.id);
    const filtered = filterByDepartment(managerSubordinates, manager.department ?? null);
    lawyerCandidates = filtered.filter((member) => member.role === 'lawyer');
    assistantCandidates = filtered.filter((member) => member.role === 'assistant');
  }

  return {
    lawyers: sortStaff(lawyerCandidates.map(toDTO)),
    assistants: sortStaff(assistantCandidates.map(toDTO))
  };
}
