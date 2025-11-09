import type {
  AssignableStaffMember as SharedAssignableStaffMember,
  AssignableStaffResponse as SharedAssignableStaffResponse,
  CaseCategory as SharedCaseCategory,
  CaseChangeDetail as SharedCaseChangeDetail,
  CaseChangeLog as SharedCaseChangeLog,
  CaseCollectionInput as SharedCaseCollectionInput,
  CaseCollectionRecord as SharedCaseCollectionRecord,
  CaseHearingInput as SharedCaseHearingInput,
  CaseHearingRecord as SharedCaseHearingRecord,
  CaseParticipant as SharedCaseParticipant,
  CaseParticipantEntity as SharedCaseParticipantEntity,
  CaseParticipantInput as SharedCaseParticipantInput,
  CaseParticipantsInput as SharedCaseParticipantsInput,
  CasePayload as SharedCasePayload,
  CaseRecord as SharedCaseRecord,
  CaseStatus as SharedCaseStatus,
  CaseTableColumnKey as SharedCaseTableColumnKey,
  CaseTablePreference as SharedCaseTablePreference,
  CaseTimeNodeInput as SharedCaseTimeNodeInput,
  CaseTimeNodeRecord as SharedCaseTimeNodeRecord,
  CaseTimeNodeType as SharedCaseTimeNodeType,
  CaseTimelineInput as SharedCaseTimelineInput,
  CaseTimelineRecord as SharedCaseTimelineRecord,
  CaseUpdateConflictDetails as SharedCaseUpdateConflictDetails,
  CaseUpdateConflictField as SharedCaseUpdateConflictField,
  CaseUpdateConflictType as SharedCaseUpdateConflictType,
  CaseUpdateMeta as SharedCaseUpdateMeta,
  CaseUpdateRequest as SharedCaseUpdateRequest,
  CaseLevel as SharedCaseLevel,
  CaseType as SharedCaseType,
  ContractFormType as SharedContractFormType,
  ContractQuoteType as SharedContractQuoteType,
  LitigationFeeType as SharedLitigationFeeType,
  ListCasesOptions as SharedListCasesOptions,
  PaginationMeta as SharedPaginationMeta,
  TrialStage as SharedTrialStage,
  TravelFeeType as SharedTravelFeeType,
  UserDepartment as SharedUserDepartment,
  UserRole as SharedUserRole
} from '@easy-law/shared-types';
import { and, count, desc, eq, inArray, or, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import { db } from '../db/client';
import { departmentEnum, users } from '../db/schema/auth-schema';
import {
  caseChangeLogs,
  caseCollections,
  caseParticipants,
  cases,
  caseHearings,
  caseTablePreferences,
  caseTimeNodeTypeEnum,
  caseTimeNodes,
  caseTimeline,
  caseStatusEnum,
  caseCategoryEnum,
  contractQuoteTypeEnum,
  litigationFeeTypeEnum,
  travelFeeTypeEnum,
  contractFormEnum,
  trialStageEnum,
  participantEntityEnum,
} from '../db/schema/case-schema';
import type { SessionUser } from '../utils/auth-session';
import { BadRequestError } from '../utils/http-errors';

import { syncCaseHearingEvents } from './calendar-events-service';

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

const CASE_COLLECTION_ALLOWED_ROLES = new Set<SessionUser['role']>([
  'super_admin',
  'admin',
  'administration'
]);

const WORK_INJURY_CASE_TABLE_KEY = 'work_injury_cases';
const INSURANCE_CASE_TABLE_KEY = 'insurance_cases';

const CASE_TABLE_ALLOWED_KEYS = new Set<string>([
  WORK_INJURY_CASE_TABLE_KEY,
  INSURANCE_CASE_TABLE_KEY
]);

const CASE_TABLE_ALLOWED_COLUMNS = [
  'caseNumber',
  'caseStatus',
  'caseType',
  'caseLevel',
  'claimantNames',
  'provinceCity',
  'assignedLawyerName',
  'assignedAssistantName',
  'assignedSaleName',
  'entryDate',
  'createdAt',
  'updatedAt'
] as const;

const CASE_TABLE_COLUMN_SET = new Set<string>(CASE_TABLE_ALLOWED_COLUMNS);

const DEFAULT_CASE_TABLE_COLUMNS: SharedCaseTableColumnKey[] = [
  'caseNumber',
  'caseStatus',
  'caseType',
  'caseLevel',
  'claimantNames',
  'provinceCity',
  'assignedLawyerName',
  'assignedAssistantName'
];

function resolveCaseTableKey(tableKey?: string): string {
  if (tableKey && CASE_TABLE_ALLOWED_KEYS.has(tableKey)) {
    return tableKey;
  }
  return WORK_INJURY_CASE_TABLE_KEY;
}

function sanitizeVisibleColumns(
  columns: unknown,
  fallback: CaseTableColumnKey[] = DEFAULT_CASE_TABLE_COLUMNS
): CaseTableColumnKey[] {
  if (!Array.isArray(columns)) {
    return [...fallback];
  }

  const result: CaseTableColumnKey[] = [];

  for (const value of columns) {
    if (typeof value !== 'string') {
      continue;
    }

    if (!CASE_TABLE_COLUMN_SET.has(value)) {
      continue;
    }

    if (result.includes(value as CaseTableColumnKey)) {
      continue;
    }

    result.push(value as CaseTableColumnKey);
  }

  return result.length > 0 ? result : [...fallback];
}

const BASIC_INFO_FIELD_KEYS = [
  'caseType',
  'caseLevel',
  'provinceCity',
  'targetAmount',
  'feeStandard',
  'agencyFeeEstimate',
  'dataSource',
  'hasContract',
  'contractDate',
  'clueDate',
  'hasSocialSecurity',
  'entryDate',
  'injuryLocation',
  'injurySeverity',
  'injuryCause',
  'workInjuryCertified',
  'monthlySalary',
  'appraisalLevel',
  'appraisalEstimate',
  'existingEvidence',
  'customerCooperative',
  'witnessCooperative',
  'remark',
  'contractQuoteType',
  'contractQuoteAmount',
  'contractQuoteUpfront',
  'contractQuoteRatio',
  'contractQuoteOther',
  'estimatedCollection',
  'litigationFeeType',
  'travelFeeType',
  'contractForm',
  'insuranceRiskLevel',
  'insuranceTypes',
  'insuranceMisrepresentations',
  'caseCategory'
] as const;

export type CaseType = SharedCaseType;
export type CaseLevel = SharedCaseLevel;
export type CaseStatus = SharedCaseStatus;
export type CaseCategory = SharedCaseCategory;
export type ContractQuoteType = SharedContractQuoteType;
export type LitigationFeeType = SharedLitigationFeeType;
export type TravelFeeType = SharedTravelFeeType;
export type ContractFormType = SharedContractFormType;
export type CaseTimeNodeType = SharedCaseTimeNodeType;
export type TrialStage = SharedTrialStage;
export type ParticipantEntity = SharedCaseParticipantEntity;
export type CaseParticipantInput = SharedCaseParticipantInput;
export type CaseParticipantsInput = SharedCaseParticipantsInput;
export type CaseCollectionInput = SharedCaseCollectionInput;
export type CaseTimelineInput = SharedCaseTimelineInput;
export type CaseTimeNodeInput = SharedCaseTimeNodeInput;
export type CaseHearingInput = SharedCaseHearingInput;
export type CasePayload = SharedCasePayload;
export type CaseUpdateMeta = SharedCaseUpdateMeta;
export type CaseUpdateRequest = SharedCaseUpdateRequest;
export type CaseUpdateConflictField = SharedCaseUpdateConflictField;
export type CaseUpdateConflictDetails = SharedCaseUpdateConflictDetails;
export type CaseUpdateConflictType = SharedCaseUpdateConflictType;
export type CaseParticipantDTO = SharedCaseParticipant;
export type CaseCollectionDTO = SharedCaseCollectionRecord;
export type CaseTimelineDTO = SharedCaseTimelineRecord;
export type CaseTimeNodeDTO = SharedCaseTimeNodeRecord;
export type CaseHearingDTO = SharedCaseHearingRecord;
export type CaseChangeDetail = SharedCaseChangeDetail;
export type CaseChangeLogDTO = SharedCaseChangeLog;
export type CaseDTO = SharedCaseRecord;
export type PaginationMeta = SharedPaginationMeta;
export type ListCasesOptions = SharedListCasesOptions;
export type CaseTableColumnKey = SharedCaseTableColumnKey;
export type CaseTablePreferenceDTO = SharedCaseTablePreference;
export type AssignableStaffMemberDTO = SharedAssignableStaffMember;
export type AssignableStaffDTO = SharedAssignableStaffResponse;

export type CreateCaseCollectionInput = Pick<CaseCollectionInput, 'amount' | 'receivedAt'>;

export interface CaseHearingUpsertInput extends Omit<CaseHearingInput, 'trialStage'> {
  trialStage: TrialStage;
}


export interface CaseClientDTO {
  id: string;
  name: string;
  entityType: ParticipantEntity | null;
  phone: string | null;
  idNumber: string | null;
  caseId: string;
  caseType: CaseType;
  caseLevel: CaseLevel;
  caseStatus: CaseStatus | null;
  department: SharedUserDepartment | null;
  assignedSaleName: string | null;
  assignedLawyerName: string | null;
  assignedAssistantName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CaseClientDetailDTO extends CaseClientDTO {
  address: string | null;
  isDishonest: boolean;
}

export interface CaseClientListOptions {
  page?: number;
  pageSize?: number;
  department?: SharedUserDepartment | null;
  search?: string;
}

export interface UpdateCaseClientInput {
  name?: string;
  entityType?: ParticipantEntity | null;
  phone?: string | null;
  idNumber?: string | null;
  address?: string | null;
  isDishonest?: boolean | null;
}

type UserRecord = typeof users.$inferSelect;
type CaseRow = typeof cases.$inferSelect;
type CaseParticipantRow = typeof caseParticipants.$inferSelect;
type CaseCollectionRow = typeof caseCollections.$inferSelect;
type CaseTimelineRow = typeof caseTimeline.$inferSelect;
type CaseTimeNodeRow = typeof caseTimeNodes.$inferSelect;
type CaseHearingRow = typeof caseHearings.$inferSelect;

type ParticipantRole = CaseParticipantRow['role'];

type CaseTimelineRowWithFollower = CaseTimelineRow & {
  follower?: Pick<UserRecord, 'id' | 'name' | 'role'> | null;
};

type CaseHearingRowWithRelations = CaseHearingRow & {
  trialLawyer?: Pick<UserRecord, 'id' | 'name' | 'role'> | null;
};

export interface CaseInput {
  caseType: CaseType;
  caseLevel: CaseLevel;
  caseCategory?: CaseCategory;
  provinceCity?: string | null;
  targetAmount?: string | number | null;
  feeStandard?: string | null;
  agencyFeeEstimate?: string | number | null;
  dataSource?: string | null;
  hasContract?: boolean | null;
  contractDate?: string | Date | null;
  clueDate?: string | Date | null;
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
  contractQuoteType?: ContractQuoteType | null;
  contractQuoteAmount?: string | number | null;
  contractQuoteUpfront?: string | number | null;
  contractQuoteRatio?: string | number | null;
  contractQuoteOther?: string | null;
  estimatedCollection?: string | number | null;
  litigationFeeType?: LitigationFeeType | null;
  travelFeeType?: TravelFeeType | null;
  contractForm?: ContractFormType | null;
  insuranceRiskLevel?: CaseLevel | null;
  insuranceTypes?: string[] | null;
  insuranceMisrepresentations?: string[] | null;
  department?: (typeof cases.$inferInsert)['department'];
  assignedSaleId?: string | null;
  assignedLawyerId?: string | null;
  assignedAssistantId?: string | null;
  caseStatus?: CaseStatus | null;
  closedReason?: string | null;
  voidReason?: string | null;
  salesCommission?: string | number | null;
  handlingFee?: string | number | null;
  participants?: CaseParticipantsInput;
  collections?: CaseCollectionInput[];
  timeline?: CaseTimelineInput[];
  hearings?: CaseHearingInput[] | null;
}

export type CaseUpdateInput = CaseInput | {
  payload: CaseInput;
  meta?: CaseUpdateMeta | null;
};

interface NormalizedCaseUpdateMeta {
  baseVersion: number | null;
  baseSnapshot: Record<string, unknown>;
  dirtyFields: string[];
  resolveMode: 'merge' | null;
}

interface NormalizedCaseUpdateInput {
  payload: CaseInput;
  meta: NormalizedCaseUpdateMeta;
}

export async function updateCase(id: string, input: CaseUpdateInput, user: SessionUser) {
  ensureCasePermission(user, 'update');

  const normalizedInput = normalizeCaseUpdateInput(input);
  const { payload, meta } = normalizedInput;

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

  const analysis = evaluateCaseUpdateConflict(existing, normalizedInput);

  if (meta.resolveMode === 'merge') {
    if (analysis.status === 'hard') {
      const message = '案件已被其他人更新，请刷新后重试';
      const details = await buildConflictDetailsForCase(id, user, existing, analysis, meta, 'hard', message);
      throw new CaseUpdateConflictError(message, details);
    }
  } else if (analysis.status !== 'ok') {
    const message =
      analysis.status === 'hard'
        ? '案件已被其他人更新，请刷新后重试'
        : '检测到其他人更新了案件，可选择合并或取消';
    const details = await buildConflictDetailsForCase(
      id,
      user,
      existing,
      analysis,
      meta,
      analysis.status === 'hard' ? 'hard' : 'mergeable',
      message
    );
    throw new CaseUpdateConflictError(message, details);
  }

  return db.transaction(async (tx) => {
    const current = await tx.query.cases.findFirst({
      where: eq(cases.id, id)
    });

    if (!current) {
      return null;
    }

    if (!canAccessCase(accessContext, current)) {
      throw new AuthorizationError();
    }

    const caseValues = buildCaseValues(payload);
    caseValues.updaterId = user.id;
    caseValues.updatedAt = new Date();
    caseValues.version = (current.version ?? 0) + 1;

    if (user.role === 'lawyer' || user.role === 'assistant') {
      BASIC_INFO_FIELD_KEYS.forEach((field) => {
        if (field in caseValues) {
          (caseValues as Record<string, unknown>)[field] = current[field as keyof typeof current];
        }
      });
    }

    if (payload.department === undefined) {
      if (current.department) {
        caseValues.department = current.department;
      } else if ((user.role === 'admin' || user.role === 'administration' || isSuperAdmin(user)) && user.department) {
        caseValues.department = user.department as (typeof cases.$inferInsert)['department'];
      }
    }

    if (payload.assignedSaleId === undefined) {
      if (current.assignedSaleId) {
        caseValues.assignedSaleId = current.assignedSaleId;
      } else if (user.role === 'admin' || user.role === 'administration' || isSuperAdmin(user)) {
        caseValues.assignedSaleId = user.id;
      }
    }

    const [updatedCase] = await tx
      .update(cases)
      .set(caseValues)
      .where(and(eq(cases.id, id), eq(cases.version, current.version ?? 0)))
      .returning();

    if (!updatedCase) {
      const latest = await tx.query.cases.findFirst({
        where: eq(cases.id, id)
      });

      const snapshot = latest ?? current;
      const latestAnalysis = evaluateCaseUpdateConflict(snapshot, normalizedInput);
      const resolvedStatus = latestAnalysis.status === 'ok' ? 'hard' : latestAnalysis.status;
      const message =
        resolvedStatus === 'mergeable'
          ? '检测到其他人更新了案件，可选择合并或取消'
          : '案件已被其他人更新，请刷新后重试';
      const details = await buildConflictDetailsForCase(
        id,
        user,
        snapshot,
        latestAnalysis,
        meta,
        resolvedStatus === 'mergeable' ? 'mergeable' : 'hard',
        message
      );
      throw new CaseUpdateConflictError(message, details);
    }

    const changeDetails = buildChangeDetails(current, updatedCase);
    const shouldLog =
      changeDetails.length > 0 ||
      Boolean(payload.timeline || payload.hearings !== undefined || payload.participants || payload.collections);

    if (shouldLog) {
      const actor = extractActorContext(user);
      await tx.insert(caseChangeLogs).values({
        caseId: id,
        action: 'update',
        description: buildChangeDescription(changeDetails, payload),
        changes: changeDetails.length > 0 ? changeDetails : null,
        actorId: actor.actorId,
        actorName: actor.actorName,
        actorRole: actor.actorRole
      });
    }

    if (payload.participants) {
      await tx.delete(caseParticipants).where(eq(caseParticipants.caseId, id));
      const participantValues = flattenParticipantsInput(payload.participants, id);
      if (participantValues.length > 0) {
        await tx.insert(caseParticipants).values(participantValues);
      }
    }

    if (payload.collections) {
      await tx.delete(caseCollections).where(eq(caseCollections.caseId, id));
      const collectionValues = normalizeCollectionsInput(payload.collections, id);
      if (collectionValues.length > 0) {
        await tx.insert(caseCollections).values(collectionValues);
      }
    }

    if (payload.timeline) {
      await tx.delete(caseTimeline).where(eq(caseTimeline.caseId, id));
      const timelineValues = normalizeTimelineInput(payload.timeline, id);
      if (timelineValues.length > 0) {
        await tx.insert(caseTimeline).values(timelineValues);
      }
    }

    if (payload.hearings !== undefined) {
      if (user.role === 'administration') {
        throw new AuthorizationError('行政角色无权编辑庭审信息');
      }
      await tx.delete(caseHearings).where(eq(caseHearings.caseId, id));
      const processedHearings = await applyDefaultTrialLawyerList(payload.hearings, user);
      const hearingValues = normalizeHearingInputs(processedHearings, id);
      if (hearingValues.length > 0) {
        await tx.insert(caseHearings).values(hearingValues);
      }
    }

    await syncCaseHearingEvents(tx, id);

    const fullRecord = await tx.query.cases.findFirst({
      where: eq(cases.id, id),
      with: {
        assignedSale: {
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
        updater: {
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
        hearings: {
          with: {
            trialLawyer: {
              columns: {
                id: true,
                name: true,
                role: true
              }
            }
          }
        }
      }
    });

    if (!fullRecord) {
      return null;
    }

    return mapCaseRecord(fullRecord as CaseWithRelations);
  });
}

type CaseWithRelations = CaseRow & {
  participants?: CaseParticipantRow[];
  collections?: CaseCollectionRow[];
  timeNodes?: CaseTimeNodeRow[];
  timeline?: CaseTimelineRowWithFollower[];
  hearings?: CaseHearingRowWithRelations[];
  assignedSale?: Pick<UserRecord, 'id' | 'name' | 'role'> | null;
  assignedLawyer?: Pick<UserRecord, 'id' | 'name' | 'role'> | null;
  assignedAssistant?: Pick<UserRecord, 'id' | 'name' | 'role'> | null;
  updater?: Pick<UserRecord, 'id' | 'name' | 'role'> | null;
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
  CaseDTO,
  'id' | 'department' | 'assignedSaleId' | 'assignedLawyerId' | 'assignedAssistantId'
> & {
  hearings?: Array<Pick<CaseHearingDTO, 'trialLawyerId'>>;
};

interface CaseAccessContext {
  allowAll: boolean;
  departments: Set<(typeof departmentEnum.enumValues)[number]>;
  assignedSaleIds: Set<string>;
  assignedLawyerIds: Set<string>;
  assignedAssistantIds: Set<string>;
  hearingTrialLawyerIds: Set<string>;
  hearingCaseIds: Set<string>;
}

async function buildCaseAccessContext(user: SessionUser): Promise<CaseAccessContext> {
  if (isSuperAdmin(user)) {
    return {
      allowAll: true,
      departments: new Set(),
      assignedSaleIds: new Set(),
      assignedLawyerIds: new Set(),
      assignedAssistantIds: new Set(),
      hearingTrialLawyerIds: new Set(),
      hearingCaseIds: new Set()
    } satisfies CaseAccessContext;
  }

  const context: CaseAccessContext = {
    allowAll: false,
    departments: new Set(),
    assignedSaleIds: new Set([user.id]),
    assignedLawyerIds: new Set([user.id]),
    assignedAssistantIds: new Set([user.id]),
    hearingTrialLawyerIds: new Set([user.id]),
    hearingCaseIds: new Set()
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
        context.assignedSaleIds.add(assistant.id);
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
      context.hearingTrialLawyerIds.add(supervisor.id);
      context.assignedSaleIds.add(supervisor.id);
    }
  }

  if (context.hearingTrialLawyerIds.size > 0) {
    const lawyerIds = Array.from(context.hearingTrialLawyerIds).filter((value) => value && value.trim().length > 0);
    if (lawyerIds.length > 0) {
      const hearingRecords = await db
        .select({ caseId: caseHearings.caseId })
        .from(caseHearings)
        .where(inArray(caseHearings.trialLawyerId, lawyerIds));

      hearingRecords.forEach((record) => {
        const caseId = record.caseId;
        if (caseId && caseId.trim().length > 0) {
          context.hearingCaseIds.add(caseId);
        }
      });
    }
  }

  return context;
}

function buildColumnCondition(
  column:
    | typeof cases.id
    | typeof cases.assignedSaleId
    | typeof cases.assignedLawyerId
    | typeof cases.assignedAssistantId,
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

  const assignedSaleCondition = buildColumnCondition(cases.assignedSaleId, context.assignedSaleIds);
  if (assignedSaleCondition) {
    orConditions.push(assignedSaleCondition);
  }

  const assignedLawyerCondition = buildColumnCondition(cases.assignedLawyerId, context.assignedLawyerIds);
  if (assignedLawyerCondition) {
    orConditions.push(assignedLawyerCondition);
  }

  const assistantCondition = buildColumnCondition(cases.assignedAssistantId, context.assignedAssistantIds);
  if (assistantCondition) {
    orConditions.push(assistantCondition);
  }

  const hearingCaseCondition = buildColumnCondition(cases.id, context.hearingCaseIds);
  if (hearingCaseCondition) {
    orConditions.push(hearingCaseCondition);
  }

  return combineOr(orConditions);
}

function canAccessCase(context: CaseAccessContext, record: CaseAccessProjection): boolean {
  if (context.allowAll) {
    return true;
  }

  if (context.hearingCaseIds.has(record.id)) {
    return true;
  }

  if (record.department && context.departments.has(record.department)) {
    return true;
  }

  if (record.assignedSaleId && context.assignedSaleIds.has(record.assignedSaleId)) {
    return true;
  }

  if (record.assignedLawyerId && context.assignedLawyerIds.has(record.assignedLawyerId)) {
    return true;
  }

  if (record.assignedAssistantId && context.assignedAssistantIds.has(record.assignedAssistantId)) {
    return true;
  }

  if (
    record.hearings?.some(
      (hearing) => hearing.trialLawyerId && context.hearingTrialLawyerIds.has(hearing.trialLawyerId)
    )
  ) {
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

async function fetchSupervisorIdForUser(userId: string): Promise<string | null> {
  if (!userId) {
    return null;
  }

  const record = await db.query.users.findFirst({
    columns: {
      supervisorId: true
    },
    where: eq(users.id, userId)
  });

  const supervisorId = record?.supervisorId ?? null;
  return supervisorId && supervisorId.trim().length > 0 ? supervisorId : null;
}

async function resolveDefaultTrialLawyerId(user: SessionUser): Promise<string | null> {
  if (user.role === 'lawyer') {
    return user.id;
  }

  if (user.role === 'assistant') {
    const supervisorId = user.supervisorId ?? (await fetchSupervisorIdForUser(user.id));
    if (!supervisorId) {
      return null;
    }

    const supervisor = await db.query.users.findFirst({
      columns: {
        id: true,
        role: true
      },
      where: eq(users.id, supervisorId)
    });

    if (!supervisor || supervisor.role !== 'lawyer') {
      return null;
    }

    return supervisor.id;
  }

  return null;
}

async function applyDefaultTrialLawyer(
  hearing: CaseHearingInput | null | undefined,
  user: SessionUser
): Promise<CaseHearingInput | null | undefined> {
  if (!hearing) {
    return hearing ?? null;
  }

  if (hearing.trialLawyerId !== undefined) {
    return hearing;
  }

  const defaultId = await resolveDefaultTrialLawyerId(user);
  if (!defaultId) {
    return hearing;
  }

  return {
    ...hearing,
    trialLawyerId: defaultId
  } satisfies CaseHearingInput;
}

async function applyDefaultTrialLawyerList(
  hearings: CaseHearingInput[] | null | undefined,
  user: SessionUser
): Promise<CaseHearingInput[] | null | undefined> {
  if (hearings === undefined) {
    return undefined;
  }

  if (hearings === null) {
    return null;
  }

  const results: CaseHearingInput[] = [];
  for (const hearing of hearings) {
    const processed = await applyDefaultTrialLawyer(hearing, user);
    if (processed) {
      results.push(processed);
    }
  }

  return results;
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

const TRIAL_STAGE_LABEL_MAP: Record<TrialStage, string> = {
  first_instance: '一审',
  second_instance: '二审',
  retrial: '再审'
};

const CASE_TIME_NODE_DEFINITIONS: ReadonlyArray<{ type: CaseTimeNodeType; label: string }> = [
  { type: 'apply_employment_confirmation', label: '申请确认劳动关系' },
  { type: 'labor_arbitration_decision', label: '确认劳动裁决时间' },
  { type: 'submit_injury_certification', label: '提交工伤认定申请' },
  { type: 'receive_injury_certification', label: '收到工伤认定书' },
  { type: 'submit_disability_assessment', label: '提交劳动能力等级鉴定' },
  { type: 'receive_disability_assessment', label: '收到鉴定书' },
  { type: 'apply_insurance_arbitration', label: '申请工伤保险待遇仲裁' },
  { type: 'insurance_arbitration_decision', label: '工伤保险待遇裁决时间' },
  { type: 'file_lawsuit', label: '起诉立案' },
  { type: 'lawsuit_review_approved', label: '立案审核通过' },
  { type: 'final_judgement', label: '裁决时间' }
];

const CASE_TIME_NODE_SEQUENCE: CaseTimeNodeType[] = CASE_TIME_NODE_DEFINITIONS.map(
  definition => definition.type
);

const CASE_TIME_NODE_LABEL_MAP = CASE_TIME_NODE_DEFINITIONS.reduce<Record<CaseTimeNodeType, string>>(
  (acc, definition) => {
    acc[definition.type] = definition.label;
    return acc;
  },
  {} as Record<CaseTimeNodeType, string>
);

const CASE_TIME_NODE_EDIT_ALLOWED_ROLES = new Set<SessionUser['role']>([
  'super_admin',
  'admin',
  'lawyer',
  'assistant'
]);

function normalizeTrialStageInput(value: TrialStage | string | null | undefined): TrialStage | null {
  if (!value) {
    return null;
  }

  const direct = (typeof value === 'string' ? value : String(value)).trim();
  if (!direct) {
    return null;
  }

  return (trialStageEnum.enumValues as readonly TrialStage[]).includes(direct as TrialStage)
    ? (direct as TrialStage)
    : null;
}

function normalizeTimeNodeTypeInput(
  value: CaseTimeNodeType | string | null | undefined
): CaseTimeNodeType | null {
  if (!value) {
    return null;
  }

  const direct = (typeof value === 'string' ? value : String(value)).trim();
  if (!direct) {
    return null;
  }

  return (caseTimeNodeTypeEnum.enumValues as readonly CaseTimeNodeType[]).includes(
    direct as CaseTimeNodeType
  )
    ? (direct as CaseTimeNodeType)
    : null;
}

const CASE_STATUS_LABEL_MAP: Record<CaseStatus, string> = {
  open: '跟进中',
  closed: '已结案',
  void: '废单'
};

function normalizeCaseStatusInput(value: CaseStatus | string | null | undefined): CaseStatus | null {
  if (!value) {
    return null;
  }

  const direct = (typeof value === 'string' ? value : String(value)).trim();
  if (!direct) {
    return null;
  }

  return (caseStatusEnum.enumValues as readonly CaseStatus[]).includes(direct as CaseStatus)
    ? (direct as CaseStatus)
    : null;
}

function normalizeCaseCategoryInput(
  value: CaseCategory | string | null | undefined
): CaseCategory | null {
  if (!value) {
    return null;
  }
  const direct = (typeof value === 'string' ? value : String(value)).trim();
  if (!direct) {
    return null;
  }
  return (caseCategoryEnum.enumValues as readonly CaseCategory[]).includes(direct as CaseCategory)
    ? (direct as CaseCategory)
    : null;
}

function normalizeContractQuoteTypeInput(
  value: ContractQuoteType | string | null | undefined
): ContractQuoteType | null {
  if (!value) {
    return null;
  }
  const direct = (typeof value === 'string' ? value : String(value)).trim();
  if (!direct) {
    return null;
  }
  return (contractQuoteTypeEnum.enumValues as readonly ContractQuoteType[]).includes(
    direct as ContractQuoteType
  )
    ? (direct as ContractQuoteType)
    : null;
}

function normalizeLitigationFeeTypeInput(
  value: LitigationFeeType | string | null | undefined
): LitigationFeeType | null {
  if (!value) {
    return null;
  }
  const direct = (typeof value === 'string' ? value : String(value)).trim();
  if (!direct) {
    return null;
  }
  return (litigationFeeTypeEnum.enumValues as readonly LitigationFeeType[]).includes(
    direct as LitigationFeeType
  )
    ? (direct as LitigationFeeType)
    : null;
}

function normalizeTravelFeeTypeInput(
  value: TravelFeeType | string | null | undefined
): TravelFeeType | null {
  if (!value) {
    return null;
  }
  const direct = (typeof value === 'string' ? value : String(value)).trim();
  if (!direct) {
    return null;
  }
  return (travelFeeTypeEnum.enumValues as readonly TravelFeeType[]).includes(direct as TravelFeeType)
    ? (direct as TravelFeeType)
    : null;
}

function normalizeContractFormInput(
  value: ContractFormType | string | null | undefined
): ContractFormType | null {
  if (!value) {
    return null;
  }
  const direct = (typeof value === 'string' ? value : String(value)).trim();
  if (!direct) {
    return null;
  }
  return (contractFormEnum.enumValues as readonly ContractFormType[]).includes(direct as ContractFormType)
    ? (direct as ContractFormType)
    : null;
}

function normalizeStringArrayInput(value: unknown): string[] | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!Array.isArray(value)) {
    return null;
  }
  const cleaned = value
    .map((item) => (typeof item === 'string' ? item.trim() : String(item ?? '')))
    .filter((item) => item.length > 0);
  return cleaned;
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
  if (Array.isArray(value)) {
    const formatted = value
      .map((item) => (typeof item === 'string' ? item.trim() : String(item ?? '')))
      .filter((item) => item.length > 0);
    if (formatted.length === 0) {
      return null;
    }
    return formatted.join('、');
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value.toString() : null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }

    if ((trialStageEnum.enumValues as readonly TrialStage[]).includes(trimmed as TrialStage)) {
      const stage = trimmed as TrialStage;
      return TRIAL_STAGE_LABEL_MAP[stage] ?? stage;
    }

    if ((caseStatusEnum.enumValues as readonly CaseStatus[]).includes(trimmed as CaseStatus)) {
      const status = trimmed as CaseStatus;
      return CASE_STATUS_LABEL_MAP[status] ?? status;
    }

    return trimmed;
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
  | 'contractDate'
  | 'clueDate'
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
  | 'contractQuoteType'
  | 'contractQuoteAmount'
  | 'contractQuoteUpfront'
  | 'contractQuoteRatio'
  | 'contractQuoteOther'
  | 'estimatedCollection'
  | 'litigationFeeType'
  | 'travelFeeType'
  | 'contractForm'
  | 'insuranceRiskLevel'
  | 'insuranceTypes'
  | 'insuranceMisrepresentations'
  | 'caseCategory'
  | 'department'
  | 'assignedSaleId'
  | 'assignedLawyerId'
  | 'assignedAssistantId'
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
  contractDate: '合同日期',
  clueDate: '线索日期',
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
  contractQuoteType: '合同报价方式',
  contractQuoteAmount: '合同固定报价',
  contractQuoteUpfront: '风险前期收费',
  contractQuoteRatio: '风险回款比例',
  contractQuoteOther: '其他报价说明',
  estimatedCollection: '预计回款',
  litigationFeeType: '诉讼费承担',
  travelFeeType: '差旅费承担',
  contractForm: '合同形式',
  insuranceRiskLevel: '风险等级',
  insuranceTypes: '保险类型',
  insuranceMisrepresentations: '未如实告知',
  caseCategory: '案件类别',
  department: '所属部门',
  assignedSaleId: '跟进人',
  assignedLawyerId: '签约律师',
  assignedAssistantId: '律师助理',
  caseStatus: '案件状态',
  closedReason: '结案原因',
  voidReason: '废单原因',
  salesCommission: '销售提成',
  handlingFee: '办案费用'
};

type ChangeFieldKey = keyof typeof CHANGE_FIELD_LABEL_MAP;

const MERGE_SAFE_FIELDS: ReadonlySet<ChangeFieldKey> = new Set(
  Object.keys(CHANGE_FIELD_LABEL_MAP) as ChangeFieldKey[]
);

const COMPLEX_UPDATE_FIELDS: ReadonlySet<string> = new Set([
  'participants',
  'collections',
  'timeline',
  'hearings',
  'timeNodes'
]);

function normalizeCaseUpdateMeta(meta?: CaseUpdateMeta | null): NormalizedCaseUpdateMeta {
  const baseVersionValue = typeof meta?.baseVersion === 'number' ? meta?.baseVersion : null;
  const baseSnapshotValue = meta?.baseSnapshot && typeof meta.baseSnapshot === 'object' ? meta.baseSnapshot : {};
  const dirtyFieldList = Array.isArray(meta?.dirtyFields)
    ? (meta!.dirtyFields as unknown[]).filter((item): item is string => typeof item === 'string')
    : Object.keys(baseSnapshotValue);

  const uniqueDirtyFields = Array.from(new Set(dirtyFieldList));

  return {
    baseVersion: baseVersionValue,
    baseSnapshot: baseSnapshotValue,
    dirtyFields: uniqueDirtyFields,
    resolveMode: meta?.resolveMode === 'merge' ? 'merge' : null
  } satisfies NormalizedCaseUpdateMeta;
}

function normalizeCaseUpdateInput(raw: CaseUpdateInput): NormalizedCaseUpdateInput {
  if (raw && typeof raw === 'object' && 'payload' in raw && raw.payload) {
    return {
      payload: raw.payload,
      meta: normalizeCaseUpdateMeta(raw.meta)
    } satisfies NormalizedCaseUpdateInput;
  }

  return {
    payload: raw as CaseInput,
    meta: normalizeCaseUpdateMeta()
  } satisfies NormalizedCaseUpdateInput;
}

function normalizeComparableValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

interface CaseUpdateConflictAnalysisResult {
  status: 'ok' | CaseUpdateConflictType;
  remoteChanges: CaseUpdateConflictField[];
  clientChanges: CaseUpdateConflictField[];
  conflictingFields: ChangeFieldKey[];
}

function evaluateCaseUpdateConflict(
  existing: typeof cases.$inferSelect,
  normalized: NormalizedCaseUpdateInput
): CaseUpdateConflictAnalysisResult {
  const { meta, payload } = normalized;

  if (meta.baseVersion === null || meta.baseVersion === existing.version) {
    return {
      status: 'ok',
      remoteChanges: [],
      clientChanges: [],
      conflictingFields: []
    } satisfies CaseUpdateConflictAnalysisResult;
  }

  const payloadKeys = Object.keys(payload);
  const hasComplexField = payloadKeys.some((key) => COMPLEX_UPDATE_FIELDS.has(key));
  if (hasComplexField) {
    return {
      status: 'hard',
      remoteChanges: [],
      clientChanges: [],
      conflictingFields: []
    } satisfies CaseUpdateConflictAnalysisResult;
  }

  const fieldsToInspect = new Set<ChangeFieldKey>();
  meta.dirtyFields.forEach((fieldName) => {
    if (MERGE_SAFE_FIELDS.has(fieldName as ChangeFieldKey)) {
      fieldsToInspect.add(fieldName as ChangeFieldKey);
    }
  });
  Object.keys(meta.baseSnapshot).forEach((fieldName) => {
    if (MERGE_SAFE_FIELDS.has(fieldName as ChangeFieldKey)) {
      fieldsToInspect.add(fieldName as ChangeFieldKey);
    }
  });

  const remoteChanges: CaseUpdateConflictField[] = [];
  const clientChanges: CaseUpdateConflictField[] = [];
  const conflictingFieldSet = new Set<ChangeFieldKey>();
  const payloadRecord = payload as unknown as Partial<Record<ChangeFieldKey, unknown>>;

  fieldsToInspect.forEach((field) => {
    const hasBase = Object.prototype.hasOwnProperty.call(meta.baseSnapshot, field);
    const baseValue = hasBase ? meta.baseSnapshot[field] : (existing as Record<string, unknown>)[field];
    const currentValue = (existing as Record<string, unknown>)[field];
    const clientHasValue = Object.prototype.hasOwnProperty.call(payload, field);
    const clientValue = clientHasValue ? payloadRecord[field] : undefined;

    const baseComparable = normalizeComparableValue(baseValue);
    const currentComparable = normalizeComparableValue(currentValue);
    const clientComparable = clientHasValue ? normalizeComparableValue(clientValue) : baseComparable;

    const remoteChanged = hasBase ? baseComparable !== currentComparable : false;
    const clientChanged = clientHasValue ? baseComparable !== clientComparable : false;

    if (remoteChanged) {
      remoteChanges.push({
        field,
        label: CHANGE_FIELD_LABEL_MAP[field],
        baseValue: formatValueForLog(baseValue),
        remoteValue: formatValueForLog(currentValue)
      });
    }

    if (clientChanged) {
      clientChanges.push({
        field,
        label: CHANGE_FIELD_LABEL_MAP[field],
        baseValue: formatValueForLog(baseValue),
        clientValue: formatValueForLog(clientValue)
      });
    }

    if (remoteChanged && clientChanged) {
      conflictingFieldSet.add(field);
    }

    if (!hasBase && clientChanged) {
      conflictingFieldSet.add(field);
    }
  });

  if (conflictingFieldSet.size > 0) {
    return {
      status: 'hard',
      remoteChanges,
      clientChanges,
      conflictingFields: Array.from(conflictingFieldSet)
    } satisfies CaseUpdateConflictAnalysisResult;
  }

  if (remoteChanges.length === 0) {
    return {
      status: 'ok',
      remoteChanges: [],
      clientChanges,
      conflictingFields: []
    } satisfies CaseUpdateConflictAnalysisResult;
  }

  return {
    status: 'mergeable',
    remoteChanges,
    clientChanges,
    conflictingFields: []
  } satisfies CaseUpdateConflictAnalysisResult;
}

async function buildConflictDetailsForCase(
  caseId: string,
  user: SessionUser,
  existing: typeof cases.$inferSelect,
  analysis: CaseUpdateConflictAnalysisResult,
  meta: NormalizedCaseUpdateMeta,
  type: CaseUpdateConflictType,
  message: string
): Promise<CaseUpdateConflictDetails> {
  const latestDto = await getCaseById(caseId, user);
  const latestVersion = latestDto?.version ?? existing.version ?? 0;
  const updatedAtText = latestDto?.updatedAt ?? formatTimestamp(existing.updatedAt) ?? new Date().toISOString();

  return {
    type,
    message,
    caseId,
    baseVersion: meta.baseVersion ?? null,
    latestVersion,
    remoteChanges: analysis.remoteChanges,
    clientChanges: analysis.clientChanges,
    conflictingFields: analysis.conflictingFields,
    updatedAt: updatedAtText,
    updatedById: latestDto?.updaterId ?? existing.updaterId ?? null,
    updatedByName: latestDto?.updaterName ?? null,
    updatedByRole: latestDto?.updaterRole ?? null
  } satisfies CaseUpdateConflictDetails;
}

export class CaseUpdateConflictError extends Error {
  status = 409;
  details: CaseUpdateConflictDetails;

  constructor(message: string, details: CaseUpdateConflictDetails) {
    super(message);
    this.name = 'CaseUpdateConflictError';
    this.details = details;
  }
}

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
  if (input?.hearings !== undefined) {
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

  if (input.caseCategory !== undefined) {
    const normalizedCategory = normalizeCaseCategoryInput(input.caseCategory) ?? 'work_injury';
    values.caseCategory = normalizedCategory;
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
  if (input.contractDate !== undefined) {
    values.contractDate = normalizeDateInput(input.contractDate);
  }
  if (input.clueDate !== undefined) {
    values.clueDate = normalizeDateInput(input.clueDate);
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
  if (input.contractQuoteType !== undefined) {
    values.contractQuoteType = normalizeContractQuoteTypeInput(input.contractQuoteType);
  }
  if (input.contractQuoteAmount !== undefined) {
    values.contractQuoteAmount = normalizeNumericInput(input.contractQuoteAmount);
  }
  if (input.contractQuoteUpfront !== undefined) {
    values.contractQuoteUpfront = normalizeNumericInput(input.contractQuoteUpfront);
  }
  if (input.contractQuoteRatio !== undefined) {
    values.contractQuoteRatio = normalizeNumericInput(input.contractQuoteRatio);
  }
  if (input.contractQuoteOther !== undefined) {
    values.contractQuoteOther = normalizeTextInput(input.contractQuoteOther);
  }
  if (input.estimatedCollection !== undefined) {
    values.estimatedCollection = normalizeNumericInput(input.estimatedCollection);
  }
  if (input.litigationFeeType !== undefined) {
    values.litigationFeeType = normalizeLitigationFeeTypeInput(input.litigationFeeType);
  }
  if (input.travelFeeType !== undefined) {
    values.travelFeeType = normalizeTravelFeeTypeInput(input.travelFeeType);
  }
  if (input.contractForm !== undefined) {
    values.contractForm = normalizeContractFormInput(input.contractForm);
  }
  if (input.insuranceRiskLevel !== undefined) {
    values.insuranceRiskLevel = input.insuranceRiskLevel ?? null;
  }
  if (input.insuranceTypes !== undefined) {
    values.insuranceTypes = normalizeStringArrayInput(input.insuranceTypes) ?? [];
  }
  if (input.insuranceMisrepresentations !== undefined) {
    values.insuranceMisrepresentations = normalizeStringArrayInput(
      input.insuranceMisrepresentations
    ) ?? [];
  }
  if (input.department !== undefined) {
    values.department = input.department ?? null;
  }
  if (input.assignedSaleId !== undefined) {
    values.assignedSaleId = input.assignedSaleId ?? null;
  }
  if (input.assignedLawyerId !== undefined) {
    values.assignedLawyerId = input.assignedLawyerId ?? null;
  }
  if (input.assignedAssistantId !== undefined) {
    values.assignedAssistantId = input.assignedAssistantId ?? null;
  }
  if (input.caseStatus !== undefined) {
    values.caseStatus = normalizeCaseStatusInput(input.caseStatus) ?? 'open';
  }
  if (input.closedReason !== undefined) {
    values.closedReason = input.closedReason ?? null;
  }
  if (input.voidReason !== undefined) {
    values.voidReason = input.voidReason ?? null;
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

function mapParticipant(record: CaseParticipantRow): CaseParticipantDTO {
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

function mapCollection(record: CaseCollectionRow): CaseCollectionDTO {
  return {
    id: record.id,
    amount: formatNumeric(record.amount) ?? '0',
    receivedAt: formatDateOnly(record.receivedAt) ?? formatDateOnly(new Date())!,
    createdAt: formatTimestamp(record.createdAt) ?? new Date().toISOString(),
    updatedAt: formatTimestamp(record.updatedAt) ?? new Date().toISOString()
  };
}

function mapTimeline(record: CaseTimelineRowWithFollower): CaseTimelineDTO {
  return {
    id: record.id,
    occurredOn: formatDateOnly(record.occurredOn) ?? formatDateOnly(new Date())!,
    createdAt: formatTimestamp(record.createdAt) ?? new Date().toISOString(),
    updatedAt: formatTimestamp(record.updatedAt) ?? new Date().toISOString(),
    note: record.note ?? null,
    followerId: record.followerId ?? null,
    followerName: record.follower ? record.follower.name ?? null : null
  };
}

function mapTimeNode(record: CaseTimeNodeRow): CaseTimeNodeDTO {
  return {
    id: record.id,
    nodeType: record.nodeType as CaseTimeNodeType,
    occurredOn: formatDateOnly(record.occurredOn) ?? formatDateOnly(new Date())!,
    createdAt: formatTimestamp(record.createdAt) ?? new Date().toISOString(),
    updatedAt: formatTimestamp(record.updatedAt) ?? new Date().toISOString()
  } satisfies CaseTimeNodeDTO;
}

function mapHearing(record?: CaseHearingRowWithRelations | null): CaseHearingDTO | null {
  if (!record) {
    return null;
  }

  return {
    id: record.id,
    trialLawyerId: record.trialLawyerId ?? null,
    trialLawyerName: record.trialLawyer?.name ?? null,
    hearingTime: formatTimestamp(record.hearingTime),
    hearingLocation: record.hearingLocation ?? null,
    tribunal: record.tribunal ?? null,
    judge: record.judge ?? null,
    caseNumber: record.caseNumber ?? null,
    contactPhone: record.contactPhone ?? null,
    trialStage: record.trialStage ?? null,
    hearingResult: record.hearingResult ?? null,
    createdAt: formatTimestamp(record.createdAt) ?? new Date().toISOString(),
    updatedAt: formatTimestamp(record.updatedAt) ?? new Date().toISOString()
  } satisfies CaseHearingDTO;
}

type CaseClientQueryRecord = {
  id: string;
  name: string | null;
  entityType: ParticipantEntity | null;
  phone: string | null;
  idNumber: string | null;
  caseId: string;
  caseType: CaseType;
  caseLevel: CaseLevel;
  caseStatus: CaseStatus | null;
  department: (typeof cases.$inferSelect)['department'];
  assignedSaleName: string | null;
  assignedLawyerName: string | null;
  assignedAssistantName: string | null;
  createdAt: string | Date | null;
  updatedAt: string | Date | null;
};

type CaseClientDetailQueryRecord = CaseClientQueryRecord & {
  address: string | null;
  isDishonest: boolean | null;
};

function mapCaseClientRecord(record: CaseClientQueryRecord): CaseClientDTO {
  return {
    id: record.id,
    name: record.name?.trim() && record.name.trim().length > 0 ? record.name.trim() : '未填写姓名',
    entityType: record.entityType ?? null,
    phone: record.phone ?? null,
    idNumber: record.idNumber ?? null,
    caseId: record.caseId,
    caseType: record.caseType,
    caseLevel: record.caseLevel,
    caseStatus: record.caseStatus ?? null,
    department: record.department,
    assignedSaleName: record.assignedSaleName ?? null,
    assignedLawyerName: record.assignedLawyerName ?? null,
    assignedAssistantName: record.assignedAssistantName ?? null,
    createdAt: formatTimestamp(record.createdAt) ?? new Date().toISOString(),
    updatedAt: formatTimestamp(record.updatedAt) ?? new Date().toISOString()
  } satisfies CaseClientDTO;
}

function mapCaseClientDetailRecord(record: CaseClientDetailQueryRecord): CaseClientDetailDTO {
  const base = mapCaseClientRecord(record);
  return {
    ...base,
    address: record.address ?? null,
    isDishonest: Boolean(record.isDishonest)
  } satisfies CaseClientDetailDTO;
}

async function loadCaseClientDetail(id: string): Promise<CaseClientDetailQueryRecord | null> {
  const assignedSaleUser = alias(users, 'case_client_detail_assigned_sale');
  const assignedLawyerUser = alias(users, 'case_client_detail_assigned_lawyer');
  const assignedAssistantUser = alias(users, 'case_client_detail_assigned_assistant');

  const [record] = await db
    .select({
      id: caseParticipants.id,
      name: caseParticipants.name,
      entityType: caseParticipants.entityType,
      phone: caseParticipants.phone,
      idNumber: caseParticipants.idNumber,
      caseId: caseParticipants.caseId,
      caseType: cases.caseType,
      caseLevel: cases.caseLevel,
      caseStatus: cases.caseStatus,
      department: cases.department,
      assignedSaleName: assignedSaleUser.name,
      assignedLawyerName: assignedLawyerUser.name,
      assignedAssistantName: assignedAssistantUser.name,
      createdAt: cases.createdAt,
      updatedAt: cases.updatedAt,
      address: caseParticipants.address,
      isDishonest: caseParticipants.isDishonest
    })
    .from(caseParticipants)
    .innerJoin(cases, eq(caseParticipants.caseId, cases.id))
    .leftJoin(assignedSaleUser, eq(cases.assignedSaleId, assignedSaleUser.id))
    .leftJoin(assignedLawyerUser, eq(cases.assignedLawyerId, assignedLawyerUser.id))
    .leftJoin(assignedAssistantUser, eq(cases.assignedAssistantId, assignedAssistantUser.id))
    .where(and(eq(caseParticipants.id, id), eq(caseParticipants.role, 'claimant')))
    .limit(1);

  return (record as CaseClientDetailQueryRecord | undefined) ?? null;
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

  const timeNodes = [...(record.timeNodes ?? [])]
    .sort((a, b) =>
      CASE_TIME_NODE_SEQUENCE.indexOf(a.nodeType as CaseTimeNodeType) -
      CASE_TIME_NODE_SEQUENCE.indexOf(b.nodeType as CaseTimeNodeType)
    )
    .map(mapTimeNode);

  const hearings = [...(record.hearings ?? [])]
    .sort((a, b) => {
      const aTime = a.hearingTime ? new Date(a.hearingTime).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.hearingTime ? new Date(b.hearingTime).getTime() : Number.MAX_SAFE_INTEGER;
      if (aTime === bTime) {
        const stageOrder = (stage?: TrialStage | null) =>
          stage ? trialStageEnum.enumValues.indexOf(stage) : Number.MAX_SAFE_INTEGER;
        return stageOrder(a.trialStage) - stageOrder(b.trialStage);
      }
      return aTime - bTime;
    })
    .map(mapHearing)
    .filter((item): item is CaseHearingDTO => item !== null);

  return {
    id: record.id,
    caseType: record.caseType,
    caseLevel: record.caseLevel,
    caseCategory: record.caseCategory as CaseCategory,
    provinceCity: record.provinceCity ?? null,
    targetAmount: formatNumeric(record.targetAmount),
    feeStandard: record.feeStandard ?? null,
    agencyFeeEstimate: formatNumeric(record.agencyFeeEstimate),
    dataSource: record.dataSource ?? null,
    hasContract: record.hasContract ?? null,
    contractDate: formatDateOnly(record.contractDate),
    clueDate: formatDateOnly(record.clueDate),
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
    contractQuoteType: (record.contractQuoteType ?? null) as ContractQuoteType | null,
    contractQuoteAmount: formatNumeric(record.contractQuoteAmount),
    contractQuoteUpfront: formatNumeric(record.contractQuoteUpfront),
    contractQuoteRatio: formatNumeric(record.contractQuoteRatio),
    contractQuoteOther: record.contractQuoteOther ?? null,
    estimatedCollection: formatNumeric(record.estimatedCollection),
    litigationFeeType: (record.litigationFeeType ?? null) as LitigationFeeType | null,
    travelFeeType: (record.travelFeeType ?? null) as TravelFeeType | null,
    contractForm: (record.contractForm ?? null) as ContractFormType | null,
    insuranceRiskLevel: (record.insuranceRiskLevel ?? null) as CaseLevel | null,
    insuranceTypes: Array.isArray(record.insuranceTypes) ? record.insuranceTypes : [],
    insuranceMisrepresentations: Array.isArray(record.insuranceMisrepresentations)
      ? record.insuranceMisrepresentations
      : [],
    department: record.department ?? null,
    assignedSaleId: record.assignedSaleId ?? null,
    assignedSaleName: record.assignedSale?.name ?? null,
    assignedLawyerId: record.assignedLawyerId ?? null,
    assignedLawyerName: record.assignedLawyer?.name ?? null,
    assignedAssistantId: record.assignedAssistantId ?? null,
    assignedAssistantName: record.assignedAssistant?.name ?? null,
    caseStatus: record.caseStatus ?? null,
    closedReason: record.closedReason ?? null,
    voidReason: record.voidReason ?? null,
    salesCommission: formatNumeric(record.salesCommission),
    handlingFee: formatNumeric(record.handlingFee),
  version: record.version ?? 0,
  updaterId: record.updaterId ?? null,
  updaterName: record.updater?.name ?? null,
  updaterRole: record.updater?.role ?? null,
    createdAt: formatTimestamp(record.createdAt) ?? new Date().toISOString(),
    updatedAt: formatTimestamp(record.updatedAt) ?? new Date().toISOString(),
    participants: {
      claimants,
      respondents
    },
    collections,
    timeNodes,
    timeline,
    hearings
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

function buildWhereClause(options: ListCasesOptions): SQL<unknown> | undefined {
  const conditions: SQL<unknown>[] = [];

  if (options.department) {
    conditions.push(eq(cases.department, options.department));
  }
  const rawCaseId = options.caseId;
  const trimmedCaseId = typeof rawCaseId === 'string' ? rawCaseId.trim() : '';
  if (trimmedCaseId) {
    conditions.push(eq(cases.id, trimmedCaseId));
  }
  if (options.assignedSaleId) {
    conditions.push(eq(cases.assignedSaleId, options.assignedSaleId));
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
    const normalizedStatus = normalizeCaseStatusInput(options.caseStatus);
    if (normalizedStatus) {
      conditions.push(eq(cases.caseStatus, normalizedStatus));
    }
  }

  const rawCaseNumber = options.caseNumber;
  const trimmedCaseNumber = typeof rawCaseNumber === 'string' ? rawCaseNumber.trim() : '';
  if (trimmedCaseNumber) {
    const caseNumberTerm = `%${trimmedCaseNumber}%`;
    conditions.push(
      sql<unknown>`
        EXISTS (
          SELECT 1
          FROM ${caseHearings}
          WHERE ${caseHearings.caseId} = ${cases.id}
            AND ${caseHearings.caseNumber} ILIKE ${caseNumberTerm}
        )
      `
    );
  }

  const trimmedSearch = options.search?.trim();
  if (trimmedSearch) {
    const term = `%${trimmedSearch}%`;

    const searchCondition = sql<unknown>`
      (
        ${cases.provinceCity} ILIKE ${term}
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
    .filter((item): item is CaseTimelineInput => Boolean(item && item.note && item.occurredOn))
    .map((item) => {
      const occurredOn =
        normalizeDateInput(item.occurredOn) ?? new Date().toISOString().slice(0, 10);
      const note = typeof item.note === 'string' ? item.note.trim() : null;
      return {
        caseId,
        occurredOn,
        note: note && note.length > 0 ? note : '',
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
    trialLawyerId: normalizeTextInput(hearing.trialLawyerId),
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
    result.trialLawyerId !== null ||
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

function normalizeHearingInputs(
  hearings: CaseHearingInput[] | null | undefined,
  caseId?: string
): (typeof caseHearings.$inferInsert)[] {
  if (!caseId || !hearings || hearings.length === 0) {
    return [] as (typeof caseHearings.$inferInsert)[];
  }

  const normalized = hearings
    .map((hearing) => normalizeHearingInput(hearing, caseId))
    .filter((item): item is NonNullable<ReturnType<typeof normalizeHearingInput>> => item !== null);

  return normalized as (typeof caseHearings.$inferInsert)[];
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
      assignedSale: {
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
      updater: {
        columns: {
          id: true,
          name: true,
          role: true
        }
      },
      participants: true,
      collections: true,
      timeNodes: true,
      timeline: {
        with: {
          follower: true
        }
      },
      hearings: {
        with: {
          trialLawyer: {
            columns: {
              id: true,
              name: true,
              role: true
            }
          }
        }
      }
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

  const mappedRecords = records.map((record) => mapCaseRecord(record as CaseWithRelations));

  return {
    data: mappedRecords,
    pagination: {
      page,
      pageSize,
      total,
      totalPages
    } satisfies PaginationMeta
  };
}

export async function listCaseClients(options: CaseClientListOptions = {}, user: SessionUser) {
  ensureCasePermission(user, 'list');

  const page = Math.max(options.page ?? DEFAULT_PAGE, 1);
  const pageSize = Math.min(Math.max(options.pageSize ?? DEFAULT_PAGE_SIZE, 1), 100);
  const offset = (page - 1) * pageSize;

  const accessContext = await buildCaseAccessContext(user);
  const accessWhere = buildAccessWhere(accessContext);

  const filterConditions: SQL<unknown>[] = [eq(caseParticipants.role, 'claimant')];

  if (options.department) {
    filterConditions.push(eq(cases.department, options.department));
  }

  const trimmedSearch = options.search?.trim();
  if (trimmedSearch) {
    const keyword = `%${trimmedSearch}%`;
    filterConditions.push(
      sql<unknown>`
        (
          ${caseParticipants.name} ILIKE ${keyword}
          OR ${caseParticipants.phone} ILIKE ${keyword}
          OR ${caseParticipants.idNumber} ILIKE ${keyword}
        )
      `
    );
  }

  const filterWhere = filterConditions.length
    ? filterConditions.length === 1
      ? filterConditions[0]
      : and(...filterConditions)
    : undefined;

  const whereClause = mergeWhere(filterWhere, accessWhere);

  const assignedSaleUser = alias(users, 'case_client_assigned_sale');
  const assignedLawyerUser = alias(users, 'case_client_assigned_lawyer');
  const assignedAssistantUser = alias(users, 'case_client_assigned_assistant');

  const baseListQuery = db
    .select({
      id: caseParticipants.id,
      name: caseParticipants.name,
      entityType: caseParticipants.entityType,
      phone: caseParticipants.phone,
      idNumber: caseParticipants.idNumber,
      caseId: cases.id,
      caseType: cases.caseType,
      caseLevel: cases.caseLevel,
      caseStatus: cases.caseStatus,
      department: cases.department,
      assignedSaleName: assignedSaleUser.name,
      assignedLawyerName: assignedLawyerUser.name,
      assignedAssistantName: assignedAssistantUser.name,
      createdAt: cases.createdAt,
      updatedAt: cases.updatedAt
    })
    .from(caseParticipants)
    .innerJoin(cases, eq(caseParticipants.caseId, cases.id))
    .leftJoin(assignedSaleUser, eq(cases.assignedSaleId, assignedSaleUser.id))
    .leftJoin(assignedLawyerUser, eq(cases.assignedLawyerId, assignedLawyerUser.id))
    .leftJoin(assignedAssistantUser, eq(cases.assignedAssistantId, assignedAssistantUser.id));

  const recordsQuery = whereClause ? baseListQuery.where(whereClause) : baseListQuery;

  const records = await recordsQuery
    .orderBy(desc(cases.updatedAt))
    .limit(pageSize)
    .offset(offset);

  const baseTotalQuery = db
    .select({ value: count() })
    .from(caseParticipants)
    .innerJoin(cases, eq(caseParticipants.caseId, cases.id));

  const totalQuery = whereClause ? baseTotalQuery.where(whereClause) : baseTotalQuery;

  const totalResult = await totalQuery;
  const total = Number(totalResult?.[0]?.value ?? 0);
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  return {
    data: records.map((record) => mapCaseClientRecord(record as CaseClientQueryRecord)),
    pagination: {
      page,
      pageSize,
      total,
      totalPages
    } satisfies PaginationMeta
  };
}

export async function getCaseClientById(id: string, user: SessionUser): Promise<CaseClientDetailDTO | null> {
  ensureCasePermission(user, 'list');

  const trimmedId = id?.trim();
  if (!trimmedId) {
    throw new BadRequestError('客户ID不能为空');
  }

  const detailRecord = await loadCaseClientDetail(trimmedId);
  if (!detailRecord) {
    return null;
  }

  const accessContext = await buildCaseAccessContext(user);
  const projection = await db.query.cases.findFirst({
    where: eq(cases.id, detailRecord.caseId),
    columns: {
      id: true,
      department: true,
      assignedSaleId: true,
      assignedLawyerId: true,
      assignedAssistantId: true
    },
    with: {
      hearings: {
        columns: {
          trialLawyerId: true
        }
      }
    }
  });

  if (!projection) {
    return null;
  }

  if (!canAccessCase(accessContext, projection)) {
    throw new AuthorizationError();
  }

  return mapCaseClientDetailRecord(detailRecord);
}

export async function updateCaseClient(
  id: string,
  input: UpdateCaseClientInput,
  user: SessionUser
): Promise<CaseClientDetailDTO | null> {
  ensureCasePermission(user, 'update');

  const trimmedId = id?.trim();
  if (!trimmedId) {
    throw new BadRequestError('客户ID不能为空');
  }

  const existingDetail = await loadCaseClientDetail(trimmedId);
  if (!existingDetail) {
    return null;
  }

  const accessContext = await buildCaseAccessContext(user);
  const projection = await db.query.cases.findFirst({
    where: eq(cases.id, existingDetail.caseId),
    columns: {
      id: true,
      department: true,
      assignedSaleId: true,
      assignedLawyerId: true,
      assignedAssistantId: true
    },
    with: {
      hearings: {
        columns: {
          trialLawyerId: true
        }
      }
    }
  });

  if (!projection) {
    return null;
  }

  if (!canAccessCase(accessContext, projection)) {
    throw new AuthorizationError();
  }

  const updateValues: Partial<typeof caseParticipants.$inferInsert> = {};

  if (input.name !== undefined) {
    const trimmedName = input.name?.trim();
    if (!trimmedName) {
      throw new BadRequestError('客户名称不能为空');
    }
    updateValues.name = trimmedName;
  }

  if (input.entityType !== undefined) {
    if (input.entityType === null) {
      updateValues.entityType = null;
    } else if ((participantEntityEnum.enumValues as readonly string[]).includes(input.entityType)) {
      updateValues.entityType = input.entityType;
    } else {
      throw new BadRequestError('请选择有效的客户类型');
    }
  }

  if (input.phone !== undefined) {
    const trimmedPhone = input.phone?.trim();
    updateValues.phone = trimmedPhone && trimmedPhone.length > 0 ? trimmedPhone : null;
  }

  if (input.idNumber !== undefined) {
    const trimmedIdNumber = input.idNumber?.trim();
    updateValues.idNumber = trimmedIdNumber && trimmedIdNumber.length > 0 ? trimmedIdNumber : null;
  }

  if (input.address !== undefined) {
    const trimmedAddress = input.address?.trim();
    updateValues.address = trimmedAddress && trimmedAddress.length > 0 ? trimmedAddress : null;
  }

  if (input.isDishonest !== undefined && input.isDishonest !== null) {
    updateValues.isDishonest = Boolean(input.isDishonest);
  } else if (input.isDishonest === null) {
    updateValues.isDishonest = false;
  }

  if (Object.keys(updateValues).length === 0) {
    return mapCaseClientDetailRecord(existingDetail);
  }

  await db.transaction(async (tx) => {
    await tx
      .update(caseParticipants)
      .set(updateValues)
      .where(eq(caseParticipants.id, trimmedId));

    await tx
      .update(cases)
      .set({
        updatedAt: new Date(),
        updaterId: user.id ?? null
      })
      .where(eq(cases.id, existingDetail.caseId));
  });

  const refreshed = await loadCaseClientDetail(trimmedId);
  return refreshed ? mapCaseClientDetailRecord(refreshed) : null;
}

export async function getCaseTablePreferences(
  tableKey: string | undefined,
  user: SessionUser
): Promise<CaseTablePreferenceDTO> {
  ensureCasePermission(user, 'list');

  if (!user.id) {
    throw new AuthorizationError('当前账号无效，请重新登录', 401);
  }

  const resolvedKey = resolveCaseTableKey(tableKey);

  const existing = await db.query.caseTablePreferences.findFirst({
    where: and(eq(caseTablePreferences.userId, user.id), eq(caseTablePreferences.tableKey, resolvedKey))
  });

  const visibleColumns = sanitizeVisibleColumns(existing?.visibleColumns ?? DEFAULT_CASE_TABLE_COLUMNS);

  return {
    tableKey: resolvedKey,
    visibleColumns
  } satisfies CaseTablePreferenceDTO;
}

export async function updateCaseTablePreferences(
  tableKey: string | undefined,
  columns: unknown,
  user: SessionUser
): Promise<CaseTablePreferenceDTO> {
  ensureCasePermission(user, 'list');

  if (!user.id) {
    throw new AuthorizationError('当前账号无效，请重新登录', 401);
  }

  const resolvedKey = resolveCaseTableKey(tableKey);
  const visibleColumns = sanitizeVisibleColumns(columns);

  await db
    .insert(caseTablePreferences)
    .values({
      userId: user.id,
      tableKey: resolvedKey,
      visibleColumns
    })
    .onConflictDoUpdate({
      target: [caseTablePreferences.userId, caseTablePreferences.tableKey],
      set: {
        visibleColumns,
        updatedAt: sql`now()`
      }
    });

  return {
    tableKey: resolvedKey,
    visibleColumns
  } satisfies CaseTablePreferenceDTO;
}

export async function getCaseById(id: string, user: SessionUser) {
  ensureCasePermission(user, 'list');

  const accessContext = await buildCaseAccessContext(user);
  const accessWhere = buildAccessWhere(accessContext);
  const whereClause = accessWhere ? and(eq(cases.id, id), accessWhere) : eq(cases.id, id);

  const record = await db.query.cases.findFirst({
    where: whereClause,
    with: {
      assignedSale: {
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
      updater: {
        columns: {
          id: true,
          name: true,
          role: true
        }
      },
      participants: true,
      collections: true,
      timeNodes: true,
      timeline: {
        with: {
          follower: true
        }
      },
      hearings: {
        with: {
          trialLawyer: {
            columns: {
              id: true,
              name: true,
              role: true
            }
          }
        }
      }
    }
  });

  if (!record) {
    return null;
  }

  return mapCaseRecord(record as CaseWithRelations);
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

    const resolvedDepartment = caseValues.department ?? user.department ?? null;
    if (!caseValues.caseCategory) {
      caseValues.caseCategory = resolvedDepartment === 'insurance' ? 'insurance' : 'work_injury';
    }

    if (resolvedDepartment === 'insurance' && caseValues.caseCategory !== 'insurance') {
      caseValues.caseCategory = 'insurance';
    }

    if (!caseValues.assignedSaleId) {
      caseValues.assignedSaleId = user.id;
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

    const hearingInputs = await applyDefaultTrialLawyerList(input.hearings, user);
    const hearingValues = normalizeHearingInputs(hearingInputs, caseId);
    if (hearingValues.length > 0) {
      await tx.insert(caseHearings).values(hearingValues);
    }

    await syncCaseHearingEvents(tx, caseId);

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
        assignedSale: {
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
        updater: {
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
        hearings: {
          with: {
            trialLawyer: {
              columns: {
                id: true,
                name: true,
                role: true
              }
            }
          }
        }
      }
    });

    if (!fullRecord) {
      throw new Error('Failed to load created case');
    }

    return mapCaseRecord(fullRecord as CaseWithRelations);
  });
}

export async function deleteCase(id: string, user: SessionUser) {
  ensureCasePermission(user, 'delete');

  const accessContext = await buildCaseAccessContext(user);

  const existing = await db.query.cases.findFirst({
    where: eq(cases.id, id),
    columns: {
      id: true,
      assignedSaleId: true,
      department: true,
      assignedLawyerId: true,
      assignedAssistantId: true
    },
    with: {
      hearings: {
        columns: {
          trialLawyerId: true
        }
      }
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

export async function createCaseCollection(
  caseId: string,
  input: CreateCaseCollectionInput,
  user: SessionUser
): Promise<CaseCollectionDTO | null> {
  ensureCasePermission(user, 'update');

  if (!CASE_COLLECTION_ALLOWED_ROLES.has(user.role)) {
    throw new AuthorizationError('Insufficient permissions');
  }

  const normalizedAmount = normalizeNumericInput(input.amount ?? null);
  if (!normalizedAmount) {
    throw new BadRequestError('回款金额不能为空');
  }

  const numericAmount = Number(normalizedAmount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new BadRequestError('请填写有效的回款金额');
  }

  const normalizedReceivedAt = normalizeDateInput(input.receivedAt ?? new Date());
  if (!normalizedReceivedAt) {
    throw new BadRequestError('请填写有效的回款日期');
  }

  const accessContext = await buildCaseAccessContext(user);

  const projection = await db.query.cases.findFirst({
    where: eq(cases.id, caseId),
    columns: {
      id: true,
      department: true,
      assignedSaleId: true,
      assignedLawyerId: true,
      assignedAssistantId: true
    },
    with: {
      hearings: {
        columns: {
          trialLawyerId: true
        }
      }
    }
  });

  if (!projection) {
    return null;
  }

  if (!canAccessCase(accessContext, projection)) {
    throw new AuthorizationError();
  }

  const actor = extractActorContext(user);

  return db.transaction(async (tx) => {
    const [created] = await tx
      .insert(caseCollections)
      .values({
        caseId,
        amount: normalizedAmount,
        receivedAt: normalizedReceivedAt
      })
      .returning();

    if (!created) {
      throw new Error('Failed to create case collection record');
    }

    await tx
      .update(cases)
      .set({
        updatedAt: new Date(),
        updaterId: user.id
      })
      .where(eq(cases.id, caseId));

    const amountText = numericAmount.toFixed(2);
    await tx.insert(caseChangeLogs).values({
      caseId,
      action: 'add_collection',
      description: `新增回款记录：金额¥${amountText}，到账日期${normalizedReceivedAt}`,
      changes: null,
      actorId: actor.actorId,
      actorName: actor.actorName,
      actorRole: actor.actorRole
    });

    return mapCollection(created);
  });
}

export async function updateCaseTimeNodes(
  caseId: string,
  inputs: CaseTimeNodeInput[],
  user: SessionUser
): Promise<CaseTimeNodeDTO[] | null> {
  ensureCasePermission(user, 'update');

  if (!inputs || inputs.length === 0) {
    throw new BadRequestError('请选择要记录的时间节点');
  }

  const normalizedEntries: Array<{ nodeType: CaseTimeNodeType; occurredOn: string }> = [];
  const seenTypes = new Set<CaseTimeNodeType>();

  for (const item of inputs) {
    const nodeType = normalizeTimeNodeTypeInput(item?.nodeType ?? null);
    if (!nodeType) {
      throw new BadRequestError('不支持的时间节点');
    }

    const occurredOn = normalizeDateInput(item?.occurredOn ?? null);
    if (!occurredOn) {
      throw new BadRequestError('请选择有效的时间');
    }

    if (seenTypes.has(nodeType)) {
      throw new BadRequestError('同一时间节点存在重复记录');
    }

    seenTypes.add(nodeType);
    normalizedEntries.push({ nodeType, occurredOn });
  }

  if (normalizedEntries.length === 0) {
    throw new BadRequestError('请选择要记录的时间节点');
  }

  const accessContext = await buildCaseAccessContext(user);

  const projection = await db.query.cases.findFirst({
    where: eq(cases.id, caseId),
    columns: {
      id: true,
      department: true,
      assignedSaleId: true,
      assignedLawyerId: true,
      assignedAssistantId: true
    },
    with: {
      hearings: {
        columns: {
          trialLawyerId: true
        }
      }
    }
  });

  if (!projection) {
    return null;
  }

  if (!canAccessCase(accessContext, projection)) {
    throw new AuthorizationError();
  }

  if (!CASE_TIME_NODE_EDIT_ALLOWED_ROLES.has(user.role)) {
    throw new AuthorizationError('您没有权限编辑时间节点');
  }

  const existingNodes = await db.query.caseTimeNodes.findMany({
    where: eq(caseTimeNodes.caseId, caseId)
  });

  const existingMap = new Map<CaseTimeNodeType, CaseTimeNodeRow>();
  existingNodes.forEach(node => {
    existingMap.set(node.nodeType as CaseTimeNodeType, node);
  });

  const changes: Array<{ nodeType: CaseTimeNodeType; previous: string | null; current: string }> = [];

  normalizedEntries.forEach(({ nodeType, occurredOn }) => {
    const previous = existingMap.get(nodeType);
    const previousDate = previous ? formatDateOnly(previous.occurredOn) : null;
    if (!previousDate || previousDate !== occurredOn) {
      changes.push({ nodeType, previous: previousDate, current: occurredOn });
    }
  });

  await db.transaction(async (tx) => {
    await tx
      .insert(caseTimeNodes)
      .values(
        normalizedEntries.map(({ nodeType, occurredOn }) => ({
          caseId,
          nodeType,
          occurredOn
        }))
      )
      .onConflictDoUpdate({
        target: [caseTimeNodes.caseId, caseTimeNodes.nodeType],
        set: {
          occurredOn: sql`excluded.occurred_on`,
          updatedAt: sql`now()`
        }
      });

    if (changes.length > 0) {
      await tx
        .update(cases)
        .set({
          updatedAt: new Date(),
          updaterId: user.id
        })
        .where(eq(cases.id, caseId));

      const actor = extractActorContext(user);
      const description = changes
        .map(change => {
          const previousLabel = change.previous ?? '未记录';
          return `${CASE_TIME_NODE_LABEL_MAP[change.nodeType]}：${previousLabel} → ${change.current}`;
        })
        .join('；');

      await tx.insert(caseChangeLogs).values({
        caseId,
        action: 'update_time_node',
        description,
        changes: null,
        actorId: actor.actorId,
        actorName: actor.actorName,
        actorRole: actor.actorRole
      });
    }
  });

  const refreshedNodes = await db.query.caseTimeNodes.findMany({
    where: eq(caseTimeNodes.caseId, caseId)
  });

  return refreshedNodes
    .sort((a, b) =>
      CASE_TIME_NODE_SEQUENCE.indexOf(a.nodeType as CaseTimeNodeType) -
      CASE_TIME_NODE_SEQUENCE.indexOf(b.nodeType as CaseTimeNodeType)
    )
    .map(mapTimeNode);
}

export async function getCaseHearings(
  caseId: string,
  user: SessionUser
): Promise<CaseHearingDTO[] | null> {
  ensureCasePermission(user, 'list');

  const accessContext = await buildCaseAccessContext(user);

  const existing = await db.query.cases.findFirst({
    where: eq(cases.id, caseId),
    columns: {
      id: true,
      assignedSaleId: true,
      department: true,
      assignedLawyerId: true,
      assignedAssistantId: true
    },
    with: {
      hearings: {
        columns: {
          trialLawyerId: true
        }
      }
    }
  });

  if (!existing) {
    return null;
  }

  if (!canAccessCase(accessContext, existing)) {
    throw new AuthorizationError();
  }

  const records = await db.query.caseHearings.findMany({
    where: eq(caseHearings.caseId, caseId),
    with: {
      trialLawyer: {
        columns: {
          id: true,
          name: true,
          role: true
        }
      }
    }
  });

  const mapped = records
    .map(mapHearing)
    .filter((item): item is CaseHearingDTO => item !== null)
    .sort((a, b) => {
      const aTime = a.hearingTime ? new Date(a.hearingTime).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.hearingTime ? new Date(b.hearingTime).getTime() : Number.MAX_SAFE_INTEGER;
      if (aTime === bTime) {
        const stageOrder = (stage: TrialStage | null) =>
          stage ? trialStageEnum.enumValues.indexOf(stage) : Number.MAX_SAFE_INTEGER;
        return stageOrder(a.trialStage) - stageOrder(b.trialStage);
      }
      return aTime - bTime;
    });

  return mapped;
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
      assignedSaleId: true,
      department: true,
      assignedLawyerId: true,
      assignedAssistantId: true
    },
    with: {
      hearings: {
        columns: {
          trialLawyerId: true
        }
      }
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

const ASSIGNABLE_ROLES = new Set(['super_admin', 'admin', 'administration', 'lawyer']);

const USER_ROLE_VALUES = ['super_admin', 'admin', 'administration', 'lawyer', 'assistant', 'sale'] as const;

function normalizeUserRoleValue(value: unknown): SharedUserRole {
  return USER_ROLE_VALUES.includes(value as SharedUserRole)
    ? (value as SharedUserRole)
    : 'assistant';
}

function normalizeUserDepartmentValue(value: unknown): SharedUserDepartment | null {
  if (typeof value !== 'string') {
    return null;
  }

  return (departmentEnum.enumValues as readonly string[]).includes(value)
    ? (value as SharedUserDepartment)
    : null;
}

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

  const normalizedDepartment = normalizeUserDepartmentValue(department) ?? undefined;
  const userDepartment = normalizeUserDepartmentValue(user.department);

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
    role: normalizeUserRoleValue(member.role),
    department: normalizeUserDepartmentValue(member.department)
  });

  const filterByDepartment = (
    list: typeof members,
    targetDepartment?: SharedUserDepartment | null
  ) => {
    if (!targetDepartment) {
      return list;
    }
    return list.filter((member) => member.department === targetDepartment);
  };

  const resolveDepartment = (): (typeof departmentEnum.enumValues)[number] => {
    if (user.role === 'super_admin') {
      if (!normalizedDepartment) {
        throw new BadRequestError('缺少部门参数');
      }
      return normalizedDepartment;
    }

    if (user.role === 'admin' || user.role === 'administration') {
      if (!userDepartment) {
        throw new AuthorizationError('管理员未设置所属部门，无法获取候选人员');
      }
      if (normalizedDepartment && normalizedDepartment !== userDepartment) {
        throw new AuthorizationError('管理员仅可查看所属部门成员');
      }
      return userDepartment;
    }

    if (userDepartment) {
      if (normalizedDepartment && normalizedDepartment !== userDepartment) {
        throw new AuthorizationError('当前角色仅可获取所属部门成员');
      }
      return userDepartment;
    }

    const managerId = user.supervisorId;
    if (!managerId) {
      throw new AuthorizationError('未找到上级管理员，无法获取候选人员');
    }

    const manager = activeMembers.find(
      (member) => member.id === managerId && member.role === 'admin'
    );

    if (!manager) {
      throw new AuthorizationError('未找到上级管理员，无法获取候选人员');
    }

    const managerDepartment = (manager.department as (typeof departmentEnum.enumValues)[number] | null) ?? null;
    if (!managerDepartment) {
      throw new AuthorizationError('上级管理员未设置所属部门，无法获取候选人员');
    }

    if (normalizedDepartment && normalizedDepartment !== managerDepartment) {
      throw new AuthorizationError('当前角色仅可获取所属部门成员');
    }

    return managerDepartment;
  };

  const targetDepartment = resolveDepartment();
  const departmentMembers = filterByDepartment(activeMembers, targetDepartment);

  const lawyerCandidates = departmentMembers.filter((member) => member.role === 'lawyer');
  const assistantCandidates = departmentMembers.filter((member) => member.role === 'assistant');

  return {
    lawyers: sortStaff(lawyerCandidates.map(toDTO)),
    assistants: sortStaff(assistantCandidates.map(toDTO))
  };
}
