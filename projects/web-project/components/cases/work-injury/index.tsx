import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import dayjs, { type Dayjs } from 'dayjs';
import { Button, Card, Dropdown, Form, Select, Space, Table, Tag, message } from 'antd';
import type { ColumnsType, TablePaginationConfig } from 'antd/es/table';
import type { MenuProps } from 'antd';
import { EllipsisOutlined, PlusOutlined } from '@ant-design/icons';

import WorkInjuryCaseModal, { type WorkInjuryCaseFormValues } from './modal';
import AssignStaffModal, { type AssignStaffFormValues } from './operations/AssignStaffModal';
import HearingModal, { type HearingFormValues } from './operations/HearingModal';
import FollowUpModal, { type FollowUpFormValues } from './operations/FollowUpModal';
import UpdateStatusModal, { type UpdateStatusFormValues } from './operations/UpdateStatusModal';
import CaseChangeLogModal from './operations/CaseChangeLogModal';
import CaseCollectionModal from './operations/CaseCollectionModal';
import CaseFeeModal from './operations/CaseFeeModal';
import { useDashboardHeaderAction } from '@/app/(dashboard)/header-context';
import { ApiError } from '@/lib/api-client';
import { useSessionStore } from '@/lib/stores/session-store';
import {
  createCase as createCaseApi,
  createCaseCollection as createCaseCollectionApi,
  fetchAssignableStaff,
  fetchCaseChangeLogs,
  fetchCaseById,
  fetchCases,
  type CaseHearingRecord,
  type CaseParticipantInput,
  type CaseParticipantsInput,
  type CaseParticipant,
  type CasePayload,
  type CaseRecord,
  type CaseStatus,
  type CaseLevel,
  type CaseTimelineInput,
  type TrialStage,
  type CaseType,
  type CaseCollectionInput,
  type CaseChangeLog,
  updateCase as updateCaseApi
} from '@/lib/cases-api';
import type { UserDepartment, UserRole } from '@/lib/users-api';

const DEFAULT_PAGE_SIZE = 10;

const CASE_TYPE_LABEL_MAP: Record<CaseType, string> = {
  work_injury: '工伤',
  personal_injury: '人损',
  other: '其他'
};

const CASE_STATUS_COLOR_MAP: Record<CaseStatus, string> = {
  未结案: 'blue',
  已结案: 'green',
  废单: 'default'
};

const CASE_LEVEL_LABEL_MAP: Record<CaseLevel, string> = {
  A: 'A',
  B: 'B',
  C: 'C'
};

const CASE_STATUS_OPTIONS: CaseStatus[] = ['未结案', '已结案', '废单'];

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

const PAGE_DEPARTMENT: UserDepartment = 'work_injury';

const TRIAL_STAGE_SEQUENCE: TrialStage[] = ['first_instance', 'second_instance', 'retrial'];

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

const getLatestHearing = (hearings: CaseHearingRecord[] = []): CaseHearingRecord | null => {
  const sorted = sortHearings(hearings);
  return sorted.length ? sorted[sorted.length - 1] : null;
};

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

const collectUsedTrialStages = (hearings: CaseHearingRecord[] = []): Set<TrialStage> => {
  const usedStages = new Set<TrialStage>();
  hearings.forEach((item) => {
    if (item.trialStage) {
      usedStages.add(item.trialStage);
    }
  });
  return usedStages;
};

const resolveAvailableTrialStages = (hearings: CaseHearingRecord[] = []): TrialStage[] => {
  const usedStages = collectUsedTrialStages(hearings);
  return TRIAL_STAGE_SEQUENCE.filter((stage, index) => {
    if (usedStages.has(stage)) {
      return false;
    }
    const prerequisites = TRIAL_STAGE_SEQUENCE.slice(0, index);
    return prerequisites.every((requiredStage) => usedStages.has(requiredStage));
  });
};

const resolveDisabledTrialStages = (hearings: CaseHearingRecord[] = []): TrialStage[] => {
  const availableStages = new Set(resolveAvailableTrialStages(hearings));
  return TRIAL_STAGE_SEQUENCE.filter((stage) => !availableStages.has(stage));
};

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
      provinceCity: record.provinceCity ?? undefined,
  targetAmount: record.targetAmount ?? undefined,
      feeStandard: record.feeStandard ?? undefined,
      agencyFeeEstimate: record.agencyFeeEstimate ?? undefined,
      dataSource: record.dataSource ?? undefined,
      hasContract: record.hasContract ?? undefined,
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
      remark: record.remark ?? undefined
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
      collections
    },
    timeline: record.timeline ?? []
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

  const payload: CasePayload = {
    caseType: (basic.caseType ?? 'work_injury') as CasePayload['caseType'],
    caseLevel: (basic.caseLevel ?? 'A') as CasePayload['caseLevel'],
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
    department: department ?? null,
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
  caseType?: CaseType;
  caseLevel?: CaseLevel;
  caseStatus?: CaseStatus;
};

export default function WorkInjuryCasesPage() {
  const [cases, setCases] = useState<CaseRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newCaseModalOpen, setNewCaseModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [assignModalCase, setAssignModalCase] = useState<CaseRecord | null>(null);
  const [assignSubmitting, setAssignSubmitting] = useState(false);
  const [hearingModalOpen, setHearingModalOpen] = useState(false);
  const [hearingModalCase, setHearingModalCase] = useState<CaseRecord | null>(null);
  const [hearingSubmitting, setHearingSubmitting] = useState(false);
  const [hearingLawyerOptions, setHearingLawyerOptions] = useState<Array<{ value: string; label: string }>>([]);
  const [hearingLawyerLoading, setHearingLawyerLoading] = useState(false);
  const [followUpModalOpen, setFollowUpModalOpen] = useState(false);
  const [followUpModalCase, setFollowUpModalCase] = useState<CaseRecord | null>(null);
  const [followSubmitting, setFollowSubmitting] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusModalCase, setStatusModalCase] = useState<CaseRecord | null>(null);
  const [statusSubmitting, setStatusSubmitting] = useState(false);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [logModalCase, setLogModalCase] = useState<CaseRecord | null>(null);
  const [logModalLoading, setLogModalLoading] = useState(false);
  const [logModalLogs, setLogModalLogs] = useState<CaseChangeLog[]>([]);
  const [feeModalOpen, setFeeModalOpen] = useState(false);
  const [feeModalCase, setFeeModalCase] = useState<CaseRecord | null>(null);
  const [feeModalLoading, setFeeModalLoading] = useState(false);
  const [feeModalSubmitting, setFeeModalSubmitting] = useState(false);
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const [collectionModalCase, setCollectionModalCase] = useState<CaseRecord | null>(null);
  const [collectionSubmitting, setCollectionSubmitting] = useState(false);
  const [caseModalOpen, setCaseModalOpen] = useState(false);
  const [caseModalMode, setCaseModalMode] = useState<'view' | 'update'>('view');
  const [caseModalCase, setCaseModalCase] = useState<CaseRecord | null>(null);
  const [caseModalCanEdit, setCaseModalCanEdit] = useState(false);
  const [caseModalSubmitting, setCaseModalSubmitting] = useState(false);
  const [pagination, setPagination] = useState<TablePaginationConfig>({
    current: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
    showQuickJumper: true,
    showSizeChanger: true,
    pageSizeOptions: ['10', '20', '30', '50']
  });
  const [filterForm] = Form.useForm<CaseFilters>();
  const filtersRef = useRef<CaseFilters>({});
  const [filters, setFilters] = useState<CaseFilters>({});
  const changeLogCacheRef = useRef<Map<string, CaseChangeLog[]>>(new Map());
  const currentUser = useSessionStore((state) => state.user);
  const hearingModalDepartment = useMemo<UserDepartment | null>(() => {
    if (hearingModalCase?.department) {
      return hearingModalCase.department;
    }
    if (!currentUser) {
      return PAGE_DEPARTMENT;
    }
    if (currentUser.role === 'super_admin') {
      return PAGE_DEPARTMENT;
    }
    return currentUser.department ?? null;
  }, [hearingModalCase, currentUser]);
  const hearingModalAssignedLawyerId = hearingModalCase?.assignedLawyerId ?? null;
  const hearingModalAssignedLawyerName = hearingModalCase?.assignedLawyerName ?? null;
  const hearingModalLatestHearing = useMemo(
    () => (hearingModalCase ? getLatestHearing(hearingModalCase.hearings ?? []) : null),
    [hearingModalCase]
  );
  const hearingModalLatestTrialLawyerId = hearingModalLatestHearing?.trialLawyerId ?? null;
  const hearingModalLatestTrialLawyerName = hearingModalLatestHearing?.trialLawyerName ?? null;
  const hearingModalAvailableStages = useMemo<TrialStage[]>(() => {
    const hearings = hearingModalCase?.hearings ?? [];
    return resolveAvailableTrialStages(hearings);
  }, [hearingModalCase]);
  const hearingModalDisabledStages = useMemo<TrialStage[]>(() => {
    const hearings = hearingModalCase?.hearings ?? [];
    return resolveDisabledTrialStages(hearings);
  }, [hearingModalCase]);
  const hearingModalNextStage = useMemo<TrialStage | null>(
    () => (hearingModalAvailableStages.length > 0 ? hearingModalAvailableStages[0] : null),
    [hearingModalAvailableStages]
  );

  const currentPage = pagination.current ?? 1;
  const currentPageSize = pagination.pageSize ?? DEFAULT_PAGE_SIZE;
  const canCreateCase = useMemo(
    () => (currentUser ? CASE_CREATE_ALLOWED_ROLES.has(currentUser.role) : false),
    [currentUser]
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
    () => CASE_STATUS_OPTIONS.map((value) => ({ value, label: value })),
    []
  );
  const hasActiveFilters = useMemo(
    () => Boolean(filters.caseType || filters.caseLevel || filters.caseStatus),
    [filters]
  );

  const loadCases = useCallback(async (page = 1, pageSize = DEFAULT_PAGE_SIZE, overrideFilters?: CaseFilters) => {
    setLoading(true);
    try {
      const appliedFilters = overrideFilters ?? filtersRef.current;
      const response = await fetchCases({
        department: PAGE_DEPARTMENT,
        orderBy: 'updatedAt',
        orderDirection: 'desc',
        page,
        pageSize,
        caseType: appliedFilters.caseType,
        caseLevel: appliedFilters.caseLevel,
        caseStatus: appliedFilters.caseStatus
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
  }, []);

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

  const handleFilterChange = useCallback(
    (_changed: Partial<CaseFilters>, allValues: CaseFilters) => {
      const nextFilters: CaseFilters = {
        caseType: allValues.caseType || undefined,
        caseLevel: allValues.caseLevel || undefined,
        caseStatus: allValues.caseStatus || undefined
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
    void loadCases(1, currentPageSize, nextFilters);
  }, [filterForm, currentPageSize, loadCases]);

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
          return PAGE_DEPARTMENT;
        }
        if (currentUser.role === 'super_admin') {
          return PAGE_DEPARTMENT;
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
    [canCreateCase, currentUser, loadCases, currentPageSize]
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
    if (!hearingModalOpen) {
      setHearingLawyerOptions([]);
      setHearingLawyerLoading(false);
      return;
    }

    let cancelled = false;
    setHearingLawyerLoading(true);

    void fetchAssignableStaff(hearingModalDepartment ? { department: hearingModalDepartment } : undefined)
      .then((response) => {
        if (cancelled) {
          return;
        }

        const lawyerOptionMap = new Map<string, string>();
        response.lawyers.forEach((lawyer) => {
          lawyerOptionMap.set(lawyer.id, lawyer.name ?? '未命名律师');
        });

        const ensureOption = (id?: string | null, label?: string | null) => {
          if (!id) {
            return;
          }
          if (!lawyerOptionMap.has(id)) {
            lawyerOptionMap.set(id, label ?? '未命名律师');
          }
        };

        ensureOption(hearingModalLatestTrialLawyerId, hearingModalLatestTrialLawyerName);
        ensureOption(hearingModalAssignedLawyerId, hearingModalAssignedLawyerName);
        if (currentUser?.role === 'lawyer') {
          ensureOption(currentUser.id, currentUser.name ?? '当前律师');
        }

        const nextOptions = Array.from(lawyerOptionMap.entries()).map(([value, label]) => ({ value, label }));
        setHearingLawyerOptions(nextOptions);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        const errorMessage = error instanceof ApiError ? error.message : '获取律师列表失败，请稍后重试';
        message.error(errorMessage);
        setHearingLawyerOptions([]);
      })
      .finally(() => {
        if (cancelled) {
          return;
        }
        setHearingLawyerLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    hearingModalOpen,
    hearingModalDepartment,
    hearingModalLatestTrialLawyerId,
    hearingModalLatestTrialLawyerName,
    hearingModalAssignedLawyerId,
    hearingModalAssignedLawyerName,
    currentUser
  ]);

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

  const refreshCases = useCallback(async () => {
    const nextPage = pagination.current ?? 1;
    const nextSize = pagination.pageSize ?? DEFAULT_PAGE_SIZE;
    await loadCases(nextPage, nextSize);
  }, [loadCases, pagination]);

  const openCaseDetailModal = useCallback(
    async (record: CaseRecord, mode: 'view' | 'update' = 'view') => {
      const hide = message.loading('正在加载案件详情...', 0);
      try {
        setCaseModalCanEdit(false);
        const detail = await fetchCaseById(record.id);
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
    [canUpdateCaseRecord]
  );

  const handleAssignSubmit = useCallback(
    async (values: AssignStaffFormValues) => {
      if (!assignModalCase) {
        return;
      }
      const caseId = assignModalCase.id;
      setAssignSubmitting(true);
      try {
        await updateCaseApi(caseId, {
          caseType: assignModalCase.caseType,
          caseLevel: assignModalCase.caseLevel,
          assignedLawyerId: values.assignedLawyerId ?? null,
          assignedAssistantId: values.assignedAssistantId ?? null
        });
        message.success('人员分配已更新');
        setAssignModalOpen(false);
        setAssignModalCase(null);
        changeLogCacheRef.current.delete(caseId);
        await refreshCases();
      } catch (error) {
        const errorMessage = error instanceof ApiError ? error.message : '更新人员分配失败，请稍后重试';
        message.error(errorMessage);
      } finally {
        setAssignSubmitting(false);
      }
    },
    [assignModalCase, refreshCases]
  );

  const handleHearingSubmit = useCallback(
    async (values: HearingFormValues) => {
      if (!hearingModalCase) {
        return;
      }
      const caseId = hearingModalCase.id;
      setHearingSubmitting(true);
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

        const existingHearings = (hearingModalCase.hearings ?? []).map(mapHearingRecordToInput);
        const deduplicatedHearings = hearingPayload.trialStage
          ? existingHearings.filter((item) => item.trialStage !== hearingPayload.trialStage)
          : existingHearings;
        const nextHearings = sortHearingInputs([...deduplicatedHearings, hearingPayload]);

        await updateCaseApi(caseId, {
          caseType: hearingModalCase.caseType,
          caseLevel: hearingModalCase.caseLevel,
          hearings: nextHearings
        });
        message.success('庭审信息添加成功');
        setHearingModalOpen(false);
        setHearingModalCase(null);
        changeLogCacheRef.current.delete(caseId);
        await refreshCases();
      } catch (error) {
        const errorMessage = error instanceof ApiError ? error.message : '新增庭审信息失败，请稍后重试';
        message.error(errorMessage);
      } finally {
        setHearingSubmitting(false);
      }
    },
    [hearingModalCase, refreshCases]
  );

  const handleFollowUpSubmit = useCallback(
    async (values: Required<FollowUpFormValues>) => {
      if (!followUpModalCase) {
        return;
      }
      const occurredOn = formatDayValue(values.occurredOn ?? null);
      if (!occurredOn) {
        message.error('请选择有效的发生日期');
        return;
      }
      setFollowSubmitting(true);
      try {
        const existingTimeline = mapTimelineRecordsToInputs(followUpModalCase);
        existingTimeline.push({
          occurredOn,
          note: values.note ?? null,
          followerId: currentUser?.id ?? null
        });
        const caseId = followUpModalCase.id;
        await updateCaseApi(caseId, {
          caseType: followUpModalCase.caseType,
          caseLevel: followUpModalCase.caseLevel,
          timeline: existingTimeline
        });
        message.success('跟进备注已添加');
        setFollowUpModalOpen(false);
        setFollowUpModalCase(null);
        changeLogCacheRef.current.delete(caseId);
        await refreshCases();
      } catch (error) {
        const errorMessage = error instanceof ApiError ? error.message : '保存跟进备注失败，请稍后重试';
        message.error(errorMessage);
      } finally {
        setFollowSubmitting(false);
      }
    },
    [followUpModalCase, currentUser, refreshCases]
  );

  const handleStatusSubmit = useCallback(
    async (values: UpdateStatusFormValues) => {
      if (!statusModalCase) {
        return;
      }
      const caseId = statusModalCase.id;
      setStatusSubmitting(true);
      try {
        await updateCaseApi(caseId, {
          caseType: statusModalCase.caseType,
          caseLevel: statusModalCase.caseLevel,
          caseStatus: values.caseStatus,
          closedReason: values.caseStatus === '已结案' ? values.closedReason ?? null : null,
          voidReason: values.caseStatus === '废单' ? values.voidReason ?? null : null
        });
        message.success('案件状态已更新');
        setStatusModalOpen(false);
        setStatusModalCase(null);
        changeLogCacheRef.current.delete(caseId);
        await refreshCases();
      } catch (error) {
        const errorMessage = error instanceof ApiError ? error.message : '更新案件状态失败，请稍后重试';
        message.error(errorMessage);
      } finally {
        setStatusSubmitting(false);
      }
    },
    [refreshCases, statusModalCase]
  );

  const handleCaseModalSubmit = useCallback(
    async (values: WorkInjuryCaseFormValues) => {
      if (!caseModalCase) {
        return;
      }
      const caseId = caseModalCase.id;
      setCaseModalSubmitting(true);
      try {
        const payload = mapFormToCasePayload(values, caseModalCase.department ?? null);
        await updateCaseApi(caseId, payload);
        message.success('案件信息已更新');
        setCaseModalOpen(false);
        setCaseModalCase(null);
        changeLogCacheRef.current.delete(caseId);
        await refreshCases();
      } catch (error) {
        const errorMessage = error instanceof ApiError ? error.message : '更新案件信息失败，请稍后重试';
        message.error(errorMessage);
      } finally {
        setCaseModalSubmitting(false);
      }
    },
    [caseModalCase, refreshCases]
  );

  const handleFeeSubmit = useCallback(
    async (values: { salesCommission: string | null; handlingFee: string | null }) => {
      if (!feeModalCase) {
        return;
      }
      setFeeModalSubmitting(true);
      try {
        await updateCaseApi(feeModalCase.id, {
          caseType: feeModalCase.caseType,
          caseLevel: feeModalCase.caseLevel,
          salesCommission: values.salesCommission,
          handlingFee: values.handlingFee
        });
        message.success('费用信息已更新');
        changeLogCacheRef.current.delete(feeModalCase.id);
        setFeeModalOpen(false);
        setFeeModalCase(null);
        await refreshCases();
      } catch (error) {
        const errorMessage = error instanceof ApiError ? error.message : '更新费用信息失败，请稍后重试';
        message.error(errorMessage);
      } finally {
        setFeeModalSubmitting(false);
      }
    },
    [feeModalCase, refreshCases]
  );

  const handleCollectionSubmit = useCallback(
    async (values: { amount: number; receivedAt: string }) => {
      if (!collectionModalCase) {
        return;
      }
      const caseId = collectionModalCase.id;
      setCollectionSubmitting(true);
      try {
        await createCaseCollectionApi(caseId, {
          amount: values.amount,
          receivedAt: values.receivedAt
        });
        message.success('回款记录已添加');
        setCollectionModalOpen(false);
        setCollectionModalCase(null);
        changeLogCacheRef.current.delete(caseId);
        await refreshCases();
      } catch (error) {
        const errorMessage = error instanceof ApiError ? error.message : '新增回款记录失败，请稍后重试';
        message.error(errorMessage);
      } finally {
        setCollectionSubmitting(false);
      }
    },
    [collectionModalCase, refreshCases]
  );

  const handleActionSelect = useCallback(
    (actionKey: string, record: CaseRecord) => {
      switch (actionKey) {
        case 'assign':
          if (!canAssignStaffToCase(record)) {
            message.error('您没有权限分配人员');
            return;
          }
          setAssignModalCase(record);
          setAssignModalOpen(true);
          break;
        case 'hearing':
          if (!canUpdateHearingRecord(record)) {
            message.error('您没有权限新增庭审信息');
            return;
          }
          {
            const availableStages = resolveAvailableTrialStages(record.hearings ?? []);
            if (availableStages.length === 0) {
              message.warning('所有审理阶段均已记录或前序阶段未完成，无法继续新增');
              return;
            }
          }
          setHearingModalCase(record);
          setHearingModalOpen(true);
          break;
        case 'follow_up':
          if (!canUpdateCaseRecord(record)) {
            message.error('您没有权限添加跟进备注');
            return;
          }
          setFollowUpModalCase(record);
          setFollowUpModalOpen(true);
          break;
        case 'update_status':
          if (!canUpdateCaseRecord(record)) {
            message.error('您没有权限更新案件状态');
            return;
          }
          setStatusModalCase(record);
          setStatusModalOpen(true);
          break;
        case 'add_collection': {
          if (!canCreateCollectionRecord(record)) {
            message.error('您没有权限新增回款记录');
            return;
          }
          setCollectionModalCase(record);
          setCollectionModalOpen(true);
          break;
        }
        case 'fee_detail': {
          if (!canManageCaseFee(record)) {
            message.error('您没有权限查看费用明细');
            return;
          }
          setFeeModalOpen(true);
          setFeeModalLoading(true);
          setFeeModalCase(null);
          void fetchCaseById(record.id)
            .then((detail) => {
              setFeeModalCase(detail);
            })
            .catch((error) => {
              const errorMessage = error instanceof ApiError ? error.message : '获取费用信息失败，请稍后重试';
              message.error(errorMessage);
              setFeeModalOpen(false);
            })
            .finally(() => {
              setFeeModalLoading(false);
            });
          break;
        }
        case 'view_logs': {
          setLogModalCase(record);
          setLogModalOpen(true);
          const cached = changeLogCacheRef.current.get(record.id);
          if (cached) {
            setLogModalLogs(cached);
            setLogModalLoading(false);
            break;
          }
          setLogModalLogs([]);
          setLogModalLoading(true);
          void fetchCaseChangeLogs(record.id)
            .then((logs) => {
              changeLogCacheRef.current.set(record.id, logs);
              setLogModalLogs(logs);
            })
            .catch((error) => {
              const errorMessage = error instanceof ApiError ? error.message : '获取变更日志失败，请稍后重试';
              message.error(errorMessage);
            })
            .finally(() => {
              setLogModalLoading(false);
            });
          break;
        }
        default:
          break;
      }
    },
    [
      canAssignStaffToCase,
      canCreateCollectionRecord,
      canManageCaseFee,
      canUpdateCaseRecord,
      canUpdateHearingRecord
    ]
  );

  const handleCaseTitleClick = useCallback(
    (record: CaseRecord) => {
      void openCaseDetailModal(record);
    },
    [openCaseDetailModal]
  );

  const closeCaseModal = useCallback(() => {
    setCaseModalOpen(false);
    setCaseModalCase(null);
    setCaseModalMode('view');
    setCaseModalCanEdit(false);
    setCaseModalSubmitting(false);
  }, []);

  const handleLogModalClose = useCallback(() => {
    setLogModalOpen(false);
    setLogModalCase(null);
  }, []);

  const handleFeeModalClose = useCallback(() => {
    setFeeModalOpen(false);
    setFeeModalCase(null);
    setFeeModalLoading(false);
    setFeeModalSubmitting(false);
  }, []);

  const handleCollectionModalClose = useCallback(() => {
    setCollectionModalOpen(false);
    setCollectionModalCase(null);
    setCollectionSubmitting(false);
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

  const statusModalInitialValues = useMemo<UpdateStatusFormValues | undefined>(() => {
    if (!statusModalCase) {
      return undefined;
    }
    const caseStatus = statusModalCase.caseStatus ?? '未结案';
    return {
      caseStatus,
      closedReason: caseStatus === '已结案' ? castClosedReason(statusModalCase.closedReason ?? null) ?? null : null,
      voidReason: caseStatus === '废单' ? castVoidReason(statusModalCase.voidReason ?? null) ?? null : null
    };
  }, [statusModalCase]);

  const hearingModalInitialValues = useMemo<HearingFormValues>(() => {
    const defaultTrialLawyerId = (() => {
      if (hearingModalLatestTrialLawyerId) {
        return hearingModalLatestTrialLawyerId;
      }
      if (currentUser?.role === 'lawyer' && currentUser.id) {
        return currentUser.id;
      }
      if (hearingModalAssignedLawyerId) {
        return hearingModalAssignedLawyerId;
      }
      return null;
    })();

    const latestHearing = hearingModalLatestHearing;
    const defaultTrialStage = hearingModalNextStage;
    return {
      trialLawyerId: defaultTrialLawyerId,
      hearingTime: null,
      hearingLocation: latestHearing?.hearingLocation ?? null,
      tribunal: latestHearing?.tribunal ?? null,
      judge: latestHearing?.judge ?? null,
      caseNumber: latestHearing?.caseNumber ?? null,
      contactPhone: latestHearing?.contactPhone ?? null,
      trialStage: defaultTrialStage ?? null,
      hearingResult: null
    } satisfies HearingFormValues;
  }, [
    hearingModalLatestHearing,
    hearingModalLatestTrialLawyerId,
    hearingModalAssignedLawyerId,
    hearingModalNextStage,
    currentUser
  ]);

  const columns = useMemo<ColumnsType<CaseRecord>>(
    () => [
      {
        title: '案件标题',
        dataIndex: 'caseTitle',
        key: 'caseTitle',
        render: (_, record) => (
          <Button
            type="link"
            style={{ padding: 0, height: 'auto' }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              handleCaseTitleClick(record);
            }}
          >
            {buildCaseTitle(record)}
          </Button>
        )
      },
      {
        title: '案件状态',
        dataIndex: 'caseStatus',
        key: 'caseStatus',
        render: (value: CaseStatus | null) =>
          value ? <Tag color={CASE_STATUS_COLOR_MAP[value] ?? 'blue'}>{value}</Tag> : '—'
      },
      {
        title: '省份/城市',
        dataIndex: 'provinceCity',
        key: 'provinceCity',
        render: (value: string | null) => value ?? '—'
      },
      {
        title: '操作',
        key: 'actions',
        fixed: 'right',
        width: 60,
        render: (_, record) => {
          const items: MenuProps['items'] = [];
          if (canAssignStaffToCase(record)) {
            items.push({
              key: 'assign',
              label: '分配律师',
              disabled: !canAssignStaffToCase(record)
            });
          }
          if (canUpdateHearingRecord(record)) {
            items.push({
              key: 'hearing',
              label: '新增庭审',
              disabled: !canUpdateCaseRecord(record)
            });
          }
          if (canUpdateCaseRecord(record)) {
            items.push({
              key: 'follow_up',
              label: '跟进备注',
              disabled: !canUpdateCaseRecord(record)
            });
            items.push({
              key: 'update_status',
              label: '更新状态',
              disabled: !canUpdateCaseRecord(record)
            });
          }
          if (canManageCaseFee(record)) {
            items.push({
              key: 'fee_detail',
              label: '费用明细',
              disabled: !canManageCaseFee(record)
            });
          }
          if (canCreateCollectionRecord(record)) {
            items.push({
              key: 'add_collection',
              label: '新增回款记录',
              disabled: !canCreateCollectionRecord(record)
            });
          }
          items.push({
            key: 'view_logs',
            label: '查看变更日志'
          });
          return (
            <Dropdown
              menu={{
                items,
                onClick: ({ key }) => handleActionSelect(key as string, record)
              }}
              trigger={['click']}
            >
              <Button
                  type='text'
                  icon={<EllipsisOutlined />}
                  aria-label='案件操作'
                />
            </Dropdown>
          );
        },
      }
    ],
    [
  canAssignStaffToCase,
  canCreateCollectionRecord,
      canManageCaseFee,
      canUpdateCaseRecord,
      canUpdateHearingRecord,
      handleActionSelect,
      handleCaseTitleClick
    ]
  );

  return (
    <Space direction="vertical" size={24} style={{ width: '100%' }}>
    <Card>
        <Form
            form={filterForm}
            layout="inline"
            onValuesChange={handleFilterChange}
            style={{ rowGap: 16 }}
          >
            <Form.Item label="案件类型" name="caseType">
              <Select
                allowClear
                placeholder="全部类型"
                options={caseTypeOptions}
                style={{ minWidth: 160 }}
              />
            </Form.Item>
            <Form.Item label="案件级别" name="caseLevel">
              <Select
                allowClear
                placeholder="全部级别"
                options={caseLevelOptions}
                style={{ minWidth: 160 }}
              />
            </Form.Item>
            <Form.Item label="案件状态" name="caseStatus">
              <Select
                allowClear
                placeholder="全部状态"
                options={caseStatusSelectOptions}
                style={{ minWidth: 160 }}
              />
            </Form.Item>
            <Form.Item>
              <Button onClick={handleFilterReset} disabled={!hasActiveFilters}>
                重置
              </Button>
            </Form.Item>
          </Form>
    </Card>
      <Card styles={{ body: { padding: 0 }}}>
          <Table
            rowKey="id"
            dataSource={cases}
            columns={columns}
            loading={loading}
            pagination={pagination}
            onChange={handleTableChange}
          />
      </Card>

      {canCreateCase ? (
        <WorkInjuryCaseModal
          open={newCaseModalOpen}
          onCancel={() => setNewCaseModalOpen(false)}
          onSubmit={handleCreateCase}
          confirmLoading={creating}
        />
      ) : null}

      <AssignStaffModal
        open={assignModalOpen}
        caseDepartment={assignModalCase?.department ?? currentUser?.department ?? null}
        initialValues={{
          assignedLawyerId: assignModalCase?.assignedLawyerId ?? null,
          assignedAssistantId: assignModalCase?.assignedAssistantId ?? null
        }}
        confirmLoading={assignSubmitting}
        onCancel={() => {
          setAssignModalOpen(false);
          setAssignModalCase(null);
        }}
        onSubmit={handleAssignSubmit}
      />

      <HearingModal
        open={hearingModalOpen}
        initialValues={hearingModalInitialValues}
        lawyerOptions={hearingLawyerOptions}
        lawyerOptionsLoading={hearingLawyerLoading}
        confirmLoading={hearingSubmitting}
        disabledStages={hearingModalDisabledStages}
        onCancel={() => {
          setHearingModalOpen(false);
          setHearingModalCase(null);
        }}
        onSubmit={handleHearingSubmit}
      />

      <FollowUpModal
        open={followUpModalOpen}
        confirmLoading={followSubmitting}
        onCancel={() => {
          setFollowUpModalOpen(false);
          setFollowUpModalCase(null);
        }}
        onSubmit={handleFollowUpSubmit}
      />

      <UpdateStatusModal
        open={statusModalOpen}
        initialValues={statusModalInitialValues}
        confirmLoading={statusSubmitting}
        onCancel={() => {
          setStatusModalOpen(false);
          setStatusModalCase(null);
        }}
        onSubmit={handleStatusSubmit}
      />

      <CaseFeeModal
        open={feeModalOpen}
        loading={feeModalLoading}
        submitting={feeModalSubmitting}
        caseRecord={feeModalCase}
        onClose={handleFeeModalClose}
        onSubmit={handleFeeSubmit}
      />

      <CaseCollectionModal
        open={collectionModalOpen}
        confirmLoading={collectionSubmitting}
        onCancel={handleCollectionModalClose}
        onSubmit={handleCollectionSubmit}
      />

      <CaseChangeLogModal
        open={logModalOpen}
        loading={logModalLoading}
        logs={logModalLogs}
        caseTitle={logModalCase ? buildCaseTitle(logModalCase) : undefined}
        onClose={handleLogModalClose}
      />

      <WorkInjuryCaseModal
        open={caseModalOpen}
        mode={caseModalMode}
        initialValues={caseModalInitialValues}
        allowEdit={caseModalCanEdit}
        onRequestEdit={handleCaseModalEdit}
        onRequestView={handleCaseModalView}
        onCancel={closeCaseModal}
        onSubmit={caseModalMode === 'update' ? handleCaseModalSubmit : undefined}
        confirmLoading={caseModalMode === 'update' ? caseModalSubmitting : undefined}
      />
    </Space>
  );
}
