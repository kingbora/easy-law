import { and, count, eq, or, sql, type SQL } from 'drizzle-orm';

import { db } from '../db/client';
import type { users } from '../db/schema/auth-schema';
import { departmentEnum } from '../db/schema/auth-schema';
import type {
  caseLevelEnum,
  caseStatusEnum,
  caseTypeEnum,
  participantEntityEnum,
  participantRoleEnum,
  timelineNodeEnum
} from '../db/schema/case-schema';
import {
  caseCollections,
  caseParticipants,
  cases,
  caseHearings,
  caseTimeline,
  trialStageEnum
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
  administration: new Set(['list']),
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
  assignedLawyerId: string | null;
  assignedAssistantId: string | null;
  assignedTrialLawyerId: string | null;
  caseStatus: CaseStatus | null;
  closedReason: string | null;
  voidReason: string | null;
  lawyerProgress: Record<string, unknown> | null;
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

function buildAccessCondition(user: SessionUser): SQL<unknown> | undefined {
  if (isSuperAdmin(user)) {
    return undefined;
  }

  const orConditions: SQL<unknown>[] = [];

  const userDepartment = user.department as (typeof cases.$inferSelect)['department'];
  if (userDepartment) {
    orConditions.push(eq(cases.department, userDepartment));
  }

  orConditions.push(eq(cases.ownerId, user.id));
  orConditions.push(eq(cases.assignedLawyerId, user.id));
  orConditions.push(eq(cases.assignedAssistantId, user.id));
  orConditions.push(eq(cases.assignedTrialLawyerId, user.id));

  return combineOr(orConditions);
}

type CaseAccessProjection = Pick<
  CaseRecord,
  'department' | 'ownerId' | 'assignedLawyerId' | 'assignedAssistantId' | 'assignedTrialLawyerId'
>;

function canAccessCase(user: SessionUser, record: CaseAccessProjection): boolean {
  if (isSuperAdmin(user)) {
    return true;
  }

  if (user.department && record.department === user.department) {
    return true;
  }

  const userId = user.id;
  return (
    record.ownerId === userId ||
    record.assignedLawyerId === userId ||
    record.assignedAssistantId === userId ||
    record.assignedTrialLawyerId === userId
  );
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

function buildCaseValues(input: CaseInput): typeof cases.$inferInsert {
  return {
    referenceNo: input.referenceNo ?? null,
    caseType: input.caseType,
    caseLevel: input.caseLevel,
    provinceCity: input.provinceCity ?? null,
    targetAmount: normalizeNumericInput(input.targetAmount),
    feeStandard: input.feeStandard ?? null,
    agencyFeeEstimate: normalizeNumericInput(input.agencyFeeEstimate),
    dataSource: input.dataSource ?? null,
    hasContract: input.hasContract ?? null,
    hasSocialSecurity: input.hasSocialSecurity ?? null,
    entryDate: normalizeDateInput(input.entryDate),
    injuryLocation: input.injuryLocation ?? null,
    injurySeverity: input.injurySeverity ?? null,
    injuryCause: input.injuryCause ?? null,
    workInjuryCertified: input.workInjuryCertified ?? null,
    monthlySalary: normalizeNumericInput(input.monthlySalary),
    appraisalLevel: input.appraisalLevel ?? null,
    appraisalEstimate: input.appraisalEstimate ?? null,
    existingEvidence: input.existingEvidence ?? null,
    customerCooperative: input.customerCooperative ?? null,
    witnessCooperative: input.witnessCooperative ?? null,
    remark: input.remark ?? null,
    department: input.department ?? null,
    ownerId: input.ownerId ?? null,
    assignedLawyerId: input.assignedLawyerId ?? null,
    assignedAssistantId: input.assignedAssistantId ?? null,
    assignedTrialLawyerId: input.assignedTrialLawyerId ?? null,
    caseStatus: input.caseStatus ?? '未结案',
    closedReason: input.closedReason ?? null,
    voidReason: input.voidReason ?? null,
    lawyerProgress: input.lawyerProgress ?? null
  } satisfies typeof cases.$inferInsert;
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
    assignedLawyerId: record.assignedLawyerId ?? null,
    assignedAssistantId: record.assignedAssistantId ?? null,
    assignedTrialLawyerId: record.assignedTrialLawyerId ?? null,
    caseStatus: record.caseStatus ?? null,
    closedReason: record.closedReason ?? null,
    voidReason: record.voidReason ?? null,
    lawyerProgress: (record.lawyerProgress ?? null) as Record<string, unknown> | null,
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
  const accessWhere = buildAccessCondition(user);
  const where = mergeWhere(filterWhere, accessWhere);

  const records = await db.query.cases.findMany({
    with: {
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

  const accessWhere = buildAccessCondition(user);
  const whereClause = accessWhere ? and(eq(cases.id, id), accessWhere) : eq(cases.id, id);

  const record = await db.query.cases.findFirst({
    where: whereClause,
    with: {
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

    const fullRecord = await tx.query.cases.findFirst({
      where: eq(cases.id, caseId),
      with: {
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

  if (!canAccessCase(user, existing)) {
    throw new AuthorizationError();
  }

  return db.transaction(async (tx) => {
    const caseValues = buildCaseValues(input);
    caseValues.updaterId = user.id;
    caseValues.updatedAt = new Date();

    const [updatedCase] = await tx
      .update(cases)
      .set(caseValues)
      .where(eq(cases.id, id))
      .returning();

    if (!updatedCase) {
      return null;
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

  if (!canAccessCase(user, existing)) {
    throw new AuthorizationError();
  }

  const [deleted] = await db.delete(cases).where(eq(cases.id, id)).returning({ id: cases.id });
  return deleted?.id ?? null;
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
