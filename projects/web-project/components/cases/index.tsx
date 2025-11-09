import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import dayjs, { type Dayjs } from 'dayjs';
import { App, Button, Card, Checkbox, Dropdown, Form, Input, List, Modal, Select, Space, Table, Tag, Tooltip, Typography } from 'antd';
import type { MenuProps } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import { ArrowDownOutlined, ArrowUpOutlined, EllipsisOutlined, PlusOutlined, SettingOutlined } from '@ant-design/icons';

import WorkInjuryCaseModal, {
  type AssignStaffFormValues,
  type CaseStatusFormValues,
  type FeeFormValues,
  type HearingFormValues,
  type WorkInjuryCaseFormValues,
  type WorkInjuryCaseTabKey
} from './modal';
import {
  CASE_DEPARTMENT_CONFIG,
  DEFAULT_CASE_DEPARTMENT,
  CASE_TABLE_COLUMN_LABELS,
  type CaseTableActionKey
} from './department-config';
import TimeNodeModal from './operations/TimeNodeModal';
import UpdateStatusModal from './operations/UpdateStatusModal';
import { useDashboardHeaderAction } from '@/app/(dashboard)/header-context';
import { ApiError } from '@/lib/api-client';
import { useSessionStore } from '@/lib/stores/session-store';
import { useWorkInjuryCaseOperationsStore } from './operations/useCaseOperationsStore';
import { CASE_LEVEL_LABEL_MAP, CASE_STATUS_COLOR_MAP, CASE_STATUS_LABEL_MAP as CASE_STATUS_LABELS, CASE_TYPE_LABEL_MAP, CONTRACT_FORM_LABELS } from '@/utils/constants';
import {
  createCase as createCaseApi,
  createCaseCollection as createCaseCollectionApi,
  fetchAssignableStaff,
  fetchCaseChangeLogs,
  fetchCaseById,
  fetchCases,
  fetchCaseTablePreferences,
  type CaseHearingRecord,
  type CaseParticipantInput,
  type CaseParticipantsInput,
  type CaseParticipantsGroup,
  type CaseParticipant,
  type CasePayload,
  type CaseRecord,
  type CaseStatus,
  type CaseLevel,
  type CaseTimelineInput,
  type CaseTimeNodeType,
  type TrialStage,
  type CaseType,
  type CaseCollectionInput,
  type CaseCategory,
  type ContractFormType,
  type ContractQuoteType,
  type LitigationFeeType,
  type TravelFeeType,
  type CaseChangeLog,
  type CaseTableColumnKey,
  type CaseUpdateConflictDetails,
  type CaseUpdateMeta,
  CaseUpdateConflictError,
  updateCase as updateCaseApi,
  updateCaseTablePreferences,
  updateCaseTimeNodes
} from '@/lib/cases-api';
import CaseConflictModal from './conflict-modal';
import type { UserDepartment, UserRole } from '@/lib/users-api';
import FollowUpModal from './operations/FollowUpModal';
import styles from './styles.module.scss';

const DEFAULT_PAGE_SIZE = 10;

const CASE_STATUS_OPTIONS: CaseStatus[] = ['open', 'closed', 'void'];

const CASE_CREATE_ALLOWED_ROLES: ReadonlySet<UserRole> = new Set<UserRole>([
  'super_admin',
  'admin',
  'sale'
]);

const CASE_FEE_ALLOWED_ROLES: ReadonlySet<UserRole> = new Set<UserRole>([
  'super_admin',
  'admin',
  'administration'
]);

const CASE_COLLECTION_ALLOWED_ROLES: ReadonlySet<UserRole> = new Set<UserRole>([
  'super_admin',
  'admin',
  'administration'
]);

const CASE_TIME_NODE_EDIT_ALLOWED_ROLES: ReadonlySet<UserRole> = new Set<UserRole>([
  'super_admin',
  'admin',
  'lawyer',
  'assistant'
]);

interface CaseConflictState {
  caseId: string;
  payload: CasePayload;
  meta: CaseUpdateMeta;
  details: CaseUpdateConflictDetails;
  successMessage?: string;
}

const sortParticipantsByOrder = (participants: CaseParticipant[] = []): CaseParticipant[] =>
  [...participants].sort((a, b) => {
    const orderA = a.sortOrder ?? Number.MAX_SAFE_INTEGER;
    const orderB = b.sortOrder ?? Number.MAX_SAFE_INTEGER;

    if (orderA !== orderB) {
      return orderA - orderB;
    }

    const nameA = (a.name ?? '').trim();
    const nameB = (b.name ?? '').trim();
    return nameA.localeCompare(nameB, 'zh-CN');
  });

const collectNonOpponentPartyNames = (participants?: CaseParticipantsGroup): string[] => {
  if (!participants || !participants.claimants || participants.claimants.length === 0) {
    return [];
  }

  return sortParticipantsByOrder(participants.claimants)
    .map((item) => item.name.trim())
    .filter((name) => name.length > 0);
};

const collectOpponentPartyNames = (participants?: CaseParticipantsGroup): string[] => {
  if (!participants || !participants.respondents || participants.respondents.length === 0) {
    return [];
  }

  return sortParticipantsByOrder(participants.respondents)
    .map((item) => item.name.trim())
    .filter((name) => name.length > 0);
};

const TRIAL_STAGE_SEQUENCE: TrialStage[] = ['first_instance', 'second_instance', 'retrial'];

const CASE_NUMBER_STAGE_PRIORITY: TrialStage[] = ['retrial', 'second_instance', 'first_instance'];

const sanitizeColumnSelection = (
  columns: unknown,
  defaultColumns: CaseTableColumnKey[],
  columnKeySet: ReadonlySet<CaseTableColumnKey>
): CaseTableColumnKey[] => {
  if (!Array.isArray(columns)) {
    return [...defaultColumns];
  }

  const unique: CaseTableColumnKey[] = [];

  for (const item of columns) {
    if (typeof item !== 'string') {
      continue;
    }

    if (!columnKeySet.has(item as CaseTableColumnKey)) {
      continue;
    }

    if (unique.includes(item as CaseTableColumnKey)) {
      continue;
    }

    unique.push(item as CaseTableColumnKey);
  }

  return unique.length > 0 ? unique : [...defaultColumns];
};

const createInitialPagination = (): TablePaginationConfig => ({
  current: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  total: 0,
  className: styles.pagination,
  showQuickJumper: true,
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '30', '50']
});

const resolveStageOrder = (stage?: TrialStage | null): number => {
  if (!stage) {
    return TRIAL_STAGE_SEQUENCE.length;
  }
  const index = TRIAL_STAGE_SEQUENCE.indexOf(stage);
  return index === -1 ? TRIAL_STAGE_SEQUENCE.length : index;
};

const sortHearings = (hearings: CaseHearingRecord[] = []): CaseHearingRecord[] =>
  [...hearings].sort((a, b) => {
    const timeA = a.hearingTime ? new Date(a.hearingTime).getTime() : Number.MAX_SAFE_INTEGER;
    const timeB = b.hearingTime ? new Date(b.hearingTime).getTime() : Number.MAX_SAFE_INTEGER;

    if (timeA !== timeB) {
      return timeA - timeB;
    }

    return resolveStageOrder(a.trialStage) - resolveStageOrder(b.trialStage);
  });

const sortHearingInputs = (
  hearings: NonNullable<CasePayload['hearings']>
): NonNullable<CasePayload['hearings']> =>
  [...hearings].sort((a, b) => {
    const timeA = a.hearingTime ? new Date(a.hearingTime).getTime() : Number.MAX_SAFE_INTEGER;
    const timeB = b.hearingTime ? new Date(b.hearingTime).getTime() : Number.MAX_SAFE_INTEGER;

    if (timeA !== timeB) {
      return timeA - timeB;
    }

    return resolveStageOrder(a.trialStage ?? null) - resolveStageOrder(b.trialStage ?? null);
  });

const mapHearingRecordToInput = (
  record: CaseHearingRecord
): NonNullable<CasePayload['hearings']>[number] => ({
  trialLawyerId: toNullableText(record.trialLawyerId ?? null),
  hearingTime: record.hearingTime ?? null,
  hearingLocation: toNullableText(record.hearingLocation ?? null),
  tribunal: toNullableText(record.tribunal ?? null),
  judge: toNullableText(record.judge ?? null),
  caseNumber: toNullableText(record.caseNumber ?? null),
  contactPhone: toNullableText(record.contactPhone ?? null),
  trialStage: record.trialStage ?? null,
  hearingResult: toNullableText(record.hearingResult ?? null)
});

function toNullableText(value?: string | null): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toNumericString(value?: number | null): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (Number.isNaN(value)) {
    return null;
  }
  return value.toString();
}

const formatDayValue = (value?: Dayjs | null): string | null => (value ? value.format('YYYY-MM-DD') : null);

const formatDateTimeValue = (value?: Dayjs | null): string | null => (value ? value.toDate().toISOString() : null);

const parseNumberValue = (value?: string | null): number | undefined => {
  if (!value) {
    return undefined;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
};

const toDayjsValue = (value?: string | null): Dayjs | undefined => {
  if (!value) {
    return undefined;
  }
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed : undefined;
};

type ClosedReason = '调解' | '判决' | '撤诉' | '和解';
type VoidReason = '退单' | '跑单';

const CLOSED_REASONS: readonly ClosedReason[] = ['调解', '判决', '撤诉', '和解'] as const;
const VOID_REASONS: readonly VoidReason[] = ['退单', '跑单'] as const;

const castClosedReason = (value?: string | null): ClosedReason | undefined => {
  if (!value) {
    return undefined;
  }
  return (CLOSED_REASONS as readonly string[]).includes(value) ? (value as ClosedReason) : undefined;
};

const castVoidReason = (value?: string | null): VoidReason | undefined => {
  if (!value) {
    return undefined;
  }
  return (VOID_REASONS as readonly string[]).includes(value) ? (value as VoidReason) : undefined;
};

const ORGANIZATION_KEYWORDS = ['公司', '有限', '责任'];

const abbreviateOrganizationName = (fullName: string): string => {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return '未知';
  }
  if (ORGANIZATION_KEYWORDS.some((keyword) => trimmed.includes(keyword))) {
    const matches = trimmed.match(/([^有限公司责任合伙集团]+)/);
    return matches && matches[1] ? matches[1].substring(0, 8) : trimmed.substring(0, 6);
  }
  return trimmed;
};

const normalizeName = (value?: string | null): string | null => {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const formatPartyDisplayName = (participant?: CaseParticipant | null): string => {
  const normalizedName = normalizeName(participant?.name ?? null);
  if (!normalizedName) {
    return '';
  }
  if ((participant?.entityType ?? null) === 'organization') {
    return abbreviateOrganizationName(normalizedName);
  }
  return normalizedName;
};

const formatCaseTypeForTitle = (caseType: CaseType): string => {
  if (caseType === 'other') {
    return '相关';
  }
  return CASE_TYPE_LABEL_MAP[caseType] ?? '案件';
};

const sanitizeStringList = (list?: string[] | null): string[] => {
  if (!Array.isArray(list)) {
    return [];
  }
  return list
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter((item): item is string => item.length > 0);
};

const buildCaseTitle = (record: CaseRecord): string => {
  const dateSource = normalizeName(record.entryDate) ?? normalizeName(record.updatedAt) ?? normalizeName(record.createdAt);
  const dateText = (() => {
    if (!dateSource) {
      return '日期待定';
    }
    const parsed = dayjs(dateSource);
    if (!parsed.isValid()) {
      return '日期待定';
    }
    return parsed.format('YYYYMMDD');
  })();

  const claimant = formatPartyDisplayName(record.participants.claimants?.[0]);
  const respondent = formatPartyDisplayName(record.participants.respondents?.[0]);
  const caseTypeLabel = formatCaseTypeForTitle(record.caseType);

  return `（${dateText}）${claimant}${respondent ? `·${respondent}` : ''}${caseTypeLabel}案-${record.caseLevel}`;
};

const getHearingTimestamp = (hearing: CaseHearingRecord): number => {
  const sources = [hearing.hearingTime, hearing.updatedAt, hearing.createdAt];
  for (const source of sources) {
    if (!source) {
      continue;
    }
    const parsed = dayjs(source);
    if (parsed.isValid()) {
      return parsed.valueOf();
    }
  }
  return 0;
};

const getPreferredCaseNumber = (record: CaseRecord): string | null => {
  const hearings = record.hearings ?? [];
  if (!hearings.length) {
    return null;
  }

  const stageMap = new Map<TrialStage, CaseHearingRecord>();

  hearings.forEach((hearing) => {
    const stage = hearing.trialStage ?? null;
    const caseNumber = toNullableText(hearing.caseNumber ?? null);
    if (!stage || !caseNumber) {
      return;
    }
    const existing = stageMap.get(stage);
    if (!existing || getHearingTimestamp(hearing) >= getHearingTimestamp(existing)) {
      stageMap.set(stage, hearing);
    }
  });

  for (const stage of CASE_NUMBER_STAGE_PRIORITY) {
    const hearing = stageMap.get(stage);
    const caseNumber = hearing?.caseNumber ? hearing.caseNumber.trim() : null;
    if (caseNumber) {
      return caseNumber;
    }
  }

  const fallback = hearings.find((hearing) => toNullableText(hearing.caseNumber ?? null));
  return fallback?.caseNumber ? fallback.caseNumber.trim() : null;
};

function mapCaseRecordToFormValues(record: CaseRecord): WorkInjuryCaseFormValues {
  const claimants = (record.participants.claimants ?? []).map((participant) => ({
    entityType: participant.entityType ?? undefined,
    name: participant.name ?? undefined,
    idNumber: participant.idNumber ?? undefined,
    phone: participant.phone ?? undefined,
    address: participant.address ?? undefined,
    isDishonest: participant.isDishonest ?? false
  }));

  const respondents = (record.participants.respondents ?? []).map((participant) => ({
    entityType: participant.entityType ?? undefined,
    name: participant.name ?? undefined,
    idNumber: participant.idNumber ?? undefined,
    phone: participant.phone ?? undefined,
    address: participant.address ?? undefined,
    isDishonest: participant.isDishonest ?? false
  }));

  const collections = (record.collections ?? []).map((item) => ({
    amount: parseNumberValue(item.amount) ?? undefined,
    date: toDayjsValue(item.receivedAt ?? null)
  }));

  const normalizedHearings = sortHearings(record.hearings ?? []);
  const latestHearing = normalizedHearings.length ? normalizedHearings[normalizedHearings.length - 1] : null;

  return {
    basicInfo: {
      caseType: record.caseType,
      caseLevel: record.caseLevel,
      caseCategory: record.caseCategory ?? undefined,
      provinceCity: record.provinceCity ?? undefined,
      targetAmount: record.targetAmount ?? undefined,
      feeStandard: record.feeStandard ?? undefined,
      agencyFeeEstimate: record.agencyFeeEstimate ?? undefined,
      dataSource: record.dataSource ?? undefined,
      hasContract: record.hasContract ?? undefined,
      contractDate: toDayjsValue(record.contractDate ?? null),
      clueDate: toDayjsValue(record.clueDate ?? null),
      hasSocialSecurity: record.hasSocialSecurity ?? undefined,
      entryDate: toDayjsValue(record.entryDate ?? null),
      injuryLocation: record.injuryLocation ?? undefined,
      injurySeverity: record.injurySeverity ?? undefined,
      injuryCause: record.injuryCause ?? undefined,
      workInjuryCertified: record.workInjuryCertified ?? undefined,
      monthlySalary: record.monthlySalary ?? undefined,
      appraisalLevel: record.appraisalLevel ?? undefined,
      appraisalEstimate: record.appraisalEstimate ?? undefined,
      existingEvidence: record.existingEvidence ?? undefined,
      customerCooperative: record.customerCooperative ?? undefined,
      witnessCooperative: record.witnessCooperative ?? undefined,
      remark: record.remark ?? undefined,
      contractQuoteType: record.contractQuoteType ?? undefined,
      contractQuoteAmount: parseNumberValue(record.contractQuoteAmount ?? null),
      contractQuoteUpfront: parseNumberValue(record.contractQuoteUpfront ?? null),
      contractQuoteRatio: parseNumberValue(record.contractQuoteRatio ?? null),
      contractQuoteOther: record.contractQuoteOther ?? undefined,
      estimatedCollection: parseNumberValue(record.estimatedCollection ?? null),
      litigationFeeType: record.litigationFeeType ?? undefined,
      travelFeeType: record.travelFeeType ?? undefined,
      contractForm: record.contractForm ?? undefined,
      insuranceRiskLevel: record.insuranceRiskLevel ?? undefined,
      insuranceTypes: sanitizeStringList(record.insuranceTypes),
      insuranceMisrepresentations: sanitizeStringList(record.insuranceMisrepresentations)
    },
    parties: {
      claimants,
      respondents
    },
    lawyerInfo: {
      trialLawyerId: latestHearing?.trialLawyerId ?? undefined,
      trialLawyerName: latestHearing?.trialLawyerName ?? undefined,
      hearingTime: toDayjsValue(latestHearing?.hearingTime ?? null),
      hearingLocation: latestHearing?.hearingLocation ?? undefined,
      tribunal: latestHearing?.tribunal ?? undefined,
      judge: latestHearing?.judge ?? undefined,
      caseNumber: latestHearing?.caseNumber ?? undefined,
      contactPhone: latestHearing?.contactPhone ?? undefined,
      trialStage: latestHearing?.trialStage ?? undefined,
      hearingResult: latestHearing?.hearingResult ?? undefined,
      hearingRecords: normalizedHearings
    },
    adminInfo: {
      assignedLawyer: record.assignedLawyerId ?? undefined,
      assignedLawyerName: record.assignedLawyerName ?? undefined,
      assignedAssistant: record.assignedAssistantId ?? undefined,
      assignedAssistantName: record.assignedAssistantName ?? undefined,
      assignedSaleId: record.assignedSaleId ?? undefined,
      assignedSaleName: record.assignedSaleName ?? undefined,
      caseStatus: record.caseStatus ?? undefined,
      closedReason: castClosedReason(record.closedReason ?? undefined),
      voidReason: castVoidReason(record.voidReason ?? undefined),
      salesCommission: record.salesCommission ?? null,
      handlingFee: record.handlingFee ?? null,
      collections
    },
    timeline: record.timeline ?? [],
    timeNodes: record.timeNodes ?? []
  } satisfies WorkInjuryCaseFormValues;
}

function mapTimelineRecordsToInputs(record: CaseRecord): CaseTimelineInput[] {
  return (record.timeline ?? []).map((item) => ({
    id: item.id,
    occurredOn: item.occurredOn,
    note: item.note ?? null,
    followerId: item.followerId ?? null
  }));
}

function mapParticipantList(list?: Array<{
  entityType?: string;
  name?: string;
  idNumber?: string;
  phone?: string;
  address?: string;
  isDishonest?: boolean;
}>): CaseParticipantInput[] | undefined {
  if (!list || list.length === 0) {
    return undefined;
  }

  const mapped = list.reduce<CaseParticipantInput[]>((acc, item, index) => {
    const name = toNullableText(item?.name ?? null);
    if (!name) {
      return acc;
    }

    acc.push({
      entityType: (item?.entityType ?? null) as CaseParticipantInput['entityType'],
      name,
      idNumber: toNullableText(item?.idNumber ?? null),
      phone: toNullableText(item?.phone ?? null),
      address: toNullableText(item?.address ?? null),
      isDishonest: item?.isDishonest ?? false,
      sortOrder: index
    });

    return acc;
  }, []);

  return mapped.length ? mapped : undefined;
}

function mapParticipants(parties?: WorkInjuryCaseFormValues['parties']): CaseParticipantsInput | undefined {
  if (!parties) {
    return undefined;
  }

  const claimants = mapParticipantList(parties.claimants);
  const respondents = mapParticipantList(parties.respondents);

  if (!claimants && !respondents) {
    return undefined;
  }

  return {
    claimants,
    respondents
  };
}

function mapCollections(collections?: Array<{ amount?: number; date?: Dayjs | null }>):
  | CaseCollectionInput[]
  | undefined {
  if (!collections || collections.length === 0) {
    return undefined;
  }

  const mapped = collections.reduce<CaseCollectionInput[]>((acc, item) => {
    const amount = toNumericString(item?.amount ?? null);
    const receivedAt = formatDayValue(item?.date ?? null);

    if (!amount || !receivedAt) {
      return acc;
    }

    acc.push({
      amount,
      receivedAt
    });

    return acc;
  }, []);

  return mapped.length ? mapped : undefined;
}

function mapFormToCasePayload(values: WorkInjuryCaseFormValues, department: CasePayload['department']): CasePayload {
  const basic = values.basicInfo ?? {};
  const admin = values.adminInfo ?? {};
  const resolvedDepartment = department ?? null;
  const resolvedCategory: CaseCategory = (basic.caseCategory ?? (resolvedDepartment === 'insurance' ? 'insurance' : 'work_injury')) as CaseCategory;
  const insuranceTypes = sanitizeStringList(basic.insuranceTypes ?? null);
  const insuranceMisrepresentations = sanitizeStringList(basic.insuranceMisrepresentations ?? null);

  const payload: CasePayload = {
    caseType: (basic.caseType ?? 'work_injury') as CasePayload['caseType'],
    caseLevel: (basic.caseLevel ?? 'A') as CasePayload['caseLevel'],
    caseCategory: resolvedCategory,
    provinceCity: toNullableText(basic.provinceCity ?? null),
    targetAmount: basic.targetAmount ?? null,
    feeStandard: toNullableText(basic.feeStandard ?? null),
    agencyFeeEstimate: basic.agencyFeeEstimate ?? null,
    dataSource: toNullableText(basic.dataSource ?? null),
    hasContract: basic.hasContract ?? null,
    contractDate: formatDayValue(basic.contractDate ?? null),
    clueDate: formatDayValue(basic.clueDate ?? null),
    hasSocialSecurity: basic.hasSocialSecurity ?? null,
    entryDate: formatDayValue(basic.entryDate ?? null),
    injuryLocation: toNullableText(basic.injuryLocation ?? null),
    injurySeverity: toNullableText(basic.injurySeverity ?? null),
    injuryCause: toNullableText(basic.injuryCause ?? null),
    workInjuryCertified: basic.workInjuryCertified ?? null,
    monthlySalary: basic.monthlySalary ?? null,
    appraisalLevel: toNullableText(basic.appraisalLevel ?? null),
    appraisalEstimate: toNullableText(basic.appraisalEstimate ?? null),
    existingEvidence: toNullableText(basic.existingEvidence ?? null),
    customerCooperative: basic.customerCooperative ?? null,
    witnessCooperative: basic.witnessCooperative ?? null,
    remark: toNullableText(basic.remark ?? null),
    contractQuoteType: (basic.contractQuoteType ?? null) as ContractQuoteType | null,
    contractQuoteAmount: toNumericString(basic.contractQuoteAmount ?? null),
    contractQuoteUpfront: toNumericString(basic.contractQuoteUpfront ?? null),
    contractQuoteRatio: toNumericString(basic.contractQuoteRatio ?? null),
    contractQuoteOther: toNullableText(basic.contractQuoteOther ?? null),
    estimatedCollection: toNumericString(basic.estimatedCollection ?? null),
    litigationFeeType: (basic.litigationFeeType ?? null) as LitigationFeeType | null,
    travelFeeType: (basic.travelFeeType ?? null) as TravelFeeType | null,
    contractForm: (basic.contractForm ?? null) as ContractFormType | null,
    insuranceRiskLevel: (basic.insuranceRiskLevel ?? null) as CaseLevel | null,
    insuranceTypes,
    insuranceMisrepresentations,
    department: resolvedDepartment,
    assignedLawyerId: toNullableText(admin.assignedLawyer ?? null),
    assignedAssistantId: toNullableText(admin.assignedAssistant ?? null),
    caseStatus: admin.caseStatus ?? null,
    closedReason: toNullableText(admin.closedReason ?? null),
    voidReason: toNullableText(admin.voidReason ?? null),
    participants: mapParticipants(values.parties),
    collections: mapCollections(admin.collections)
  };

  return payload;
}

type CaseFilters = {
  caseNumber?: string;
  caseType?: CaseType;
  caseLevel?: CaseLevel;
  caseStatus?: CaseStatus;
  caseId?: string;
};

interface CasesPageProps {
  department: UserDepartment;
  initialCaseId?: string | null;
}

export default function CasesPage({ department, initialCaseId }: CasesPageProps) {
  const { message } = App.useApp();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const activeDepartment = department ?? DEFAULT_CASE_DEPARTMENT;
  const departmentConfig =
    CASE_DEPARTMENT_CONFIG[activeDepartment] ?? CASE_DEPARTMENT_CONFIG[DEFAULT_CASE_DEPARTMENT];
  const pageDepartment = departmentConfig.department;
  const filterOptionSet = useMemo(() => new Set(departmentConfig.filterOptions), [departmentConfig]);
  const shouldShowCaseNumberFilter = filterOptionSet.has('caseNumber');
  const shouldShowCaseTypeFilter = filterOptionSet.has('caseType');
  const shouldShowCaseLevelFilter = filterOptionSet.has('caseLevel');
  const shouldShowCaseStatusFilter = filterOptionSet.has('caseStatus');

  const columnOptions = useMemo(
    () => departmentConfig.columnOptions.map((option) => ({ ...option })),
    [departmentConfig]
  );
  const defaultColumns = useMemo(
    () => [...departmentConfig.defaultColumns],
    [departmentConfig]
  );
  const tableStorageKey = departmentConfig.tableKey;
  const visibleModalTabs = useMemo(
    () => [...departmentConfig.visibleTabs],
    [departmentConfig]
  );
  const visibleModalTabSet = useMemo(
    () => new Set<WorkInjuryCaseTabKey>(visibleModalTabs),
    [visibleModalTabs]
  );
  const editableModalTabsSet = useMemo(
    () => new Set<WorkInjuryCaseTabKey>(departmentConfig.editableTabs),
    [departmentConfig]
  );
  const editableModalTabsArray = useMemo(
    () => Array.from(editableModalTabsSet),
    [editableModalTabsSet]
  );
  const modalOperationFlags = useMemo(
    () => ({ ...departmentConfig.modalOperations }),
    [departmentConfig]
  );
  const enabledTableActions = useMemo(
    () => new Set<CaseTableActionKey>(departmentConfig.tableActions),
    [departmentConfig]
  );
  const allowCaseCreation = departmentConfig.allowCreate;

  const columnKeySet = useMemo(
    () => new Set<CaseTableColumnKey>(columnOptions.map((option) => option.key)),
    [columnOptions]
  );

  const columnLabelMap = useMemo(
    () =>
      columnOptions.reduce(
        (acc, option) => {
          acc[option.key] = option.label;
          return acc;
        },
        {} as Record<CaseTableColumnKey, string>
      ),
    [columnOptions]
  );

  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newCaseModalOpen, setNewCaseModalOpen] = useState(false);
  const [caseModalOpen, setCaseModalOpen] = useState(false);
  const [caseModalMode, setCaseModalMode] = useState<'view' | 'update'>('view');
  const [caseModalCase, setCaseModalCase] = useState<CaseRecord | null>(null);
  const [caseModalCanEdit, setCaseModalCanEdit] = useState(false);
  const [caseModalInitialTab, setCaseModalInitialTab] = useState<WorkInjuryCaseTabKey | undefined>(undefined);
  const [caseConflict, setCaseConflict] = useState<CaseConflictState | null>(null);
  const [caseConflictRefreshing, setCaseConflictRefreshing] = useState(false);
  const [caseConflictMerging, setCaseConflictMerging] = useState(false);
  const [timeNodeModalOpen, setTimeNodeModalOpen] = useState(false);
  const [timeNodeTarget, setTimeNodeTarget] = useState<CaseRecord | null>(null);
  const [timeNodeSaving, setTimeNodeSaving] = useState(false);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<CaseTableColumnKey[]>(defaultColumns);
  const [columnPreferencesLoading, setColumnPreferencesLoading] = useState(false);
  const [columnModalOpen, setColumnModalOpen] = useState(false);
  const [columnModalSelection, setColumnModalSelection] = useState<CaseTableColumnKey[]>(defaultColumns);
  const [columnModalSaving, setColumnModalSaving] = useState(false);
  const [pagination, setPagination] = useState<TablePaginationConfig>(createInitialPagination);
  const [filterForm] = Form.useForm<CaseFilters>();
  const filtersRef = useRef<CaseFilters>({});
  const [filters, setFilters] = useState<CaseFilters>({});
  const appliedInitialCaseIdRef = useRef<string | null>(null);

  useEffect(() => {
    setVisibleColumnKeys([...defaultColumns]);
    setColumnModalSelection([...defaultColumns]);
  }, [defaultColumns]);

  const changeLogCacheRef = useRef<Map<string, CaseChangeLog[]>>(new Map());
  const currentUser = useSessionStore((state) => state.user);
  const registerCaseUpdater = useWorkInjuryCaseOperationsStore((state) => state.registerCaseUpdater);
  const registerCaseDetailLauncher = useWorkInjuryCaseOperationsStore((state) => state.registerCaseDetailLauncher);
  const openStatusModal = useWorkInjuryCaseOperationsStore((state) => state.openStatusModal);
  const openFollowUpModal = useWorkInjuryCaseOperationsStore((state) => state.openFollowUpModal);
  const setMessageApi = useWorkInjuryCaseOperationsStore((state) => state.setMessageApi);

  useEffect(() => {
    filtersRef.current = {};
    setFilters({});
    filterForm.resetFields();
    setPagination(createInitialPagination());
    setCases([]);
    appliedInitialCaseIdRef.current = null;
  }, [filterForm, pageDepartment]);


  const currentPage = pagination.current ?? 1;
  const currentPageSize = pagination.pageSize ?? DEFAULT_PAGE_SIZE;
  const canCreateCase = useMemo(
    () =>
      allowCaseCreation && (currentUser ? CASE_CREATE_ALLOWED_ROLES.has(currentUser.role) : false),
    [allowCaseCreation, currentUser]
  );
  const caseTypeOptions = useMemo(
    () =>
      (Object.entries(CASE_TYPE_LABEL_MAP) as Array<[CaseType, string]>).map(([value, label]) => ({
        value,
        label
      })),
    []
  );
  const caseLevelOptions = useMemo(
    () =>
      (Object.entries(CASE_LEVEL_LABEL_MAP) as Array<[CaseLevel, string]>).map(([value, label]) => ({
        value,
        label
      })),
    []
  );
  const caseStatusSelectOptions = useMemo(
    () =>
      CASE_STATUS_OPTIONS.map((value) => ({
        value,
        label: CASE_STATUS_LABELS[value]
      })),
    []
  );
  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        filters.caseType ||
          filters.caseLevel ||
          filters.caseStatus ||
          filters.caseId ||
          (typeof filters.caseNumber === 'string' && filters.caseNumber.trim().length > 0)
      ),
    [filters]
  );

  const loadCases = useCallback(async (page = 1, pageSize = DEFAULT_PAGE_SIZE, overrideFilters?: CaseFilters) => {
    setLoading(true);
    try {
      const appliedFilters = overrideFilters ?? filtersRef.current;
      const response = await fetchCases({
        department: pageDepartment,
        orderBy: 'updatedAt',
        orderDirection: 'desc',
        page,
        pageSize,
        caseNumber: appliedFilters.caseNumber,
        caseType: appliedFilters.caseType,
        caseLevel: appliedFilters.caseLevel,
        caseStatus: appliedFilters.caseStatus,
        caseId: appliedFilters.caseId
      });

      setCases(response.data);
      setPagination((prev) => {
        const existingOptions = new Set(prev?.pageSizeOptions ?? ['10', '20', '30', '50']);
        existingOptions.add(String(response.pagination.pageSize));

        return {
          ...prev,
          current: response.pagination.page,
          pageSize: response.pagination.pageSize,
          total: response.pagination.total,
          pageSizeOptions: Array.from(existingOptions)
            .sort((a, b) => Number(a) - Number(b))
            .map((value) => value.toString()),
          showQuickJumper: prev?.showQuickJumper ?? true,
          showSizeChanger: prev?.showSizeChanger ?? true
        } satisfies TablePaginationConfig;
      });
    } catch (error) {
      const errorMessage = error instanceof ApiError ? error.message : '获取案件列表失败，请稍后重试';
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [message, pageDepartment]);

  useEffect(() => {
    const trimmedCaseId = typeof initialCaseId === 'string' ? initialCaseId.trim() : '';
    if (!trimmedCaseId) {
      return;
    }
    if (appliedInitialCaseIdRef.current === trimmedCaseId) {
      return;
    }
    appliedInitialCaseIdRef.current = trimmedCaseId;

    const nextFilters: CaseFilters = {
      ...filtersRef.current,
      caseId: trimmedCaseId
    };

    filtersRef.current = nextFilters;
    setFilters(nextFilters);
    filterForm.resetFields();
    void loadCases(1, DEFAULT_PAGE_SIZE, nextFilters);
  }, [filterForm, initialCaseId, loadCases]);

  useEffect(() => {
    void loadCases(currentPage, currentPageSize);
  }, [loadCases, currentPage, currentPageSize]);

  const handleTableChange = useCallback(
    (nextPagination: TablePaginationConfig) => {
      const nextPage = nextPagination.current ?? 1;
      const nextSize = nextPagination.pageSize ?? DEFAULT_PAGE_SIZE;
      void loadCases(nextPage, nextSize);
    },
    [loadCases]
  );

  const handleFilterSubmit = useCallback(
    (values: CaseFilters) => {
      const trimmedCaseNumber = values.caseNumber?.trim();
      const nextFilters: CaseFilters = {
        caseNumber: trimmedCaseNumber ? trimmedCaseNumber : undefined,
        caseType: values.caseType || undefined,
        caseLevel: values.caseLevel || undefined,
        caseStatus: values.caseStatus || undefined
      };
      filtersRef.current = nextFilters;
      setFilters(nextFilters);
      void loadCases(1, currentPageSize, nextFilters);
    },
    [currentPageSize, loadCases]
  );

  const handleFilterReset = useCallback(() => {
    filterForm.resetFields();
    const nextFilters: CaseFilters = {};
    filtersRef.current = nextFilters;
    setFilters(nextFilters);
    appliedInitialCaseIdRef.current = null;

    if (searchParams?.has('caseId')) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete('caseId');
      const nextQuery = params.toString();
      const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
      router.replace(nextUrl, { scroll: false });
    }

    void loadCases(1, currentPageSize, nextFilters);
  }, [filterForm, currentPageSize, loadCases, pathname, router, searchParams]);

  const openCreateModal = useCallback(() => {
    if (!canCreateCase) {
      return;
    }
    setNewCaseModalOpen(true);
  }, [canCreateCase]);

  const handleCreateCase = useCallback(
    async (values: WorkInjuryCaseFormValues) => {
      if (!canCreateCase) {
        message.error('您没有权限执行此操作');
        return;
      }

      const departmentForCreation = (() => {
        if (!currentUser) {
          return pageDepartment;
        }
        if (currentUser.role === 'super_admin') {
          return pageDepartment;
        }
        return currentUser.department ?? null;
      })();

      if (!departmentForCreation) {
        message.error('当前账号未分配部门，无法创建案件');
        return;
      }

      setCreating(true);
      try {
        const payload = mapFormToCasePayload(values, departmentForCreation);
        await createCaseApi(payload);
        message.success('案件信息已保存');
        setNewCaseModalOpen(false);
        await loadCases(1, currentPageSize);
      } catch (error) {
        const errorMessage = error instanceof ApiError ? error.message : '保存案件失败，请稍后重试';
        message.error(errorMessage);
      } finally {
        setCreating(false);
      }
    },
  [canCreateCase, currentUser, loadCases, message, pageDepartment, currentPageSize]
  );

  const headerAction = useMemo(() => {
    if (!canCreateCase) {
      return null;
    }
    return (
      <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
        添加案件
      </Button>
    );
  }, [canCreateCase, openCreateModal]);

  useDashboardHeaderAction(headerAction);

  useEffect(() => {
    if (!canCreateCase) {
      setNewCaseModalOpen(false);
    }
  }, [canCreateCase]);

  useEffect(() => {
    let cancelled = false;

    if (!currentUser?.id) {
      setVisibleColumnKeys([...defaultColumns]);
      setColumnModalSelection([...defaultColumns]);
      return () => {
        cancelled = true;
      };
    }

    setColumnPreferencesLoading(true);

    void (async () => {
      try {
        const preference = await fetchCaseTablePreferences(tableStorageKey);
        if (cancelled) {
          return;
        }
        const next = sanitizeColumnSelection(preference.visibleColumns, defaultColumns, columnKeySet);
        setVisibleColumnKeys(next);
        setColumnModalSelection(next);
      } catch (error) {
        if (!cancelled) {
          message.error('获取列表字段配置失败，已使用默认配置');
          setVisibleColumnKeys([...defaultColumns]);
          setColumnModalSelection([...defaultColumns]);
        }
      } finally {
        if (!cancelled) {
          setColumnPreferencesLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [columnKeySet, currentUser?.id, defaultColumns, message, tableStorageKey]);

  const handleColumnModalOpen = useCallback(() => {
    if (columnPreferencesLoading) {
      return;
    }
    setColumnModalSelection(visibleColumnKeys);
    setColumnModalOpen(true);
  }, [columnPreferencesLoading, visibleColumnKeys]);

  const handleColumnModalCancel = useCallback(() => {
    setColumnModalOpen(false);
    setColumnModalSelection(visibleColumnKeys);
  }, [visibleColumnKeys]);

  const handleColumnCheckboxChange = useCallback((columnKey: CaseTableColumnKey, checked: boolean) => {
    setColumnModalSelection((prev) => {
      if (checked) {
        if (prev.includes(columnKey)) {
          return prev;
        }
        return [...prev, columnKey];
      }

      if (prev.length <= 1) {
        message.warning('请至少保留一个字段');
        return prev;
      }

      return prev.filter((key) => key !== columnKey);
    });
  }, [message]);

  const handleColumnMove = useCallback((columnKey: CaseTableColumnKey, direction: 'up' | 'down') => {
    setColumnModalSelection((prev) => {
      const index = prev.indexOf(columnKey);
      if (index === -1) {
        return prev;
      }

      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) {
        return prev;
      }

      const next = [...prev];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }, []);

  const columnModalOptionList = useMemo(() => {
    const selectionSet = new Set(columnModalSelection);
    const selected = columnModalSelection
      .map((key) => columnOptions.find((option) => option.key === key))
      .filter((option): option is { key: CaseTableColumnKey; label: string } => Boolean(option))
      .map((option) => ({ ...option, selected: true }));
    const unselected = columnOptions
      .filter((option) => !selectionSet.has(option.key))
      .map((option) => ({ ...option, selected: false }));
    return [...selected, ...unselected];
  }, [columnModalSelection, columnOptions]);

  const handleColumnModalSave = useCallback(async () => {
    const sanitized = sanitizeColumnSelection(columnModalSelection, defaultColumns, columnKeySet);
    if (!sanitized.length) {
      message.warning('请至少选择一个要展示的字段');
      return;
    }

    setColumnModalSaving(true);
    try {
      await updateCaseTablePreferences(tableStorageKey, sanitized);
      setVisibleColumnKeys(sanitized);
      setColumnModalSelection(sanitized);
      setColumnModalOpen(false);
      message.success('列表字段配置已保存');
    } catch (error) {
      const errorMessage = error instanceof ApiError ? error.message : '保存列表字段配置失败，请稍后重试';
      message.error(errorMessage);
    } finally {
      setColumnModalSaving(false);
    }
  }, [columnKeySet, columnModalSelection, defaultColumns, message, tableStorageKey]);

  const canUpdateCaseRecord = useCallback(
    (record: CaseRecord) => {
      if (!currentUser) {
        return false;
      }
      if (currentUser.role === 'super_admin') {
        return true;
      }
      if (currentUser.role === 'admin' || currentUser.role === 'administration') {
        return Boolean(currentUser.department && record.department === currentUser.department);
      }
      if (currentUser.role === 'lawyer') {
        const isAssignedTrialLawyer = (record.hearings ?? []).some(
          (hearing) => hearing.trialLawyerId === currentUser.id
        );
        return record.assignedLawyerId === currentUser.id || isAssignedTrialLawyer;
      }
      if (currentUser.role === 'assistant') {
        return record.assignedAssistantId === currentUser.id || record.assignedSaleId === currentUser.id;
      }
      if (currentUser.role === 'sale') {
        return record.assignedSaleId === currentUser.id;
      }
      return false;
    },
    [currentUser]
  );

  const canUpdateHearingRecord = useCallback((record: CaseRecord) => {
    if (!currentUser) {
        return false;
      }
      if (currentUser.role === 'super_admin') {
        return true;
      }
      if (currentUser.role === 'admin' || currentUser.role === 'lawyer' || currentUser.role === 'assistant'
      ) {
        return Boolean(currentUser.department && record.department === currentUser.department);
      }
      return false;
  }, [currentUser]);

  const canAssignStaffToCase = useCallback(
    (record: CaseRecord) => {
      if (!currentUser) {
        return false;
      }
      if (currentUser.role === 'super_admin') {
        return true;
      }
      if (currentUser.role === 'admin' || currentUser.role === 'administration') {
        return Boolean(currentUser.department && record.department === currentUser.department);
      }
      return false;
    },
    [currentUser]
  );

  const canManageTimeNodesForCase = useCallback(
    (record: CaseRecord) => {
      if (!currentUser || !CASE_TIME_NODE_EDIT_ALLOWED_ROLES.has(currentUser.role as UserRole)) {
        return false;
      }
      if (currentUser.role === 'super_admin') {
        return true;
      }
      if (currentUser.role === 'admin') {
        return Boolean(currentUser.department && record.department === currentUser.department);
      }
      if (currentUser.role === 'lawyer') {
        const isAssignedTrialLawyer = (record.hearings ?? []).some(
          (hearing) => hearing.trialLawyerId === currentUser.id
        );
        return record.assignedLawyerId === currentUser.id || isAssignedTrialLawyer;
      }
      if (currentUser.role === 'assistant') {
        return (
          record.assignedAssistantId === currentUser.id || record.assignedSaleId === currentUser.id
        );
      }
      return false;
    },
    [currentUser]
  );

  const canManageCaseFee = useCallback(
    (record: CaseRecord) => {
      if (!currentUser) {
        return false;
      }
      if (!CASE_FEE_ALLOWED_ROLES.has(currentUser.role as UserRole)) {
        return false;
      }
      if (currentUser.role === 'super_admin') {
        return true;
      }
      if (currentUser.role === 'admin' || currentUser.role === 'administration') {
        return Boolean(currentUser.department && record.department === currentUser.department);
      }
      return false;
    },
    [currentUser]
  );

  const canCreateCollectionRecord = useCallback(
    (record: CaseRecord) => {
      if (!currentUser) {
        return false;
      }
      if (!CASE_COLLECTION_ALLOWED_ROLES.has(currentUser.role as UserRole)) {
        return false;
      }
      if (currentUser.role === 'super_admin') {
        return true;
      }
      if (currentUser.role === 'admin' || currentUser.role === 'administration') {
        return Boolean(currentUser.department && record.department === currentUser.department);
      }
      return false;
    },
    [currentUser]
  );

  const updateCaseInState = useCallback(
    (updated: CaseRecord) => {
      changeLogCacheRef.current.delete(updated.id);
      setCases((prev) => {
        if (!prev.some((item) => item.id === updated.id)) {
          return prev;
        }
        const next = prev.map((item) => (item.id === updated.id ? updated : item));
        return next.sort((a, b) => dayjs(b.updatedAt).valueOf() - dayjs(a.updatedAt).valueOf());
      });
      setCaseModalCase((prev) => (prev && prev.id === updated.id ? updated : prev));
    },
    [setCaseModalCase, setCases]
  );

  const mutateCaseRecord = useCallback(
    async (
      targetCase: CaseRecord,
      mutation: () => Promise<CaseRecord>,
      successMessage?: string
    ) => {
      const updatedRecord = await mutation();
      if (successMessage) {
        message.success(successMessage);
      }
      updateCaseInState(updatedRecord);
      return mapCaseRecordToFormValues(updatedRecord);
    },
  [message, updateCaseInState]
  );

  const buildCaseUpdateMeta = useCallback((record: CaseRecord, fields: string[]): CaseUpdateMeta => {
  const baseSnapshot: Record<string, unknown> = {};
  const source = record as unknown as Record<string, unknown>;
    fields.forEach((field) => {
      baseSnapshot[field] = source[field];
    });

    return {
      baseVersion: record.version,
      baseSnapshot,
      dirtyFields: fields
    } satisfies CaseUpdateMeta;
  }, []);

  const submitCaseUpdate = useCallback(
    async ({
      caseRecord,
      payload,
      dirtyFields,
      successMessage
    }: {
      caseRecord: CaseRecord;
      payload: CasePayload;
      dirtyFields: string[];
      successMessage?: string;
    }) => {
      const meta = buildCaseUpdateMeta(caseRecord, dirtyFields);
      try {
        const updatedRecord = await updateCaseApi(caseRecord.id, { payload, meta });
        updateCaseInState(updatedRecord);
        if (successMessage) {
          message.success(successMessage);
        }
        return updatedRecord;
      } catch (error) {
        if (error instanceof CaseUpdateConflictError) {
          setCaseConflict({
            caseId: caseRecord.id,
            payload,
            meta,
            details: error.details,
            successMessage
          });
          message.warning(error.message);
          return undefined;
        }
        throw error;
      }
    },
    [buildCaseUpdateMeta, message, setCaseConflict, updateCaseInState]
  );

  const handleConflictClose = useCallback(() => {
    if (caseConflictMerging || caseConflictRefreshing) {
      return;
    }
    setCaseConflict(null);
  }, [caseConflictMerging, caseConflictRefreshing]);

  const handleConflictRefresh = useCallback(async () => {
    if (!caseConflict) {
      return;
    }
    setCaseConflictRefreshing(true);
    try {
      const latest = await fetchCaseById(caseConflict.caseId);
      updateCaseInState(latest);
      message.success('已同步最新版本');
      setCaseConflict(null);
    } catch (error) {
      const errorMessage = error instanceof ApiError ? error.message : '同步最新数据失败，请稍后重试';
      message.error(errorMessage);
    } finally {
      setCaseConflictRefreshing(false);
    }
  }, [caseConflict, message, updateCaseInState]);

  const handleConflictMerge = useCallback(async () => {
    if (!caseConflict) {
      return;
    }
    setCaseConflictMerging(true);
    try {
      const mergeMeta: CaseUpdateMeta = {
        ...caseConflict.meta,
        resolveMode: 'merge'
      };
      const updatedRecord = await updateCaseApi(caseConflict.caseId, {
        payload: caseConflict.payload,
        meta: mergeMeta
      });
      updateCaseInState(updatedRecord);
      message.success(caseConflict.successMessage ?? '已合并最新变更');
      setCaseConflict(null);
    } catch (error) {
      if (error instanceof CaseUpdateConflictError) {
        setCaseConflict((previous) => {
          if (!previous) {
            return previous;
          }
          return {
            ...previous,
            meta: {
              ...previous.meta,
              baseVersion: error.details.latestVersion
            },
            details: error.details
          } satisfies CaseConflictState;
        });
        message.warning(error.message);
      } else {
        const errorMessage = error instanceof ApiError ? error.message : '合并失败，请稍后重试';
        message.error(errorMessage);
      }
    } finally {
      setCaseConflictMerging(false);
    }
  }, [caseConflict, message, updateCaseInState]);

  useEffect(() => {
    setMessageApi(message);
    return () => {
      setMessageApi(null);
    };
  }, [message, setMessageApi]);

  useEffect(() => {
    registerCaseUpdater(updateCaseInState);
    return () => {
      registerCaseUpdater(() => {});
    };
  }, [registerCaseUpdater, updateCaseInState]);

  const openCaseDetailModal = useCallback(
    async (
      caseId: string,
      options?: { mode?: 'view' | 'update'; tab?: WorkInjuryCaseTabKey }
    ) => {
      const { mode = 'view', tab } = options ?? {};
  const initialTab = tab && visibleModalTabSet.has(tab) ? tab : undefined;
      const hide = message.loading('正在加载案件详情...', 0);
      try {
        setCaseModalCanEdit(false);
        setCaseModalInitialTab(initialTab);
        const detail = await fetchCaseById(caseId);
        setCaseModalCase(detail);
        const editable = canUpdateCaseRecord(detail);
        setCaseModalCanEdit(editable);
        const nextMode = mode === 'update' && !editable ? 'view' : mode;
        setCaseModalMode(nextMode);
        setCaseModalOpen(true);
      } catch (error) {
        const errorMessage = error instanceof ApiError ? error.message : '获取案件详情失败，请稍后重试';
        message.error(errorMessage);
      } finally {
        if (typeof hide === 'function') {
          hide();
        } else {
          void message.destroy();
        }
      }
    },
    [canUpdateCaseRecord, message, visibleModalTabSet]
  );

  useEffect(() => {
    registerCaseDetailLauncher(async (caseId, options) => {
      await openCaseDetailModal(caseId, {
        mode: options?.mode,
        tab: options?.tab as WorkInjuryCaseTabKey | undefined
      });
    });
    return () => {
      registerCaseDetailLauncher(null);
    };
  }, [registerCaseDetailLauncher, openCaseDetailModal]);

  const handleCaseModalAssignmentSave = useCallback(
    async (values: AssignStaffFormValues) => {
      if (!caseModalCase) {
        message.error('未找到案件信息');
        return undefined;
      }
      try {
        const updated = await submitCaseUpdate({
          caseRecord: caseModalCase,
          payload: {
            caseType: caseModalCase.caseType,
            caseLevel: caseModalCase.caseLevel,
            assignedLawyerId: values.assignedLawyerId ?? null,
            assignedAssistantId: values.assignedAssistantId ?? null
          },
          dirtyFields: ['assignedLawyerId', 'assignedAssistantId'],
          successMessage: '人员分配已更新'
        });
        return updated ? mapCaseRecordToFormValues(updated) : undefined;
      } catch (error) {
        const errorMessage = error instanceof ApiError ? error.message : '更新人员分配失败，请稍后重试';
        message.error(errorMessage);
        return undefined;
      }
    },
  [caseModalCase, message, submitCaseUpdate]
  );

  const handleCaseModalStatusSave = useCallback(
    async (values: CaseStatusFormValues) => {
      if (!caseModalCase) {
        message.error('未找到案件信息');
        return undefined;
      }
      try {
        const updated = await submitCaseUpdate({
          caseRecord: caseModalCase,
          payload: {
            caseType: caseModalCase.caseType,
            caseLevel: caseModalCase.caseLevel,
            caseStatus: values.caseStatus,
            closedReason: values.caseStatus === 'closed' ? values.closedReason ?? null : null,
            voidReason: values.caseStatus === 'void' ? values.voidReason ?? null : null
          },
          dirtyFields: ['caseStatus', 'closedReason', 'voidReason'],
          successMessage: '案件状态已更新'
        });
        return updated ? mapCaseRecordToFormValues(updated) : undefined;
      } catch (error) {
        const errorMessage = error instanceof ApiError ? error.message : '更新案件状态失败，请稍后重试';
        message.error(errorMessage);
        return undefined;
      }
    },
  [caseModalCase, message, submitCaseUpdate]
  );

  const handleCaseModalHearingAdd = useCallback(
    async (values: HearingFormValues) => {
      if (!caseModalCase) {
        message.error('未找到案件信息');
        return undefined;
      }
      try {
        const hearingPayload = {
          trialLawyerId: toNullableText(values.trialLawyerId ?? null),
          hearingTime: formatDateTimeValue(values.hearingTime ?? null),
          hearingLocation: toNullableText(values.hearingLocation ?? null),
          tribunal: toNullableText(values.tribunal ?? null),
          judge: toNullableText(values.judge ?? null),
          caseNumber: toNullableText(values.caseNumber ?? null),
          contactPhone: toNullableText(values.contactPhone ?? null),
          trialStage: values.trialStage ?? null,
          hearingResult: toNullableText(values.hearingResult ?? null)
        } satisfies NonNullable<CasePayload['hearings']>[number];

        const existingHearings = (caseModalCase.hearings ?? []).map(mapHearingRecordToInput);
        const deduplicatedHearings = hearingPayload.trialStage
          ? existingHearings.filter(item => item.trialStage !== hearingPayload.trialStage)
          : existingHearings;
        const nextHearings = sortHearingInputs([...deduplicatedHearings, hearingPayload]);

        const updated = await submitCaseUpdate({
          caseRecord: caseModalCase,
          payload: {
            caseType: caseModalCase.caseType,
            caseLevel: caseModalCase.caseLevel,
            hearings: nextHearings
          },
          dirtyFields: ['hearings'],
          successMessage: '庭审信息添加成功'
        });
        return updated ? mapCaseRecordToFormValues(updated) : undefined;
      } catch (error) {
        const errorMessage = error instanceof ApiError ? error.message : '新增庭审信息失败，请稍后重试';
        message.error(errorMessage);
        return undefined;
      }
    },
  [caseModalCase, message, submitCaseUpdate]
  );

  const handleCaseModalFollowUpAdd = useCallback(
    async (values: { occurredOn: Dayjs; note: string }) => {
      if (!caseModalCase) {
        message.error('未找到案件信息');
        return undefined;
      }
      const occurredOn = formatDayValue(values.occurredOn ?? null);
      if (!occurredOn) {
        message.error('请选择有效的发生日期');
        return undefined;
      }
      try {
        const existingTimeline = mapTimelineRecordsToInputs(caseModalCase);
        existingTimeline.push({
          occurredOn,
          note: values.note ?? null,
          followerId: currentUser?.id ?? null
        });
        const updated = await submitCaseUpdate({
          caseRecord: caseModalCase,
          payload: {
            caseType: caseModalCase.caseType,
            caseLevel: caseModalCase.caseLevel,
            timeline: existingTimeline
          },
          dirtyFields: ['timeline'],
          successMessage: '跟进备注已添加'
        });
        return updated ? mapCaseRecordToFormValues(updated) : undefined;
      } catch (error) {
        const errorMessage = error instanceof ApiError ? error.message : '保存跟进备注失败，请稍后重试';
        message.error(errorMessage);
        return undefined;
      }
    },
  [caseModalCase, currentUser, message, submitCaseUpdate]
  );

  const handleCaseModalTimeNodesSave = useCallback(
    async (entries: Array<{ nodeType: CaseTimeNodeType; occurredOn: Dayjs }>) => {
      if (!caseModalCase) {
        message.error('未找到案件信息');
        return undefined;
      }

      const payload = entries.map(item => ({
        nodeType: item.nodeType,
        occurredOn: formatDayValue(item.occurredOn) ?? item.occurredOn.format('YYYY-MM-DD')
      }));

      try {
        const updatedNodes = await updateCaseTimeNodes(caseModalCase.id, payload);
        const updatedRecord: CaseRecord = {
          ...caseModalCase,
          timeNodes: updatedNodes
        };
        updateCaseInState(updatedRecord);
        message.success('时间节点已更新');
        return mapCaseRecordToFormValues(updatedRecord);
      } catch (error) {
        const errorMessage = error instanceof ApiError ? error.message : '更新时间节点失败，请稍后重试';
        message.error(errorMessage);
        return undefined;
      }
    },
  [caseModalCase, message, updateCaseInState]
  );

  const handleCaseModalCollectionAdd = useCallback(
    async (values: { amount: number; receivedAt: Dayjs }) => {
      if (!caseModalCase) {
        message.error('未找到案件信息');
        return undefined;
      }
      const receivedAt = values.receivedAt ? values.receivedAt.format('YYYY-MM-DD') : null;
      if (!receivedAt) {
        message.error('请选择回款日期');
        return undefined;
      }
      try {
        return await mutateCaseRecord(
          caseModalCase,
          async () => {
            await createCaseCollectionApi(caseModalCase.id, {
              amount: values.amount,
              receivedAt
            });
            return fetchCaseById(caseModalCase.id);
          },
          '回款记录已添加'
        );
      } catch (error) {
        const errorMessage = error instanceof ApiError ? error.message : '新增回款记录失败，请稍后重试';
        message.error(errorMessage);
        return undefined;
      }
    },
  [caseModalCase, message, mutateCaseRecord]
  );

  const handleCaseModalFeeUpdate = useCallback(
    async (values: FeeFormValues) => {
      if (!caseModalCase) {
        message.error('未找到案件信息');
        return undefined;
      }
      try {
        const updated = await submitCaseUpdate({
          caseRecord: caseModalCase,
          payload: {
            caseType: caseModalCase.caseType,
            caseLevel: caseModalCase.caseLevel,
            salesCommission: values.salesCommission ?? null,
            handlingFee: values.handlingFee ?? null
          },
          dirtyFields: ['salesCommission', 'handlingFee'],
          successMessage: '费用信息已更新'
        });
        return updated ? mapCaseRecordToFormValues(updated) : undefined;
      } catch (error) {
        const errorMessage = error instanceof ApiError ? error.message : '更新费用信息失败，请稍后重试';
        message.error(errorMessage);
        return undefined;
      }
    },
  [caseModalCase, message, submitCaseUpdate]
  );

  const handleCaseModalBasicInfoSave = useCallback(
    async (basicInfo: WorkInjuryCaseFormValues['basicInfo']) => {
      if (!caseModalCase) {
        message.error('未找到案件信息');
        return undefined;
      }
      const basic = basicInfo ?? {};
      try {
        const updated = await submitCaseUpdate({
          caseRecord: caseModalCase,
          payload: {
            caseType: (basic.caseType ?? caseModalCase.caseType) as CasePayload['caseType'],
            caseLevel: (basic.caseLevel ?? caseModalCase.caseLevel) as CasePayload['caseLevel'],
            provinceCity: toNullableText(basic.provinceCity ?? null),
            targetAmount: basic.targetAmount ?? null,
            feeStandard: toNullableText(basic.feeStandard ?? null),
            agencyFeeEstimate: basic.agencyFeeEstimate ?? null,
            dataSource: toNullableText(basic.dataSource ?? null),
            hasContract: basic.hasContract ?? null,
            hasSocialSecurity: basic.hasSocialSecurity ?? null,
            entryDate: formatDayValue(basic.entryDate ?? null),
            injuryLocation: toNullableText(basic.injuryLocation ?? null),
            injurySeverity: toNullableText(basic.injurySeverity ?? null),
            injuryCause: toNullableText(basic.injuryCause ?? null),
            workInjuryCertified: basic.workInjuryCertified ?? null,
            monthlySalary: basic.monthlySalary ?? null,
            appraisalLevel: toNullableText(basic.appraisalLevel ?? null),
            appraisalEstimate: toNullableText(basic.appraisalEstimate ?? null),
            existingEvidence: toNullableText(basic.existingEvidence ?? null),
            customerCooperative: basic.customerCooperative ?? null,
            witnessCooperative: basic.witnessCooperative ?? null,
            remark: toNullableText(basic.remark ?? null),
            department: caseModalCase.department ?? null
          },
          dirtyFields: [
            'caseType',
            'caseLevel',
            'provinceCity',
            'targetAmount',
            'feeStandard',
            'agencyFeeEstimate',
            'dataSource',
            'hasContract',
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
            'department'
          ],
          successMessage: '基本信息已保存'
        });
        return updated ? mapCaseRecordToFormValues(updated) : undefined;
      } catch (error) {
        const errorMessage = error instanceof ApiError ? error.message : '保存基本信息失败，请稍后重试';
        message.error(errorMessage);
        return undefined;
      }
    },
  [caseModalCase, message, submitCaseUpdate]
  );

  const handleCaseModalPartiesSave = useCallback(
    async (parties: WorkInjuryCaseFormValues['parties']) => {
      if (!caseModalCase) {
        message.error('未找到案件信息');
        return undefined;
      }
      const participants = mapParticipants(parties);
      if (!participants?.claimants || participants.claimants.length === 0) {
        message.error('请至少添加一位当事人');
        return undefined;
      }
      try {
        const updated = await submitCaseUpdate({
          caseRecord: caseModalCase,
          payload: {
            caseType: caseModalCase.caseType,
            caseLevel: caseModalCase.caseLevel,
            participants
          },
          dirtyFields: ['participants'],
          successMessage: '当事人信息已保存'
        });
        return updated ? mapCaseRecordToFormValues(updated) : undefined;
      } catch (error) {
        const errorMessage = error instanceof ApiError ? error.message : '保存当事人信息失败，请稍后重试';
        message.error(errorMessage);
        return undefined;
      }
    },
  [caseModalCase, message, submitCaseUpdate]
  );

  const handleLoadAssignableStaff = useCallback(() => {
    const department = caseModalCase?.department ?? currentUser?.department ?? null;
    return fetchAssignableStaff(department ? { department } : undefined);
  }, [caseModalCase, currentUser]);

  const handleLoadChangeLogs = useCallback(async () => {
    if (!caseModalCase) {
      return [] as CaseChangeLog[];
    }
    const cached = changeLogCacheRef.current.get(caseModalCase.id);
    if (cached) {
      return cached;
    }
    const logs = await fetchCaseChangeLogs(caseModalCase.id);
    changeLogCacheRef.current.set(caseModalCase.id, logs);
    return logs;
  }, [caseModalCase]);

  const handleCaseTitleClick = useCallback(
    (record: CaseRecord) => {
      void openCaseDetailModal(record.id);
    },
    [openCaseDetailModal]
  );

  const handleOpenTimeNode = useCallback((record: CaseRecord) => {
    setTimeNodeTarget(record);
    setTimeNodeSaving(false);
    setTimeNodeModalOpen(true);
  }, []);

  const handleTimeNodeCancel = useCallback(() => {
    setTimeNodeModalOpen(false);
    setTimeNodeTarget(null);
    setTimeNodeSaving(false);
  }, []);

  const handleTimeNodeSubmit = useCallback(
    async ({ nodeType, occurredOn }: { nodeType: CaseTimeNodeType; occurredOn: Dayjs }) => {
      if (!timeNodeTarget) {
        message.error('未找到案件信息');
        return;
      }

      const targetCase = timeNodeTarget;
      const occurredOnText = formatDayValue(occurredOn) ?? occurredOn.format('YYYY-MM-DD');
      if (!occurredOnText) {
        message.error('请选择发生日期');
        return;
      }

      setTimeNodeSaving(true);
      try {
        const updatedNodes = await updateCaseTimeNodes(targetCase.id, [
          {
            nodeType,
            occurredOn: occurredOnText
          }
        ]);
        updateCaseInState({ ...targetCase, timeNodes: updatedNodes });
        message.success('时间节点已新增');
        setTimeNodeModalOpen(false);
        setTimeNodeTarget(null);
      } catch (error) {
        const errorMessage = error instanceof ApiError ? error.message : '新增时间节点失败，请稍后重试';
        message.error(errorMessage);
      } finally {
        setTimeNodeSaving(false);
      }
    },
  [message, timeNodeTarget, updateCaseInState]
  );

  const closeCaseModal = useCallback(() => {
    setCaseModalOpen(false);
    setCaseModalCase(null);
    setCaseModalMode('view');
    setCaseModalCanEdit(false);
    setCaseModalInitialTab(undefined);
  }, []);

  const handleCaseModalEdit = useCallback(() => {
    if (!caseModalCanEdit) {
      return;
    }
    setCaseModalMode('update');
  }, [caseModalCanEdit]);

  const handleCaseModalView = useCallback(() => {
    setCaseModalMode('view');
  }, []);

  const caseModalInitialValues = useMemo(
    () => (caseModalCase ? mapCaseRecordToFormValues(caseModalCase) : undefined),
    [caseModalCase]
  );

  const caseModalPermissions = useMemo(
    () => ({
      canEditAssignments:
        modalOperationFlags.assignment && (caseModalCase ? canAssignStaffToCase(caseModalCase) : false),
      canUpdateStatus:
        modalOperationFlags.status && (caseModalCase ? canUpdateCaseRecord(caseModalCase) : false),
      canAddHearings:
        modalOperationFlags.hearing && (caseModalCase ? canUpdateHearingRecord(caseModalCase) : false),
      canAddFollowUps: modalOperationFlags.followUp && Boolean(caseModalCase),
      canAddCollections:
        modalOperationFlags.collection && (caseModalCase ? canCreateCollectionRecord(caseModalCase) : false),
      canUpdateFees:
        modalOperationFlags.fees && (caseModalCase ? canManageCaseFee(caseModalCase) : false),
      canViewChangeLogs: modalOperationFlags.changeLog && Boolean(caseModalCase),
      canManageTimeNodes:
        modalOperationFlags.timeNodes && (caseModalCase ? canManageTimeNodesForCase(caseModalCase) : false)
    }),
    [
      caseModalCase,
      canAssignStaffToCase,
      canCreateCollectionRecord,
      canManageCaseFee,
      canManageTimeNodesForCase,
      canUpdateCaseRecord,
      canUpdateHearingRecord,
      modalOperationFlags
    ]
  );

  const formatTableDate = useCallback((value?: string | null, format = 'YYYY-MM-DD') => {
    if (!value) {
      return '—';
    }
    const parsed = dayjs(value);
    if (!parsed.isValid()) {
      return '—';
    }
    return parsed.format(format);
  }, []);

  const formatCurrencyCell = useCallback((value?: string | null) => {
    if (!value) {
      return '—';
    }
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      return numeric.toLocaleString('zh-CN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      });
    }
    return value;
  }, []);

  const formatStringListCell = useCallback((list?: string[] | null) => {
    const sanitized = sanitizeStringList(list ?? []);
    return sanitized.length ? sanitized.join('、') : '—';
  }, []);

  const columnDefinitions = useMemo<Record<CaseTableColumnKey, ColumnsType<CaseRecord>[number]>>(
    () => ({
      caseNumber: {
        title: columnLabelMap.caseNumber ?? CASE_TABLE_COLUMN_LABELS.caseNumber,
        dataIndex: 'caseNumber',
        key: 'caseNumber',
        render: (_, record) => {
          const displayText = getPreferredCaseNumber(record) ?? '查看';
          return (
            <Button
              type="link"
              style={{ padding: 0, height: 'auto' }}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                handleCaseTitleClick(record);
              }}
            >
              {displayText}
            </Button>
          );
        }
      },
      caseStatus: {
        title: columnLabelMap.caseStatus ?? CASE_TABLE_COLUMN_LABELS.caseStatus,
        dataIndex: 'caseStatus',
        key: 'caseStatus',
        render: (value: CaseStatus | null) =>
          value ? (
            <Tag color={CASE_STATUS_COLOR_MAP[value] ?? 'blue'}>
              {CASE_STATUS_LABELS[value] ?? value}
            </Tag>
          ) : (
            '—'
          )
      },
      caseType: {
        title: columnLabelMap.caseType ?? CASE_TABLE_COLUMN_LABELS.caseType,
        dataIndex: 'caseType',
        key: 'caseType',
        render: (value: CaseType) => CASE_TYPE_LABEL_MAP[value] ?? value
      },
      caseLevel: {
        title: columnLabelMap.caseLevel ?? CASE_TABLE_COLUMN_LABELS.caseLevel,
        dataIndex: 'caseLevel',
        key: 'caseLevel',
        render: (value: CaseLevel) => CASE_LEVEL_LABEL_MAP[value] ?? value
      },
      claimantNames: {
        title: columnLabelMap.claimantNames ?? CASE_TABLE_COLUMN_LABELS.claimantNames,
        dataIndex: 'participants',
        key: 'claimantNames',
        render: (_value: CaseParticipantsGroup | undefined, record) => {
          const names = collectNonOpponentPartyNames(record.participants);
          return names.length ? names.join('、') : '—';
        }
      },
      respondentNames: {
        title: columnLabelMap.respondentNames ?? CASE_TABLE_COLUMN_LABELS.respondentNames,
        dataIndex: 'participants',
        key: 'respondentNames',
        render: (_value: CaseParticipantsGroup | undefined, record) => {
          const names = collectOpponentPartyNames(record.participants);
          return names.length ? names.join('、') : '—';
        }
      },
      provinceCity: {
        title: columnLabelMap.provinceCity ?? CASE_TABLE_COLUMN_LABELS.provinceCity,
        dataIndex: 'provinceCity',
        key: 'provinceCity',
        render: (value: string | null) => value ?? '—'
      },
      assignedLawyerName: {
        title: columnLabelMap.assignedLawyerName ?? CASE_TABLE_COLUMN_LABELS.assignedLawyerName,
        dataIndex: 'assignedLawyerName',
        key: 'assignedLawyerName',
        render: (value: string | null, record) => value ?? record.assignedLawyerName ?? '—'
      },
      assignedAssistantName: {
        title: columnLabelMap.assignedAssistantName ?? CASE_TABLE_COLUMN_LABELS.assignedAssistantName,
        dataIndex: 'assignedAssistantName',
        key: 'assignedAssistantName',
        render: (value: string | null, record) => value ?? record.assignedAssistantName ?? '—'
      },
      assignedSaleName: {
        title: columnLabelMap.assignedSaleName ?? CASE_TABLE_COLUMN_LABELS.assignedSaleName,
        dataIndex: 'assignedSaleName',
        key: 'assignedSaleName',
        render: (value: string | null, record) => value ?? record.assignedSaleName ?? '—'
      },
      contractDate: {
        title: columnLabelMap.contractDate ?? CASE_TABLE_COLUMN_LABELS.contractDate,
        dataIndex: 'contractDate',
        key: 'contractDate',
        render: (value: string | null) => formatTableDate(value)
      },
      clueDate: {
        title: columnLabelMap.clueDate ?? CASE_TABLE_COLUMN_LABELS.clueDate,
        dataIndex: 'clueDate',
        key: 'clueDate',
        render: (value: string | null) => formatTableDate(value)
      },
      targetAmount: {
        title: columnLabelMap.targetAmount ?? CASE_TABLE_COLUMN_LABELS.targetAmount,
        dataIndex: 'targetAmount',
        key: 'targetAmount',
        render: (value: string | null) => formatCurrencyCell(value)
      },
      contractForm: {
        title: columnLabelMap.contractForm ?? CASE_TABLE_COLUMN_LABELS.contractForm,
        dataIndex: 'contractForm',
        key: 'contractForm',
        render: (value: ContractFormType | null) => (value ? CONTRACT_FORM_LABELS[value] ?? value : '—')
      },
      insuranceRiskLevel: {
        title: columnLabelMap.insuranceRiskLevel ?? CASE_TABLE_COLUMN_LABELS.insuranceRiskLevel,
        dataIndex: 'insuranceRiskLevel',
        key: 'insuranceRiskLevel',
        render: (value: CaseLevel | null) => (value ? CASE_LEVEL_LABEL_MAP[value] ?? value : '—')
      },
      insuranceTypes: {
        title: columnLabelMap.insuranceTypes ?? CASE_TABLE_COLUMN_LABELS.insuranceTypes,
        dataIndex: 'insuranceTypes',
        key: 'insuranceTypes',
        render: (_value: string[] | undefined, record) => formatStringListCell(record.insuranceTypes)
      },
      dataSource: {
        title: columnLabelMap.dataSource ?? CASE_TABLE_COLUMN_LABELS.dataSource,
        dataIndex: 'dataSource',
        key: 'dataSource',
        render: (value: string | null) => (value ? value : '—')
      },
      entryDate: {
        title: columnLabelMap.entryDate ?? CASE_TABLE_COLUMN_LABELS.entryDate,
        dataIndex: 'entryDate',
        key: 'entryDate',
        render: (value: string | null) => formatTableDate(value)
      },
      createdAt: {
        title: columnLabelMap.createdAt ?? CASE_TABLE_COLUMN_LABELS.createdAt,
        dataIndex: 'createdAt',
        key: 'createdAt',
        render: (value: string | null) => formatTableDate(value, 'YYYY-MM-DD')
      },
      updatedAt: {
        title: columnLabelMap.updatedAt ?? CASE_TABLE_COLUMN_LABELS.updatedAt,
        dataIndex: 'updatedAt',
        key: 'updatedAt',
        render: (value: string | null) => formatTableDate(value, 'YYYY-MM-DD')
      }
    }),
    [
      columnLabelMap,
      formatCurrencyCell,
      formatStringListCell,
      formatTableDate,
      handleCaseTitleClick
    ]
  );

  const actionColumn = useMemo<ColumnsType<CaseRecord>[number]>(
    () => ({
      title: '操作',
      key: 'actions',
      align: 'center',
      render: (_, record) => {
        const canManageTimeNodes = canManageTimeNodesForCase(record);
        const canEditStatus = canUpdateCaseRecord(record);
        const items: MenuProps['items'] = [];

        if (enabledTableActions.has('update-status') && canEditStatus) {
          items.push({
            key: 'update-status',
            label: '更新案件状态'
          });
        }

        if (enabledTableActions.has('add-follow-up')) {
          items.push({
            key: 'add-follow-up',
            label: '新增跟进备注'
          });
        }

        if (enabledTableActions.has('add-time-node') && canManageTimeNodes) {
          items.push({
            key: 'add-time-node',
            label: '新增时间节点'
          });
        }

        if (!items.length) {
          return null;
        }

        const menu: MenuProps = {
          items,
          onClick: ({ key }) => {
            if (key === 'add-time-node') {
              if (enabledTableActions.has('add-time-node') && canManageTimeNodes) {
                handleOpenTimeNode(record);
              }
              return;
            }
            if (key === 'update-status') {
              if (enabledTableActions.has('update-status') && canEditStatus) {
                openStatusModal(record);
              } else {
                message.error('您没有权限更新案件状态');
              }
              return;
            }
            if (key === 'add-follow-up' && enabledTableActions.has('add-follow-up')) {
              openFollowUpModal(record);
            }
          }
        };

        return (
          <Dropdown trigger={['click']} menu={menu} placement="bottomRight">
            <Button
              type="text"
              shape="circle"
              icon={<EllipsisOutlined />}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            />
          </Dropdown>
        );
      }
    }),
  [canManageTimeNodesForCase, canUpdateCaseRecord, enabledTableActions, handleOpenTimeNode, message, openFollowUpModal, openStatusModal]
  );

  const tableColumns = useMemo<ColumnsType<CaseRecord>>(() => {
    const dynamicColumns = visibleColumnKeys
      .map((key) => columnDefinitions[key])
      .filter((definition): definition is ColumnsType<CaseRecord>[number] => Boolean(definition));

    return [...dynamicColumns, actionColumn];
  }, [visibleColumnKeys, columnDefinitions, actionColumn]);

  return (
    <>
      <CaseConflictModal
        open={Boolean(caseConflict)}
        details={caseConflict?.details ?? null}
        onCancel={handleConflictClose}
        onRefresh={handleConflictRefresh}
        onMerge={caseConflict?.details.type === 'mergeable' ? handleConflictMerge : undefined}
        refreshing={caseConflictRefreshing}
        merging={caseConflictMerging}
      />
      <Space direction="vertical" size={24} style={{ width: '100%' }}>
        <Card>
          <Form
            form={filterForm}
            layout="inline"
            onFinish={handleFilterSubmit}
            style={{ rowGap: 16 }}
          >
            {shouldShowCaseNumberFilter ? (
              <Form.Item label="案号" name="caseNumber">
                <Input allowClear placeholder="输入案号关键字" style={{ minWidth: 200 }} />
              </Form.Item>
            ) : null}
            {shouldShowCaseTypeFilter ? (
              <Form.Item label="案件类型" name="caseType">
                <Select
                  allowClear
                  placeholder="全部类型"
                  options={caseTypeOptions}
                  style={{ minWidth: 160 }}
                />
              </Form.Item>
            ) : null}
            {shouldShowCaseLevelFilter ? (
              <Form.Item label="案件级别" name="caseLevel">
                <Select
                  allowClear
                  placeholder="全部级别"
                  options={caseLevelOptions}
                  style={{ minWidth: 160 }}
                />
              </Form.Item>
            ) : null}
            {shouldShowCaseStatusFilter ? (
              <Form.Item label="案件状态" name="caseStatus">
                <Select
                  allowClear
                  placeholder="全部状态"
                  options={caseStatusSelectOptions}
                  style={{ minWidth: 160 }}
                />
              </Form.Item>
            ) : null}
            <Form.Item>
              <Button type="primary" htmlType="submit">
                搜索
              </Button>
            </Form.Item>
            <Form.Item>
              <Button onClick={handleFilterReset} disabled={!hasActiveFilters}>
                重置
              </Button>
            </Form.Item>
          </Form>
        </Card>

        <Card
          title={<Typography.Text strong>案件列表</Typography.Text>}
          extra={
            <Button
              icon={<SettingOutlined />}
              onClick={handleColumnModalOpen}
              disabled={columnPreferencesLoading}
            >
              列设置
            </Button>
          }
          styles={{ body: { padding: 0 } }}
        >
          <Table
            rowKey="id"
            dataSource={cases}
            columns={tableColumns}
            loading={loading || columnPreferencesLoading}
            pagination={pagination}
            onChange={handleTableChange}
          />
        </Card>

        <Modal
          title="列表字段设置"
          open={columnModalOpen}
          onCancel={handleColumnModalCancel}
          onOk={handleColumnModalSave}
          okText="保存"
          cancelText="取消"
          confirmLoading={columnModalSaving}
          destroyOnHidden
          maskClosable={false}
          okButtonProps={{ disabled: columnModalSelection.length === 0 }}
        >
          <Typography.Paragraph type="secondary" style={{ marginBottom: 16 }}>
            勾选需要展示的字段，并使用上下箭头调整显示顺序。
          </Typography.Paragraph>
          <List
            dataSource={columnModalOptionList}
            renderItem={(item) => {
              const selectionIndex = columnModalSelection.indexOf(item.key);
              const isSelected = selectionIndex !== -1;
              const disableUncheck = isSelected && columnModalSelection.length <= 1;
              const canMoveUp = isSelected && selectionIndex > 0;
              const canMoveDown = isSelected && selectionIndex < columnModalSelection.length - 1;

              return (
                <List.Item
                  key={item.key}
                  actions={[
                    <Tooltip key="move-up" title={canMoveUp ? '上移' : '无法上移'}>
                      <Button
                        type="text"
                        size="small"
                        icon={<ArrowUpOutlined />}
                        disabled={!canMoveUp}
                        onClick={() => handleColumnMove(item.key, 'up')}
                      />
                    </Tooltip>,
                    <Tooltip key="move-down" title={canMoveDown ? '下移' : '无法下移'}>
                      <Button
                        type="text"
                        size="small"
                        icon={<ArrowDownOutlined />}
                        disabled={!canMoveDown}
                        onClick={() => handleColumnMove(item.key, 'down')}
                      />
                    </Tooltip>
                  ]}
                >
                  <Checkbox
                    checked={isSelected}
                    disabled={disableUncheck}
                    onChange={(event) => handleColumnCheckboxChange(item.key, event.target.checked)}
                  >
                    {item.label}
                  </Checkbox>
                </List.Item>
              );
            }}
          />
        </Modal>

        {canCreateCase ? (
          <WorkInjuryCaseModal
            open={newCaseModalOpen}
            department={pageDepartment}
            onCancel={() => setNewCaseModalOpen(false)}
            onSubmit={handleCreateCase}
            confirmLoading={creating}
            visibleTabs={visibleModalTabs}
            editableTabs={editableModalTabsArray}
          />
        ) : null}

        <WorkInjuryCaseModal
          open={caseModalOpen}
          department={pageDepartment}
          mode={caseModalMode}
          initialValues={caseModalInitialValues}
          initialActiveTab={caseModalInitialTab}
          allowEdit={caseModalCanEdit}
          visibleTabs={visibleModalTabs}
          editableTabs={editableModalTabsArray}
          onRequestEdit={handleCaseModalEdit}
          onRequestView={handleCaseModalView}
          onCancel={closeCaseModal}
          onSaveBasicInfo={caseModalMode === 'update' ? handleCaseModalBasicInfoSave : undefined}
          onSaveParties={caseModalMode === 'update' ? handleCaseModalPartiesSave : undefined}
          onSaveAssignment={
            modalOperationFlags.assignment ? handleCaseModalAssignmentSave : undefined
          }
          onSaveCaseStatus={modalOperationFlags.status ? handleCaseModalStatusSave : undefined}
          onAddHearing={modalOperationFlags.hearing ? handleCaseModalHearingAdd : undefined}
          onAddFollowUp={modalOperationFlags.followUp ? handleCaseModalFollowUpAdd : undefined}
          onAddCollection={
            modalOperationFlags.collection ? handleCaseModalCollectionAdd : undefined
          }
          onUpdateFees={modalOperationFlags.fees ? handleCaseModalFeeUpdate : undefined}
          onSaveTimeNodes={modalOperationFlags.timeNodes ? handleCaseModalTimeNodesSave : undefined}
          onLoadAssignableStaff={caseModalCase ? handleLoadAssignableStaff : undefined}
          onLoadChangeLogs={
            caseModalCase && modalOperationFlags.changeLog ? handleLoadChangeLogs : undefined
          }
          canEditAssignments={caseModalPermissions.canEditAssignments}
          canUpdateStatus={caseModalPermissions.canUpdateStatus}
          canAddHearings={caseModalPermissions.canAddHearings}
          canAddFollowUps={caseModalPermissions.canAddFollowUps}
          canAddCollections={caseModalPermissions.canAddCollections}
          canUpdateFees={caseModalPermissions.canUpdateFees}
          canViewChangeLogs={caseModalPermissions.canViewChangeLogs}
          canManageTimeNodes={caseModalPermissions.canManageTimeNodes}
        />

        <UpdateStatusModal />
        <FollowUpModal />
        <TimeNodeModal
          open={timeNodeModalOpen}
          caseTitle={timeNodeTarget ? buildCaseTitle(timeNodeTarget) : undefined}
          nodeTypes={timeNodeTarget?.timeNodes}
          department={pageDepartment}
          confirmLoading={timeNodeSaving}
          onCancel={handleTimeNodeCancel}
          onSubmit={handleTimeNodeSubmit}
        />
      </Space>
    </>
  );
}
