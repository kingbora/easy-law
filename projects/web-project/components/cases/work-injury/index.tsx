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
import { useDashboardHeaderAction } from '@/app/(dashboard)/header-context';
import { ApiError } from '@/lib/api-client';
import { useSessionStore } from '@/lib/stores/session-store';
import {
  createCase as createCaseApi,
  fetchCaseById,
  fetchCases,
  type CaseParticipantInput,
  type CaseParticipantsInput,
  type CaseParticipant,
  type CasePayload,
  type CaseRecord,
  type CaseStatus,
  type CaseLevel,
  type CaseTimelineInput,
  type CaseType,
  type CaseCollectionInput,
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

const PAGE_DEPARTMENT: UserDepartment = 'work_injury';

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

  const timeline = (record.timeline ?? []).map((item) => ({
    nodeType: item.nodeType,
    date: toDayjsValue(item.occurredOn ?? null)
  }));

  const hearing = record.hearing ?? null;

  return {
    basicInfo: {
      caseType: record.caseType,
      caseLevel: record.caseLevel,
      provinceCity: record.provinceCity ?? undefined,
      targetAmount: parseNumberValue(record.targetAmount ?? null),
      feeStandard: record.feeStandard ?? undefined,
      agencyFeeEstimate: parseNumberValue(record.agencyFeeEstimate ?? null),
      dataSource: record.dataSource ?? undefined,
      hasContract: record.hasContract ?? undefined,
      hasSocialSecurity: record.hasSocialSecurity ?? undefined,
      entryDate: toDayjsValue(record.entryDate ?? null),
      injuryLocation: record.injuryLocation ?? undefined,
      injurySeverity: record.injurySeverity ?? undefined,
      injuryCause: record.injuryCause ?? undefined,
      workInjuryCertified: record.workInjuryCertified ?? undefined,
      monthlySalary: parseNumberValue(record.monthlySalary ?? null),
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
      hearingTime: toDayjsValue(hearing?.hearingTime ?? null),
      hearingLocation: hearing?.hearingLocation ?? undefined,
      tribunal: hearing?.tribunal ?? undefined,
      judge: hearing?.judge ?? undefined,
      caseNumber: hearing?.caseNumber ?? undefined,
      contactPhone: hearing?.contactPhone ?? undefined,
      trialStage: hearing?.trialStage ?? undefined,
      hearingResult: hearing?.hearingResult ?? undefined,
      timeline
    },
    adminInfo: {
      assignedLawyer: record.assignedLawyerId ?? undefined,
      assignedAssistant: record.assignedAssistantId ?? undefined,
      assignedTrialLawyer: record.assignedTrialLawyerId ?? undefined,
      caseStatus: record.caseStatus ?? undefined,
      closedReason: castClosedReason(record.closedReason ?? undefined),
      voidReason: castVoidReason(record.voidReason ?? undefined),
      collections
    }
  } satisfies WorkInjuryCaseFormValues;
}

function mapTimelineRecordsToInputs(record: CaseRecord): CaseTimelineInput[] {
  return (record.timeline ?? []).map((item) => ({
    id: item.id,
    nodeType: item.nodeType,
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

function mapTimeline(timeline?: Array<{ nodeType?: string; date?: Dayjs | null }>):
  | CaseTimelineInput[]
  | undefined {
  if (!timeline || timeline.length === 0) {
    return undefined;
  }

  const mapped = timeline.reduce<CaseTimelineInput[]>((acc, item) => {
    if (!item?.nodeType) {
      return acc;
    }

    const occurredOn = formatDayValue(item.date ?? null);
    if (!occurredOn) {
      return acc;
    }

    acc.push({
      nodeType: item.nodeType as CaseTimelineInput['nodeType'],
      occurredOn
    });

    return acc;
  }, []);

  return mapped.length ? mapped : undefined;
}

function mapFormToCasePayload(values: WorkInjuryCaseFormValues, department: CasePayload['department']): CasePayload {
  const basic = values.basicInfo ?? {};
  const lawyerInfo = values.lawyerInfo ?? {};
  const admin = values.adminInfo ?? {};

  const payload: CasePayload = {
    caseType: (basic.caseType ?? 'work_injury') as CasePayload['caseType'],
    caseLevel: (basic.caseLevel ?? 'A') as CasePayload['caseLevel'],
    provinceCity: toNullableText(basic.provinceCity ?? null),
    targetAmount: toNumericString(basic.targetAmount ?? null),
    feeStandard: toNullableText(basic.feeStandard ?? null),
    agencyFeeEstimate: toNumericString(basic.agencyFeeEstimate ?? null),
    dataSource: toNullableText(basic.dataSource ?? null),
    hasContract: basic.hasContract ?? null,
    hasSocialSecurity: basic.hasSocialSecurity ?? null,
    entryDate: formatDayValue(basic.entryDate ?? null),
    injuryLocation: toNullableText(basic.injuryLocation ?? null),
    injurySeverity: toNullableText(basic.injurySeverity ?? null),
    injuryCause: toNullableText(basic.injuryCause ?? null),
    workInjuryCertified: basic.workInjuryCertified ?? null,
    monthlySalary: toNumericString(basic.monthlySalary ?? null),
    appraisalLevel: toNullableText(basic.appraisalLevel ?? null),
    appraisalEstimate: toNullableText(basic.appraisalEstimate ?? null),
    existingEvidence: toNullableText(basic.existingEvidence ?? null),
    customerCooperative: basic.customerCooperative ?? null,
    witnessCooperative: basic.witnessCooperative ?? null,
    remark: toNullableText(basic.remark ?? null),
  department: department ?? null,
    assignedLawyerId: toNullableText(admin.assignedLawyer ?? null),
    assignedAssistantId: toNullableText(admin.assignedAssistant ?? null),
    assignedTrialLawyerId: toNullableText(admin.assignedTrialLawyer ?? null),
    caseStatus: admin.caseStatus ?? null,
    closedReason: toNullableText(admin.closedReason ?? null),
    voidReason: toNullableText(admin.voidReason ?? null),
    participants: mapParticipants(values.parties),
    collections: mapCollections(admin.collections),
    timeline: mapTimeline(lawyerInfo.timeline)
  };

  const hearingPayload: CasePayload['hearing'] = {
    hearingTime: formatDateTimeValue(lawyerInfo.hearingTime ?? null),
    hearingLocation: toNullableText(lawyerInfo.hearingLocation ?? null),
    tribunal: toNullableText(lawyerInfo.tribunal ?? null),
    judge: toNullableText(lawyerInfo.judge ?? null),
    caseNumber: toNullableText(lawyerInfo.caseNumber ?? null),
    contactPhone: toNullableText(lawyerInfo.contactPhone ?? null),
    trialStage: lawyerInfo.trialStage ?? null,
    hearingResult: toNullableText(lawyerInfo.hearingResult ?? null)
  };

  const hearingHasValue = Object.values(hearingPayload ?? {}).some((value) => value !== null);
  if (hearingHasValue) {
    payload.hearing = hearingPayload;
  }

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
  const [followUpModalOpen, setFollowUpModalOpen] = useState(false);
  const [followUpModalCase, setFollowUpModalCase] = useState<CaseRecord | null>(null);
  const [followSubmitting, setFollowSubmitting] = useState(false);
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
  const currentUser = useSessionStore((state) => state.user);

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

  const canUpdateCaseRecord = useCallback(
    (record: CaseRecord) => {
      if (!currentUser) {
        return false;
      }
      if (currentUser.role === 'super_admin') {
        return true;
      }
      if (currentUser.role === 'admin') {
        return Boolean(currentUser.department && record.department === currentUser.department);
      }
      if (currentUser.role === 'lawyer') {
        return (
          record.assignedLawyerId === currentUser.id ||
          record.assignedTrialLawyerId === currentUser.id ||
          record.ownerId === currentUser.id
        );
      }
      if (currentUser.role === 'assistant') {
        return record.assignedAssistantId === currentUser.id || record.ownerId === currentUser.id;
      }
      if (currentUser.role === 'sale') {
        return record.ownerId === currentUser.id;
      }
      return false;
    },
    [currentUser]
  );

  const canAssignStaffToCase = useCallback(
    (record: CaseRecord) => {
      if (!currentUser) {
        return false;
      }
      if (currentUser.role === 'super_admin') {
        return true;
      }
      if (currentUser.role === 'admin') {
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
      setAssignSubmitting(true);
      try {
        await updateCaseApi(assignModalCase.id, {
          caseType: assignModalCase.caseType,
          caseLevel: assignModalCase.caseLevel,
          assignedLawyerId: values.assignedLawyerId ?? null,
          assignedAssistantId: values.assignedAssistantId ?? null,
          assignedTrialLawyerId: values.assignedTrialLawyerId ?? null
        });
        message.success('人员分配已更新');
        setAssignModalOpen(false);
        setAssignModalCase(null);
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
      setHearingSubmitting(true);
      try {
        await updateCaseApi(hearingModalCase.id, {
          caseType: hearingModalCase.caseType,
          caseLevel: hearingModalCase.caseLevel,
          hearing: {
            hearingTime: formatDateTimeValue(values.hearingTime ?? null),
            hearingLocation: toNullableText(values.hearingLocation ?? null),
            tribunal: toNullableText(values.tribunal ?? null),
            judge: toNullableText(values.judge ?? null),
            caseNumber: toNullableText(values.caseNumber ?? null),
            contactPhone: toNullableText(values.contactPhone ?? null),
            trialStage: values.trialStage ?? null,
            hearingResult: toNullableText(values.hearingResult ?? null)
          }
        });
        message.success('庭审信息添加成功');
        setHearingModalOpen(false);
        setHearingModalCase(null);
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
          nodeType: values.nodeType,
          occurredOn,
          note: values.note ?? null,
          followerId: currentUser?.id ?? null
        });
        await updateCaseApi(followUpModalCase.id, {
          caseType: followUpModalCase.caseType,
          caseLevel: followUpModalCase.caseLevel,
          timeline: existingTimeline
        });
        message.success('跟进备注已添加');
        setFollowUpModalOpen(false);
        setFollowUpModalCase(null);
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

  const handleCaseModalSubmit = useCallback(
    async (values: WorkInjuryCaseFormValues) => {
      if (!caseModalCase) {
        return;
      }
      setCaseModalSubmitting(true);
      try {
        const payload = mapFormToCasePayload(values, caseModalCase.department ?? null);
        await updateCaseApi(caseModalCase.id, payload);
        message.success('案件信息已更新');
        setCaseModalOpen(false);
        setCaseModalCase(null);
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
          if (!canUpdateCaseRecord(record)) {
            message.error('您没有权限新增庭审信息');
            return;
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
        default:
          break;
      }
    },
    [canAssignStaffToCase, canUpdateCaseRecord]
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

  const handleCaseModalEdit = useCallback(() => {
    if (!caseModalCanEdit) {
      return;
    }
    setCaseModalMode('update');
  }, [caseModalCanEdit]);

  const caseModalInitialValues = useMemo(
    () => (caseModalCase ? mapCaseRecordToFormValues(caseModalCase) : undefined),
    [caseModalCase]
  );

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
          const items: MenuProps['items'] = [
            {
              key: 'assign',
              label: '分配律师',
              disabled: !canAssignStaffToCase(record)
            },
            {
              key: 'hearing',
              label: '新增庭审',
              disabled: !canUpdateCaseRecord(record)
            },
            {
              key: 'follow_up',
              label: '跟进备注',
              disabled: !canUpdateCaseRecord(record)
            }
          ];
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
    [canAssignStaffToCase, canUpdateCaseRecord, handleActionSelect, handleCaseTitleClick]
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
          assignedAssistantId: assignModalCase?.assignedAssistantId ?? null,
          assignedTrialLawyerId: assignModalCase?.assignedTrialLawyerId ?? null
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
        initialValues={{
          hearingTime: toDayjsValue(hearingModalCase?.hearing?.hearingTime ?? null) ?? null,
          hearingLocation: hearingModalCase?.hearing?.hearingLocation ?? null,
          tribunal: hearingModalCase?.hearing?.tribunal ?? null,
          judge: hearingModalCase?.hearing?.judge ?? null,
          caseNumber: hearingModalCase?.hearing?.caseNumber ?? null,
          contactPhone: hearingModalCase?.hearing?.contactPhone ?? null,
          trialStage: hearingModalCase?.hearing?.trialStage ?? 'first_instance',
          hearingResult: hearingModalCase?.hearing?.hearingResult ?? null
        }}
        confirmLoading={hearingSubmitting}
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

      <WorkInjuryCaseModal
        open={caseModalOpen}
        mode={caseModalMode}
        initialValues={caseModalInitialValues}
        allowEdit={caseModalCanEdit}
        onRequestEdit={handleCaseModalEdit}
        onCancel={closeCaseModal}
        onSubmit={caseModalMode === 'update' ? handleCaseModalSubmit : undefined}
        confirmLoading={caseModalMode === 'update' ? caseModalSubmitting : undefined}
      />
    </Space>
  );
}
