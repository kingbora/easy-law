import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { ClockCircleOutlined, MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import {
  App,
  Button,
  Col,
  DatePicker,
  Descriptions,
  Divider,
  Form,
  Input,
  InputNumber,
  Modal,
  Radio,
  Row,
  Select,
  Skeleton,
  Space,
  Spin,
  Tabs,
  Timeline,
  Tag,
  Typography,
} from 'antd';
import type { TabsProps } from 'antd';
import dayjs, { type Dayjs } from 'dayjs';
import {
  CASE_STATUS_LABEL_MAP as CASE_STATUS_LABELS,
  type CaseHearingRecord,
  type CaseChangeLog,
  type CaseStatus,
  type CaseTimelineRecord,
  type CaseTimeNodeRecord,
  type CaseTimeNodeType,
  type TrialStage,
  type AssignableStaffResponse
} from '@/lib/cases-api';
import styles from './modal.module.scss';
import { useSessionStore } from '@/lib/stores/session-store';
import type { UserRole } from '@/lib/users-api';

const { TextArea } = Input;

type TabKey =
  | 'basic'
  | 'parties'
  | 'hearing'
  | 'staff'
  | 'timeNodes'
  | 'followUp'
  | 'changeLog'
  | 'fees';

export type WorkInjuryCaseTabKey = TabKey;

const DEFAULT_ACTIVE_TAB: TabKey = 'basic';

const TAB_LABEL_MAP: Record<TabKey, string> = {
  basic: '基本信息',
  parties: '当事人信息',
  hearing: '庭审信息',
  staff: '相关人员',
  timeNodes: '时间节点',
  followUp: '跟进备注',
  changeLog: '变更日志',
  fees: '费用明细'
};

const TAB_ICON_MAP: Partial<Record<TabKey, ReactNode>> = {
  timeNodes: <ClockCircleOutlined />
};

const buildTabLabel = (key: TabKey): ReactNode => {
  const icon = TAB_ICON_MAP[key];
  const label = TAB_LABEL_MAP[key];
  if (!icon) {
    return label;
  }
  return (
    <span className={styles.tabLabel}>
      {icon}
      <span>{label}</span>
    </span>
  );
};

const isTabKey = (key: string): key is TabKey => key in TAB_LABEL_MAP;

const CASE_TYPES = [
  { label: '工伤', value: 'work_injury' },
  { label: '人损', value: 'personal_injury' },
  { label: '其他', value: 'other' }
] as const;

const CASE_LEVELS = [
  { label: 'A', value: 'A' },
  { label: 'B', value: 'B' },
  { label: 'C', value: 'C' }
] as const;

const ENTITY_TYPES = [
  { label: '个人', value: 'personal' },
  { label: '单位', value: 'organization' }
] as const;

const YES_NO_RADIO = [
  { label: '有', value: true },
  { label: '无', value: false }
] as const;

const YES_NO_COOPERATION = [
  { label: '是', value: true },
  { label: '否', value: false }
] as const;

const CASE_CLOSED_OPTIONS = ['调解', '判决', '撤诉', '和解'] as const;
const CASE_VOID_OPTIONS = ['退单', '跑单'] as const;

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

const CASE_TIME_NODE_LABEL_MAP = CASE_TIME_NODE_DEFINITIONS.reduce<Record<CaseTimeNodeType, string>>(
  (acc, definition) => {
    acc[definition.type] = definition.label;
    return acc;
  },
  {} as Record<CaseTimeNodeType, string>
);

const CASE_TIME_NODE_ORDER_MAP = CASE_TIME_NODE_DEFINITIONS.reduce<Record<CaseTimeNodeType, number>>(
  (acc, definition, index) => {
    acc[definition.type] = index;
    return acc;
  },
  {} as Record<CaseTimeNodeType, number>
);

const CASE_STATUS_OPTIONS: CaseStatusValue[] = ['open', 'closed', 'void'];

const CASE_STATUS_COLOR_MAP: Record<CaseStatusValue, string> = {
  open: 'processing',
  closed: 'success',
  void: 'error'
};

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

const collectUsedTrialStages = (hearings: CaseHearingRecord[] = []): Set<TrialStage> => {
  const usedStages = new Set<TrialStage>();
  hearings.forEach(item => {
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
    return prerequisites.every(requiredStage => usedStages.has(requiredStage));
  });
};

const resolveDisabledTrialStages = (hearings: CaseHearingRecord[] = []): TrialStage[] => {
  const availableStages = new Set(resolveAvailableTrialStages(hearings));
  return TRIAL_STAGE_SEQUENCE.filter(stage => !availableStages.has(stage));
};

type CaseTypeValue = (typeof CASE_TYPES)[number]['value'];
type CaseLevelValue = (typeof CASE_LEVELS)[number]['value'];

type CaseStatusValue = CaseStatus;

type CaseParty = {
  name?: string;
  entityType?: 'personal' | 'organization';
  idNumber?: string;
  phone?: string;
  address?: string;
  isDishonest?: boolean;
};

type CollectionRecord = {
  amount?: number;
  date?: Dayjs;
};

export interface AssignStaffFormValues {
  assignedLawyerId?: string | null;
  assignedAssistantId?: string | null;
}

export interface CaseStatusFormValues {
  caseStatus: CaseStatusValue;
  closedReason?: (typeof CASE_CLOSED_OPTIONS)[number] | null;
  voidReason?: (typeof CASE_VOID_OPTIONS)[number] | null;
}

export interface HearingFormValues {
  trialLawyerId?: string | null;
  hearingTime?: Dayjs | null;
  hearingLocation?: string | null;
  tribunal?: string | null;
  judge?: string | null;
  caseNumber?: string | null;
  contactPhone?: string | null;
  trialStage?: TrialStage | null;
  hearingResult?: string | null;
}

export interface FollowUpFormValues {
  occurredOn?: Dayjs | null;
  note?: string | null;
}

export interface CollectionFormValues {
  amount?: number | null;
  receivedAt?: Dayjs | null;
}

export interface FeeFormValues {
  salesCommission?: string | null;
  handlingFee?: string | null;
}

type TimeNodeFormValues = Partial<Record<CaseTimeNodeType, Dayjs | null>>;

const CASE_COLLECTION_ALLOWED_ROLES: ReadonlySet<UserRole> = new Set<UserRole>([
  'super_admin',
  'admin',
  'administration'
]);

const ROLE_LABEL_MAP: Record<UserRole, string> = {
  super_admin: '超级管理员',
  admin: '管理员',
  administration: '行政',
  lawyer: '律师',
  assistant: '律助',
  sale: '销售'
};

const CASE_TYPE_LABEL_MAP = CASE_TYPES.reduce<Record<CaseTypeValue, string>>((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {} as Record<CaseTypeValue, string>);

const CASE_LEVEL_LABEL_MAP = CASE_LEVELS.reduce<Record<CaseLevelValue, string>>((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {} as Record<CaseLevelValue, string>);

const ENTITY_TYPE_LABEL_MAP = ENTITY_TYPES.reduce<Record<'personal' | 'organization', string>>((acc, item) => {
  acc[item.value] = item.label;
  return acc;
}, {} as Record<'personal' | 'organization', string>);

const formatOptionLabel = <T extends string>(map: Record<T, string>, value?: T | null): string => {
  if (value === undefined || value === null) {
    return '—';
  }
  return map[value] ?? '—';
};

const formatBoolean = (value?: boolean | null, trueLabel = '是', falseLabel = '否'): string => {
  if (value === undefined || value === null) {
    return '—';
  }
  return value ? trueLabel : falseLabel;
};

const formatText = (value?: string | null): string => {
  if (value === undefined || value === null) {
    return '—';
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '—';
};

const formatNumber = (value?: number | null): string => {
  if (value === undefined || value === null) {
    return '—';
  }
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return '—';
  }
  return numeric.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  });
};

const formatDate = (value?: Dayjs | string | null, formatPattern = 'YYYY-MM-DD'): string => {
  if (!value) {
    return '—';
  }
  if (dayjs.isDayjs(value)) {
    return value.format(formatPattern);
  }
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format(formatPattern) : String(value);
};

const formatCurrency = (value?: number | null): string => {
  const numberText = formatNumber(value);
  return numberText === '—' ? numberText : `¥${numberText}`;
};

export interface WorkInjuryCaseFormValues {
  basicInfo?: {
    caseType?: CaseTypeValue;
    caseLevel?: CaseLevelValue;
    provinceCity?: string;
    targetAmount?: string;
    feeStandard?: string;
    agencyFeeEstimate?: string;
    dataSource?: string;
    hasContract?: boolean;
    hasSocialSecurity?: boolean;
    entryDate?: Dayjs;
    injuryLocation?: string;
    injurySeverity?: string;
    injuryCause?: string;
    workInjuryCertified?: boolean;
    monthlySalary?: string;
    appraisalLevel?: string;
    existingEvidence?: string;
    appraisalEstimate?: string;
    customerCooperative?: boolean;
    witnessCooperative?: boolean;
    remark?: string;
  };
  parties?: {
    claimants?: CaseParty[];
    respondents?: CaseParty[];
  };
  lawyerInfo?: {
    trialLawyerId?: string;
    trialLawyerName?: string;
    hearingTime?: Dayjs;
    hearingLocation?: string;
    tribunal?: string;
    judge?: string;
    caseNumber?: string;
    contactPhone?: string;
    trialStage?: TrialStage | null;
    hearingResult?: string;
    hearingRecords?: CaseHearingRecord[];
  };
  adminInfo?: {
    assignedLawyer?: string;
    assignedLawyerName?: string;
    assignedAssistant?: string;
    assignedAssistantName?: string;
    assignedSaleId?: string;
    assignedSaleName?: string;
    caseStatus?: CaseStatusValue;
    closedReason?: (typeof CASE_CLOSED_OPTIONS)[number];
    voidReason?: (typeof CASE_VOID_OPTIONS)[number];
    collections?: CollectionRecord[];
    salesCommission?: string | null;
    handlingFee?: string | null;
  };
  timeline?: CaseTimelineRecord[];
  timeNodes?: CaseTimeNodeRecord[];
}

interface WorkInjuryCaseModalProps {
  open: boolean;
  mode?: 'create' | 'view' | 'update';
  initialValues?: WorkInjuryCaseFormValues;
  initialActiveTab?: TabKey;
  allowEdit?: boolean;
  onRequestEdit?: () => void;
  onRequestView?: () => void;
  onCancel: () => void;
  onSubmit?: (
    values: WorkInjuryCaseFormValues
  ) => Promise<WorkInjuryCaseFormValues | void> | WorkInjuryCaseFormValues | void;
  onSaveBasicInfo?: (
    values: WorkInjuryCaseFormValues['basicInfo']
  ) => Promise<WorkInjuryCaseFormValues | void> | WorkInjuryCaseFormValues | void;
  onSaveParties?: (
    values: WorkInjuryCaseFormValues['parties']
  ) => Promise<WorkInjuryCaseFormValues | void> | WorkInjuryCaseFormValues | void;
  confirmLoading?: boolean;
  onSaveAssignment?: (
    values: AssignStaffFormValues
  ) => Promise<WorkInjuryCaseFormValues | void>;
  onSaveCaseStatus?: (
    values: CaseStatusFormValues
  ) => Promise<WorkInjuryCaseFormValues | void>;
  onAddHearing?: (
    values: HearingFormValues
  ) => Promise<WorkInjuryCaseFormValues | void>;
  onAddFollowUp?: (
    values: { occurredOn: Dayjs; note: string | null }
  ) => Promise<WorkInjuryCaseFormValues | void>;
  onAddCollection?: (
    values: { amount: number; receivedAt: Dayjs }
  ) => Promise<WorkInjuryCaseFormValues | void>;
  onUpdateFees?: (
    values: FeeFormValues
  ) => Promise<WorkInjuryCaseFormValues | void>;
  onSaveTimeNodes?: (
    values: Array<{ nodeType: CaseTimeNodeType; occurredOn: Dayjs }>
  ) => Promise<WorkInjuryCaseFormValues | void>;
  onLoadAssignableStaff?: () => Promise<AssignableStaffResponse>;
  onLoadChangeLogs?: () => Promise<CaseChangeLog[]>;
  canEditAssignments?: boolean;
  canUpdateStatus?: boolean;
  canAddHearings?: boolean;
  canAddFollowUps?: boolean;
  canAddCollections?: boolean;
  canUpdateFees?: boolean;
  canViewChangeLogs?: boolean;
  canManageTimeNodes?: boolean;
}
const buildInitialValues = (): WorkInjuryCaseFormValues => {

  return {
    basicInfo: {
      caseType: 'work_injury',
      caseLevel: 'A',
      // hasContract: true,
      // hasSocialSecurity: false,
      // workInjuryCertified: false,
      // customerCooperative: true,
      // witnessCooperative: true
    },
    parties: {
      claimants: [{}],
      respondents: []
    },
    lawyerInfo: {
      hearingRecords: []
    },
    adminInfo: {
      caseStatus: 'open',
      collections: [],
      salesCommission: null,
      handlingFee: null
    },
    timeline: [],
    timeNodes: []
  };
};

export default function WorkInjuryCaseModal({
  open,
  mode = 'create',
  initialValues,
  initialActiveTab,
  allowEdit = false,
  onRequestEdit,
  onRequestView,
  onCancel,
  onSubmit,
  onSaveBasicInfo,
  onSaveParties,
  confirmLoading,
  onSaveAssignment,
  onSaveCaseStatus,
  onAddHearing,
  onAddFollowUp,
  onAddCollection,
  onUpdateFees,
  onSaveTimeNodes,
  onLoadAssignableStaff,
  onLoadChangeLogs,
  canEditAssignments = false,
  canUpdateStatus = false,
  canAddHearings = false,
  canAddFollowUps = false,
  canAddCollections = false,
  canUpdateFees = false,
  canViewChangeLogs = false,
  canManageTimeNodes = false
}: WorkInjuryCaseModalProps) {
  const sessionUser = useSessionStore(state => state.user);
  const { message } = App.useApp();
  const [form] = Form.useForm<WorkInjuryCaseFormValues>();
  const [assignmentForm] = Form.useForm<AssignStaffFormValues>();
  const [hearingForm] = Form.useForm<HearingFormValues>();
  const [followUpForm] = Form.useForm<FollowUpFormValues>();
  const [collectionForm] = Form.useForm<CollectionFormValues>();
  const [feeForm] = Form.useForm<FeeFormValues>();
  const [timeNodeForm] = Form.useForm<TimeNodeFormValues>();
  const [activeTab, setActiveTab] = useState<TabKey>(DEFAULT_ACTIVE_TAB);
  const [dirtySections, setDirtySections] = useState<Set<string>>(new Set());
  const [assignableStaff, setAssignableStaff] = useState<AssignableStaffResponse | null>(null);
  const [assignableStaffLoading, setAssignableStaffLoading] = useState(false);
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [basicInfoSaving, setBasicInfoSaving] = useState(false);
  const [partiesSaving, setPartiesSaving] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<CaseStatusValue>('open');
  const [pendingClosedReason, setPendingClosedReason] = useState<(typeof CASE_CLOSED_OPTIONS)[number] | null>(null);
  const [pendingVoidReason, setPendingVoidReason] = useState<(typeof CASE_VOID_OPTIONS)[number] | null>(null);
  const [hearingSaving, setHearingSaving] = useState(false);
  const [followUpSaving, setFollowUpSaving] = useState(false);
  const [collectionSaving, setCollectionSaving] = useState(false);
  const [feeSaving, setFeeSaving] = useState(false);
  const [timeNodeSaving, setTimeNodeSaving] = useState(false);
  const [changeLogs, setChangeLogs] = useState<CaseChangeLog[] | null>(null);
  const [changeLogsLoading, setChangeLogsLoading] = useState(false);
  const [changeLogsLoaded, setChangeLogsLoaded] = useState(false);

  const markDirty = useCallback((section: string) => {
    setDirtySections(prev => {
      if (prev.has(section)) {
        return prev;
      }
      const next = new Set(prev);
      next.add(section);
      return next;
    });
  }, []);

  const clearDirty = useCallback((section: string) => {
    setDirtySections(prev => {
      if (!prev.has(section)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(section);
      return next;
    });
  }, []);

  const resetDirty = useCallback(() => {
    setDirtySections(new Set());
  }, []);

  const isViewMode = mode === 'view';
  const hasTabChanges = useCallback(
    (tabKey: TabKey): boolean => {
      switch (tabKey) {
        case 'basic':
          return dirtySections.has('basic');
        case 'parties':
          return dirtySections.has('parties');
        case 'staff':
          return dirtySections.has('assignment');
        case 'hearing':
          return dirtySections.has('hearing');
        case 'timeNodes':
          return dirtySections.has('timeNodes');
        case 'followUp':
          return dirtySections.has('followUp');
        case 'fees':
          return dirtySections.has('collection') || dirtySections.has('fee');
        case 'changeLog':
        default:
          return false;
      }
    },
    [dirtySections]
  );

  const isUpdateMode = mode === 'update';
  const isEditable = !isViewMode;
  const isRestrictedEditor = sessionUser ? ['lawyer', 'assistant'].includes(sessionUser.role) : false;
  const canEditBasicInfo = isEditable && (!isRestrictedEditor || mode === 'create');
  const mainFormSaving = Boolean(confirmLoading);

  const baseInitialValues = useMemo(() => {
    if (mode === 'create') {
      return buildInitialValues();
    }
    return initialValues ?? buildInitialValues();
  }, [mode, initialValues]);

  const [cachedDisplayValues, setCachedDisplayValues] = useState<WorkInjuryCaseFormValues>(baseInitialValues);

  useEffect(() => {
    if (open) {
      setCachedDisplayValues(baseInitialValues);
    }
  }, [open, baseInitialValues]);

  const editableInitialValues = useMemo(() => {
    if (mode === 'create') {
      return cachedDisplayValues;
    }
    return initialValues ?? cachedDisplayValues ?? buildInitialValues();
  }, [mode, initialValues, cachedDisplayValues]);

  const displayValues = cachedDisplayValues;
  const currentStatus = useMemo(
    () => (displayValues.adminInfo?.caseStatus ?? 'open') as CaseStatusValue,
    [displayValues.adminInfo?.caseStatus]
  );

  useEffect(() => {
    setPendingStatus(currentStatus);
    setPendingClosedReason(displayValues.adminInfo?.closedReason ?? null);
    setPendingVoidReason(displayValues.adminInfo?.voidReason ?? null);
  }, [currentStatus, displayValues.adminInfo?.closedReason, displayValues.adminInfo?.voidReason]);
  const hearingRecords = useMemo(
    () => sortHearings(displayValues.lawyerInfo?.hearingRecords ?? []),
    [displayValues]
  );
  const availableTrialStages = useMemo(
    () => resolveAvailableTrialStages(hearingRecords),
    [hearingRecords]
  );
  const disabledTrialStages = useMemo(
    () => resolveDisabledTrialStages(hearingRecords),
    [hearingRecords]
  );
  const assignedLawyerId = displayValues.adminInfo?.assignedLawyer ?? null;
  const assignedLawyerName = displayValues.adminInfo?.assignedLawyerName ?? null;
  const assignedAssistantId = displayValues.adminInfo?.assignedAssistant ?? null;
  const assignedAssistantName = displayValues.adminInfo?.assignedAssistantName ?? null;

  const lawyerOptions = useMemo(() => {
    const optionMap = new Map<string, { value: string; label: string }>();
    (assignableStaff?.lawyers ?? []).forEach(member => {
      optionMap.set(member.id, {
        value: member.id,
        label: member.name ?? '未命名成员'
      });
    });

    if (assignedLawyerId) {
      const existingLabel = optionMap.get(assignedLawyerId)?.label;
      optionMap.set(assignedLawyerId, {
        value: assignedLawyerId,
        label: assignedLawyerName ?? existingLabel ?? '已分配成员'
      });
    }

    return Array.from(optionMap.values());
  }, [assignableStaff?.lawyers, assignedLawyerId, assignedLawyerName]);

  const assistantOptions = useMemo(() => {
    const optionMap = new Map<string, { value: string; label: string }>();
    (assignableStaff?.assistants ?? []).forEach(member => {
      optionMap.set(member.id, {
        value: member.id,
        label: member.name ?? '未命名成员'
      });
    });

    if (assignedAssistantId) {
      const existingLabel = optionMap.get(assignedAssistantId)?.label;
      optionMap.set(assignedAssistantId, {
        value: assignedAssistantId,
        label: assignedAssistantName ?? existingLabel ?? '已分配成员'
      });
    }

    return Array.from(optionMap.values());
  }, [assignableStaff?.assistants, assignedAssistantId, assignedAssistantName]);
  const caseStatusSelectOptions = useMemo(
    () =>
      CASE_STATUS_OPTIONS.map(status => ({
        value: status,
        label: CASE_STATUS_LABELS[status]
      })),
    []
  );
  const hearingStageOptions = useMemo(
    () =>
      TRIAL_STAGE_SEQUENCE.map(stage => ({
        value: stage,
        label: TRIAL_STAGE_LABEL_MAP[stage],
        disabled: disabledTrialStages.includes(stage)
      })),
    [disabledTrialStages]
  );

  const buildTimeNodeFormValues = useCallback((nodes?: CaseTimeNodeRecord[]): TimeNodeFormValues => {
    const values: TimeNodeFormValues = {};
    CASE_TIME_NODE_DEFINITIONS.forEach(definition => {
      values[definition.type] = null;
    });
    (nodes ?? []).forEach(node => {
      values[node.nodeType] = node.occurredOn ? dayjs(node.occurredOn) : null;
    });
    return values;
  }, []);

  const syncFormsFromValues = useCallback(
    (values: WorkInjuryCaseFormValues) => {
      form.setFieldsValue(values);
      const adminInfo = values.adminInfo ?? {};
      assignmentForm.setFieldsValue({
        assignedLawyerId: adminInfo.assignedLawyer ?? null,
        assignedAssistantId: adminInfo.assignedAssistant ?? null
      });
      feeForm.setFieldsValue({
        salesCommission: adminInfo.salesCommission ?? null,
        handlingFee: adminInfo.handlingFee ?? null
      });

      const hearings = sortHearings(values.lawyerInfo?.hearingRecords ?? []);
      const latestHearing = hearings.length ? hearings[hearings.length - 1] : null;
      const availableStages = resolveAvailableTrialStages(hearings);
      const defaultStage = availableStages.length ? availableStages[0] : null;
      const defaultTrialLawyerId =
        values.lawyerInfo?.trialLawyerId ??
        adminInfo.assignedLawyer ??
        null;

      hearingForm.setFieldsValue({
        trialLawyerId: defaultTrialLawyerId,
        hearingTime: null,
        hearingLocation: latestHearing?.hearingLocation ?? null,
        tribunal: latestHearing?.tribunal ?? null,
        judge: latestHearing?.judge ?? null,
        caseNumber: null,
        contactPhone: latestHearing?.contactPhone ?? null,
        trialStage: defaultStage,
        hearingResult: null
      });

      followUpForm.setFieldsValue({
        occurredOn: dayjs(),
        note: null
      });

      collectionForm.setFieldsValue({
        amount: null,
        receivedAt: dayjs()
      });

      timeNodeForm.setFieldsValue(buildTimeNodeFormValues(values.timeNodes));

      clearDirty('assignment');
      clearDirty('hearing');
      clearDirty('followUp');
      clearDirty('collection');
      clearDirty('fee');
      clearDirty('basic');
      clearDirty('parties');
      clearDirty('timeNodes');
    },
  [assignmentForm, buildTimeNodeFormValues, clearDirty, collectionForm, feeForm, followUpForm, form, hearingForm, timeNodeForm]
  );

  const applyUpdatedValues = useCallback(
    (values?: WorkInjuryCaseFormValues) => {
      if (!values) {
        return;
      }
      setCachedDisplayValues(values);
      if (isEditable) {
        form.resetFields();
        form.setFieldsValue(values);
      }
      syncFormsFromValues(values);
      resetDirty();
    },
    [form, isEditable, resetDirty, syncFormsFromValues]
  );

  useEffect(() => {
    if (open && isEditable) {
      form.resetFields();
      form.setFieldsValue(editableInitialValues);
      assignmentForm.resetFields();
      hearingForm.resetFields();
      followUpForm.resetFields();
      collectionForm.resetFields();
      feeForm.resetFields();
      resetDirty();
    } else if (!open) {
      form.resetFields();
      assignmentForm.resetFields();
      hearingForm.resetFields();
      followUpForm.resetFields();
      collectionForm.resetFields();
      feeForm.resetFields();
      setAssignableStaff(null);
      setChangeLogs(null);
      setChangeLogsLoaded(false);
      resetDirty();
    }
  }, [open, isEditable, editableInitialValues, form, assignmentForm, hearingForm, followUpForm, collectionForm, feeForm, resetDirty]);

  useEffect(() => {
    if (open) {
      syncFormsFromValues(displayValues);
    }
  }, [open, displayValues, syncFormsFromValues]);

  useEffect(() => {
    if (!isEditable) {
      resetDirty();
    }
  }, [isEditable, resetDirty]);

  const handleValuesChange = useCallback(
    (changedValues: Partial<WorkInjuryCaseFormValues>, _allValues: WorkInjuryCaseFormValues) => {
      if (!isEditable) {
        return;
      }
      if ('basicInfo' in changedValues) {
        markDirty('basic');
      }
      if ('parties' in changedValues) {
        markDirty('parties');
      }
    },
    [isEditable, markDirty]
  );

  const promptReason = useCallback(
    <T extends string>(title: string, options: readonly T[], initialValue: T | null) =>
      new Promise<T | undefined>(resolve => {
        let selected = initialValue ?? undefined;
        Modal.confirm({
          title,
          content: (
            <Select<T>
              style={{ width: '100%', marginTop: 12 }}
              placeholder="请选择"
              defaultValue={selected}
              options={options.map(item => ({ label: item, value: item }))}
              onChange={value => {
                selected = value;
              }}
            />
          ),
          okText: '确定',
          cancelText: '取消',
          onOk: () => {
            if (!selected) {
              message.error('请选择原因');
              return Promise.reject();
            }
            resolve(selected);
            return undefined;
          },
          onCancel: () => resolve(undefined)
        });
      }),
    [message]
  );

  const requestClosedReason = useCallback(
    (initialValue: (typeof CASE_CLOSED_OPTIONS)[number] | null) =>
      promptReason('请选择结案原因', CASE_CLOSED_OPTIONS, initialValue),
    [promptReason]
  );

  const requestVoidReason = useCallback(
    (initialValue: (typeof CASE_VOID_OPTIONS)[number] | null) =>
      promptReason('请选择退单原因', CASE_VOID_OPTIONS, initialValue),
    [promptReason]
  );

  const ensureStatusDetails = useCallback(
    async (nextStatus: CaseStatusValue): Promise<CaseStatusFormValues | undefined> => {
      if (nextStatus === 'closed') {
        const reason = await requestClosedReason(pendingClosedReason);
        if (reason === undefined) {
          return undefined;
        }
        return {
          caseStatus: nextStatus,
          closedReason: reason,
          voidReason: null
        };
      }
      if (nextStatus === 'void') {
        const reason = await requestVoidReason(pendingVoidReason);
        if (reason === undefined) {
          return undefined;
        }
        return {
          caseStatus: nextStatus,
          closedReason: null,
          voidReason: reason
        };
      }
      return { caseStatus: nextStatus, closedReason: null, voidReason: null };
    },
    [pendingClosedReason, pendingVoidReason, requestClosedReason, requestVoidReason]
  );

  const handleStatusSelectChange = useCallback(
    async (nextStatus: CaseStatusValue) => {
      if (!isEditable) {
        return;
      }
      const previousStatus = pendingStatus;
      const previousClosedReason = pendingClosedReason;
      const previousVoidReason = pendingVoidReason;
      if (nextStatus === previousStatus && mode !== 'create') {
        return;
      }
      setPendingStatus(nextStatus);
      const details = await ensureStatusDetails(nextStatus);
      if (!details) {
        setPendingStatus(previousStatus);
        return;
      }

      if (mode === 'create') {
        setPendingClosedReason(details.closedReason ?? null);
        setPendingVoidReason(details.voidReason ?? null);
        setCachedDisplayValues(prev => {
          const nextAdmin = {
            ...(prev.adminInfo ?? {}),
            caseStatus: details.caseStatus
          } as NonNullable<WorkInjuryCaseFormValues['adminInfo']>;
          if (details.closedReason) {
            nextAdmin.closedReason = details.closedReason;
          } else {
            delete nextAdmin.closedReason;
          }
          if (details.voidReason) {
            nextAdmin.voidReason = details.voidReason;
          } else {
            delete nextAdmin.voidReason;
          }
          return {
            ...prev,
            adminInfo: nextAdmin
          };
        });
        form.setFieldsValue({
          adminInfo: {
            ...(form.getFieldValue('adminInfo') ?? {}),
            caseStatus: details.caseStatus,
            closedReason: details.closedReason ?? undefined,
            voidReason: details.voidReason ?? undefined
          }
        });
        return;
      }

      if (!canUpdateStatus || !onSaveCaseStatus) {
        message.error('您没有权限更新案件状态');
        setPendingStatus(previousStatus);
        return;
      }

      setPendingClosedReason(details.closedReason ?? null);
      setPendingVoidReason(details.voidReason ?? null);
      setStatusUpdating(true);
      try {
        const updated = await onSaveCaseStatus(details);
        if (updated !== undefined) {
          applyUpdatedValues(updated);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '更新案件状态失败，请稍后重试';
        message.error(errorMessage);
        setPendingStatus(previousStatus);
        setPendingClosedReason(previousClosedReason);
        setPendingVoidReason(previousVoidReason);
      } finally {
        setStatusUpdating(false);
      }
    },
    [
      applyUpdatedValues,
      canUpdateStatus,
      ensureStatusDetails,
      form,
      isEditable,
      message,
      mode,
      onSaveCaseStatus,
      pendingClosedReason,
      pendingStatus,
      pendingVoidReason,
      setCachedDisplayValues
    ]
  );

  const confirmDiscardChanges = useCallback(
    async (tabKey: TabKey) => {
      if (!hasTabChanges(tabKey)) {
        return true;
      }

      return new Promise<boolean>(resolve => {
        Modal.confirm({
          title: '仍有未保存的修改，确定要离开吗？',
          content: '放弃更改后当前 Tab 的内容将不会保存。',
          okText: '放弃修改',
          cancelText: '继续编辑',
          onOk: () => resolve(true),
          onCancel: () => resolve(false)
        });
      });
    },
    [hasTabChanges]
  );

  const handleCancel = useCallback(async () => {
    if (isEditable) {
      const canLeave = await confirmDiscardChanges(activeTab);
      if (canLeave) {
        form.resetFields();
        form.setFieldsValue(cachedDisplayValues);
        resetDirty();
        syncFormsFromValues(cachedDisplayValues);
        if (onRequestView) {
          onRequestView();
        } else {
          onCancel();
        }
      }
    } else {
      form.resetFields();
      syncFormsFromValues(cachedDisplayValues);
      onCancel();
    }
  }, [activeTab, cachedDisplayValues, confirmDiscardChanges, form, isEditable, onCancel, onRequestView, resetDirty, syncFormsFromValues]);

  const handleBasicInfoReset = useCallback(() => {
    if (!canEditBasicInfo) {
      return;
    }
    const nextBasicInfo = displayValues.basicInfo ?? {};
    form.setFieldsValue({ basicInfo: nextBasicInfo });
    clearDirty('basic');
  }, [canEditBasicInfo, clearDirty, displayValues, form]);

  const handlePartiesReset = useCallback(() => {
    if (!isEditable) {
      return;
    }
    const currentParties = displayValues.parties ?? {};
    const nextClaimants = currentParties.claimants && currentParties.claimants.length > 0
      ? currentParties.claimants
      : [{}];
    form.setFieldsValue({
      parties: {
        claimants: nextClaimants,
        respondents: currentParties.respondents ?? []
      }
    });
    clearDirty('parties');
  }, [clearDirty, displayValues, form, isEditable]);

  const handleAssignmentReset = useCallback(() => {
    if (!isEditable) {
      return;
    }
    const adminInfo = displayValues.adminInfo ?? {};
    assignmentForm.setFieldsValue({
      assignedLawyerId: adminInfo.assignedLawyer ?? null,
      assignedAssistantId: adminInfo.assignedAssistant ?? null
    });
    clearDirty('assignment');
  }, [assignmentForm, clearDirty, displayValues, isEditable]);

  const handleHearingReset = useCallback(() => {
    if (!isEditable) {
      return;
    }
    const latestHearing = hearingRecords.length ? hearingRecords[hearingRecords.length - 1] : null;
    const defaultStage = availableTrialStages.length ? availableTrialStages[0] : null;
    const defaultTrialLawyerId =
      displayValues.lawyerInfo?.trialLawyerId ?? displayValues.adminInfo?.assignedLawyer ?? null;

    hearingForm.setFieldsValue({
      trialLawyerId: defaultTrialLawyerId,
      hearingTime: null,
      hearingLocation: latestHearing?.hearingLocation ?? null,
      tribunal: latestHearing?.tribunal ?? null,
      judge: latestHearing?.judge ?? null,
      caseNumber: null,
      contactPhone: latestHearing?.contactPhone ?? null,
      trialStage: defaultStage,
      hearingResult: null
    });
    clearDirty('hearing');
  }, [availableTrialStages, clearDirty, displayValues, hearingForm, hearingRecords, isEditable]);

  const handleFollowUpReset = useCallback(() => {
    if (!isEditable) {
      return;
    }
    followUpForm.setFieldsValue({
      occurredOn: dayjs(),
      note: null
    });
    clearDirty('followUp');
  }, [clearDirty, followUpForm, isEditable]);

  const handleTimeNodeReset = useCallback(() => {
    timeNodeForm.setFieldsValue(buildTimeNodeFormValues(displayValues.timeNodes));
    clearDirty('timeNodes');
  }, [buildTimeNodeFormValues, clearDirty, displayValues.timeNodes, timeNodeForm]);

  const handleTimeNodeSave = useCallback(async () => {
    if (!onSaveTimeNodes || !canManageTimeNodes) {
      return;
    }

    const formValues = timeNodeForm.getFieldsValue() as TimeNodeFormValues;
    const payload = CASE_TIME_NODE_DEFINITIONS.reduce<Array<{ nodeType: CaseTimeNodeType; occurredOn: Dayjs }>>(
      (acc, definition) => {
        const value = formValues[definition.type];
        if (value) {
          acc.push({ nodeType: definition.type, occurredOn: value });
        }
        return acc;
      },
      []
    );

    if (payload.length === 0) {
      message.error('请至少填写一个时间节点');
      return;
    }

    setTimeNodeSaving(true);
    try {
      const updated = await onSaveTimeNodes(payload);
      if (updated !== undefined) {
        applyUpdatedValues(updated);
        message.success('时间节点已更新');
      }
      clearDirty('timeNodes');
    } catch (error) {
      message.error('保存时间节点失败，请稍后重试');
    } finally {
      setTimeNodeSaving(false);
    }
  }, [
    applyUpdatedValues,
    canManageTimeNodes,
    clearDirty,
    message,
    onSaveTimeNodes,
    timeNodeForm
  ]);

  const handleBasicInfoSave = useCallback(async () => {
    if (!canEditBasicInfo) {
      return;
    }
    try {
      await form.validateFields(['basicInfo']);
    } catch (error) {
      if ((error as { errorFields?: unknown[] })?.errorFields) {
        message.error('请完善基本信息');
        return;
      }
      throw error;
    }
    const basicValues = form.getFieldValue('basicInfo') as WorkInjuryCaseFormValues['basicInfo'];
    const shouldUseGlobalSubmit = mode === 'create' || (!onSaveBasicInfo && onSubmit);

    if (shouldUseGlobalSubmit) {
      if (!onSubmit) {
        return;
      }
      const allValues = form.getFieldsValue(true) as WorkInjuryCaseFormValues;
      const maybeUpdated = await onSubmit(allValues);
      if (maybeUpdated !== undefined) {
        applyUpdatedValues(maybeUpdated);
        if (isUpdateMode) {
          message.success('基本信息已保存');
        }
      }
      return;
    }

    if (!onSaveBasicInfo) {
      return;
    }

    setBasicInfoSaving(true);
    try {
      const maybeUpdated = await onSaveBasicInfo(basicValues ?? {});
      if (maybeUpdated !== undefined) {
        applyUpdatedValues(maybeUpdated);
      }
      clearDirty('basic');
    } finally {
      setBasicInfoSaving(false);
    }
  }, [
    applyUpdatedValues,
    canEditBasicInfo,
    clearDirty,
    form,
    isUpdateMode,
    message,
    mode,
    onSaveBasicInfo,
    onSubmit
  ]);

  const handlePartiesSave = useCallback(async () => {
    if (!isEditable) {
      return;
    }
    try {
      await form.validateFields(['parties']);
    } catch (error) {
      if ((error as { errorFields?: unknown[] })?.errorFields) {
        message.error('请完善当事人信息');
        return;
      }
      throw error;
    }

    const partiesValues = form.getFieldValue('parties') as WorkInjuryCaseFormValues['parties'];
    const shouldUseGlobalSubmit = mode === 'create' || (!onSaveParties && onSubmit);

    if (shouldUseGlobalSubmit) {
      if (!onSubmit) {
        return;
      }
      const allValues = form.getFieldsValue(true) as WorkInjuryCaseFormValues;
      const maybeUpdated = await onSubmit(allValues);
      if (maybeUpdated !== undefined) {
        applyUpdatedValues(maybeUpdated);
        if (isUpdateMode) {
          message.success('当事人信息已保存');
        }
      }
      return;
    }

    if (!onSaveParties) {
      return;
    }

    setPartiesSaving(true);
    try {
      const maybeUpdated = await onSaveParties(partiesValues ?? {});
      if (maybeUpdated !== undefined) {
        applyUpdatedValues(maybeUpdated);
      }
      clearDirty('parties');
    } finally {
      setPartiesSaving(false);
    }
  }, [
    applyUpdatedValues,
    clearDirty,
    form,
    isEditable,
    isUpdateMode,
    message,
    mode,
    onSaveParties,
    onSubmit
  ]);

  const canShowEditButton = Boolean(allowEdit && onRequestEdit && sessionUser);

  const canShowCollectionSection = Boolean(
    sessionUser &&
    CASE_COLLECTION_ALLOWED_ROLES.has(sessionUser.role)
  );

  const ensureAssignableStaff = useCallback(async (force = false) => {
    if (!onLoadAssignableStaff) {
      return;
    }
    if (!force && assignableStaff) {
      return;
    }
    setAssignableStaffLoading(true);
    try {
      const data = await onLoadAssignableStaff();
      setAssignableStaff(data);
    } catch (error) {
      message.error('获取可分配成员失败，请稍后重试');
    } finally {
      setAssignableStaffLoading(false);
    }
  }, [assignableStaff, message, onLoadAssignableStaff]);

  const loadChangeLogs = useCallback(async () => {
    if (!onLoadChangeLogs || changeLogsLoaded) {
      return;
    }
    setChangeLogsLoading(true);
    try {
      const logs = await onLoadChangeLogs();
      setChangeLogs(logs);
      setChangeLogsLoaded(true);
    } catch (error) {
      message.error('获取变更日志失败，请稍后重试');
    } finally {
      setChangeLogsLoading(false);
    }
  }, [changeLogsLoaded, message, onLoadChangeLogs]);

  useEffect(() => {
    if (!open) {
      setActiveTab(DEFAULT_ACTIVE_TAB);
      return;
    }
    const targetTab =
      initialActiveTab && isTabKey(initialActiveTab) ? initialActiveTab : DEFAULT_ACTIVE_TAB;
    setActiveTab(targetTab);
  }, [open, initialActiveTab]);

  useEffect(() => {
    if (!open) {
      return;
    }
    if (activeTab === 'changeLog') {
      void loadChangeLogs();
    }
    if (isEditable && (activeTab === 'staff' || activeTab === 'hearing')) {
      void ensureAssignableStaff();
    }
  }, [activeTab, ensureAssignableStaff, isEditable, loadChangeLogs, open]);

  const handleAssignmentSave = useCallback(async () => {
    if (!onSaveAssignment) {
      return;
    }
    let values: AssignStaffFormValues;
    try {
      values = await assignmentForm.validateFields();
    } catch (error) {
      if ((error as { errorFields?: unknown[] })?.errorFields) {
        message.error('请检查人员分配信息是否填写完整');
        return;
      }
      throw error;
    }
    setAssignmentSaving(true);
    try {
      const payload: AssignStaffFormValues = {
        assignedLawyerId: values.assignedLawyerId ?? null,
        assignedAssistantId: values.assignedAssistantId ?? null
      };
      const updated = await onSaveAssignment(payload);
      if (updated !== undefined) {
        applyUpdatedValues(updated);
      }
      clearDirty('assignment');
    } finally {
      setAssignmentSaving(false);
    }
  }, [applyUpdatedValues, assignmentForm, clearDirty, message, onSaveAssignment]);

  const handleHearingSave = useCallback(async () => {
    if (!onAddHearing) {
      return;
    }
    let values: HearingFormValues;
    try {
      values = await hearingForm.validateFields();
    } catch (error) {
      if ((error as { errorFields?: unknown[] })?.errorFields) {
        message.error('请完善庭审信息');
        return;
      }
      throw error;
    }
    setHearingSaving(true);
    try {
      const updated = await onAddHearing({
        trialLawyerId: values.trialLawyerId ?? null,
        hearingTime: values.hearingTime ?? null,
        hearingLocation: values.hearingLocation ?? null,
        tribunal: values.tribunal ?? null,
        judge: values.judge ?? null,
        caseNumber: values.caseNumber ?? null,
        contactPhone: values.contactPhone ?? null,
        trialStage: values.trialStage ?? null,
        hearingResult: values.hearingResult ?? null
      });
      if (updated !== undefined) {
        applyUpdatedValues(updated);
      }
      clearDirty('hearing');
    } finally {
      setHearingSaving(false);
    }
  }, [applyUpdatedValues, clearDirty, hearingForm, message, onAddHearing]);

  const handleFollowUpSave = useCallback(async () => {
    if (!onAddFollowUp) {
      return;
    }
    let values: FollowUpFormValues;
    try {
      values = await followUpForm.validateFields();
    } catch (error) {
      if ((error as { errorFields?: unknown[] })?.errorFields) {
        message.error('请填写有效的跟进备注');
        return;
      }
      throw error;
    }
    if (!values.occurredOn) {
      message.error('请选择发生日期');
      return;
    }
    setFollowUpSaving(true);
    try {
      const updated = await onAddFollowUp({
        occurredOn: values.occurredOn,
        note: values.note ?? null
      });
      if (updated !== undefined) {
        applyUpdatedValues(updated);
      }
      clearDirty('followUp');
    } finally {
      setFollowUpSaving(false);
    }
  }, [applyUpdatedValues, clearDirty, followUpForm, message, onAddFollowUp]);

  const handleCollectionSave = useCallback(async () => {
    if (!onAddCollection) {
      return;
    }
    let values: CollectionFormValues;
    try {
      values = await collectionForm.validateFields();
    } catch (error) {
      if ((error as { errorFields?: unknown[] })?.errorFields) {
        message.error('请填写有效的回款记录');
        return;
      }
      throw error;
    }
    if (!values.amount || !values.receivedAt) {
      message.error('请填写回款金额和日期');
      return;
    }
    setCollectionSaving(true);
    try {
      const updated = await onAddCollection({
        amount: values.amount,
        receivedAt: values.receivedAt
      });
      if (updated !== undefined) {
        applyUpdatedValues(updated);
      }
      clearDirty('collection');
    } finally {
      setCollectionSaving(false);
    }
  }, [applyUpdatedValues, clearDirty, collectionForm, message, onAddCollection]);

  const handleFeeSave = useCallback(async () => {
    if (!onUpdateFees) {
      return;
    }
    let values: FeeFormValues;
    try {
      values = await feeForm.validateFields();
    } catch (error) {
      if ((error as { errorFields?: unknown[] })?.errorFields) {
        message.error('请检查费用信息是否填写完整');
        return;
      }
      throw error;
    }
    setFeeSaving(true);
    try {
      const updated = await onUpdateFees({
        salesCommission: values.salesCommission ?? null,
        handlingFee: values.handlingFee ?? null
      });
      if (updated !== undefined) {
        applyUpdatedValues(updated);
      }
      clearDirty('fee');
    } finally {
      setFeeSaving(false);
    }
  }, [applyUpdatedValues, clearDirty, feeForm, message, onUpdateFees]);

  const viewFooter = [
    <Button key="close" onClick={handleCancel}>
      关闭
    </Button>,
    ...(canShowEditButton
      ? [
          <Button key="edit" type="primary" onClick={onRequestEdit}>
            编辑案件
          </Button>
        ]
      : [])
  ];

  const renderPartyList = (field: 'claimants' | 'respondents', title: string) => (
    <Form.List
      name={['parties', field]}
      rules={[
        {
          validator: async (_, value) => {
            if (field === 'claimants' && (!value || value.length === 0)) {
              return Promise.reject(new Error(`请至少添加一位${title}`));
            }
            return Promise.resolve();
          }
        }
      ]}
    >
      {(fields, { add, remove }) => (
        <>
          {fields.map(({ key, name, ...restField }) => (
            <Row gutter={12} key={key} align="middle">
              <Col span={8}>
                <Form.Item
                  {...restField}
                  name={[name, 'entityType']}
                  label="类型"
                  rules={[{ required: true, message: '请选择类型' }]}
                >
                  <Select options={[...ENTITY_TYPES]} placeholder="请选择" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  noStyle
                  shouldUpdate={(prev, curr) =>
                    prev?.parties?.[field]?.[name]?.entityType !==
                    curr?.parties?.[field]?.[name]?.entityType
                  }
                >
                  {() => {
                    const entityType = form.getFieldValue([
                      'parties',
                      field,
                      name,
                      'entityType'
                    ]) as 'personal' | 'organization' | undefined;
                    const isOrganization = entityType === 'organization';
                    const nameLabel = isOrganization ? '名称' : '姓名';
                    return (
                      <Form.Item
                        {...restField}
                        name={[name, 'name']}
                        label={nameLabel}
                        rules={[{ required: true, message: `请输入${nameLabel}` }]}
                      >
                        <Input placeholder={`请输入${nameLabel}`} />
                      </Form.Item>
                    );
                  }}
                </Form.Item>
              </Col>
              
              <Col span={8}>
                <Form.Item
                  noStyle
                  shouldUpdate={(prev, curr) =>
                    prev?.parties?.[field]?.[name]?.entityType !==
                    curr?.parties?.[field]?.[name]?.entityType
                  }
                >
                  {() => {
                    const entityType = form.getFieldValue([
                      'parties',
                      field,
                      name,
                      'entityType'
                    ]) as 'personal' | 'organization' | undefined;
                    const isOrganization = entityType === 'organization';
                    const idLabel = isOrganization ? '统一信用代码' : '身份证';
                    const idRules = field === 'claimants'
                      ? [{ required: true, message: `请输入${idLabel}` }]
                      : [];
                    return (
                      <Form.Item
                        {...restField}
                        name={[name, 'idNumber']}
                        label={idLabel}
                        rules={idRules}
                      >
                        <Input placeholder={`请输入${idLabel}`} />
                      </Form.Item>
                    );
                  }}
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item 
                {...restField}
                 name={[name, 'phone']} 
                 label="电话"
                 rules={[{required: field === 'claimants', message: '请输入联系电话'}]}
                 >
                  <Input placeholder="请输入联系电话" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item 
                {...restField} 
                name={[name, 'address']} 
                label="地址"
                >
                  <Input placeholder="请输入地址" />
                </Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item
                  {...restField}
                  name={[name, 'isDishonest']}
                  label="是否失信"
                  rules={[{ required: true, message: '请选择是否失信' }]}
                  initialValue={false}
                >
                  <Radio.Group options={[...YES_NO_COOPERATION]} optionType="button" buttonStyle="solid" />
                </Form.Item>
              </Col>
              <Col span={4}>
                {fields.length > 1 ? (
                  <Button type="text" icon={<MinusCircleOutlined />} onClick={() => remove(name)}>
                    删除
                  </Button>
                ) : null}
              </Col>
            </Row>
          ))}
          <Button
            type="dashed"
            icon={<PlusOutlined />}
            block
            onClick={() => add({ entityType: 'personal', isDishonest: false })}
          >
            添加{title}
          </Button>
        </>
      )}
    </Form.List>
  );

  const basicInfoPane = (
    <>
      <Row gutter={16}>
        <Col span={8}>
          <Form.Item
            label="案件类型"
            name={['basicInfo', 'caseType']}
            rules={[{ required: true, message: '请选择案件类型' }]}
          >
            <Select options={[...CASE_TYPES]} placeholder="请选择案件类型" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item
            label="案件级别"
            name={['basicInfo', 'caseLevel']}
            rules={[{ required: true, message: '请选择案件级别' }]}
          >
            <Select options={[...CASE_LEVELS]} placeholder="请选择案件级别" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item
            label="案件省份/城市"
            name={['basicInfo', 'provinceCity']}
            rules={[{ required: true, message: '请输入案件省份/城市' }]}
          >
            <Input placeholder="请输入省份/城市" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item
            label="标的额"
            name={['basicInfo', 'targetAmount']}
          >
            <Input style={{ width: '100%' }} placeholder="请输入标的额" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="收费标准" name={['basicInfo', 'feeStandard']}>
            <Input placeholder="请输入收费标准" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="代理费估值" name={['basicInfo', 'agencyFeeEstimate']}>
            <Input style={{ width: '100%' }} placeholder="请输入代理费估值" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item
            label="数据来源"
            name={['basicInfo', 'dataSource']}
            rules={[{ required: true, message: '请输入数据来源' }]}
          >
            <Input placeholder="请输入数据来源" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="入职时间" name={['basicInfo', 'entryDate']}>
            <DatePicker style={{ width: '100%' }} placeholder="请选择入职时间" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="受伤地点" name={['basicInfo', 'injuryLocation']}>
            <Input placeholder="请输入受伤地点" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="受伤程度" name={['basicInfo', 'injurySeverity']}>
            <Input placeholder="请输入受伤程度" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="受伤原因" name={['basicInfo', 'injuryCause']}>
            <Input placeholder="请输入受伤原因" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item
            label="工伤认定"
            name={['basicInfo', 'workInjuryCertified']}
            rules={[{ required: false, message: '请选择工伤认定情况' }]}
          >
            <Radio.Group options={[...YES_NO_RADIO]} optionType="button" buttonStyle="solid" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="劳动能力等级鉴定/人损等级" name={['basicInfo', 'appraisalLevel']}>
            <Input placeholder="请输入鉴定等级或填写无" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="劳动能力/人损等级预估" name={['basicInfo', 'appraisalEstimate']}>
            <Input placeholder="请输入预估等级" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item label="当时月薪" name={['basicInfo', 'monthlySalary']}>
            <Input style={{ width: '100%' }} placeholder="请输入当时月薪" />
          </Form.Item>
        </Col>
        <Col span={6}>
          <Form.Item
            label="是否配合提交材料"
            name={['basicInfo', 'customerCooperative']}
            rules={[{ required: false, message: '请选择是否能配合提交材料' }]}
          >
            <Radio.Group options={[...YES_NO_COOPERATION]} optionType="button" buttonStyle="solid" />
          </Form.Item>
        </Col>
        <Col span={5}>
          <Form.Item
            label="有无合同"
            name={['basicInfo', 'hasContract']}
            rules={[{ required: false, message: '请选择是否有合同' }]}
          >
            <Radio.Group options={[...YES_NO_RADIO]} optionType="button" buttonStyle="solid" />
          </Form.Item>
        </Col>
        <Col span={5}>
          <Form.Item
            label="有无社保"
            name={['basicInfo', 'hasSocialSecurity']}
            rules={[{ required: false, message: '请选择是否有社保' }]}
          >
            <Radio.Group options={[...YES_NO_RADIO]} optionType="button" buttonStyle="solid" />
          </Form.Item>
        </Col>
        <Col span={8}>
          <Form.Item
            label="证人是否配合出庭"
            name={['basicInfo', 'witnessCooperative']}
            rules={[{ required: false, message: '请选择证人是否能配合出庭' }]}
          >
            <Radio.Group options={[...YES_NO_COOPERATION]} optionType="button" buttonStyle="solid" />
          </Form.Item>
        </Col>
        <Col span={24}>
          <Form.Item label="已知证据" name={['basicInfo', 'existingEvidence']}>
            <TextArea rows={3} placeholder="请描述已掌握的证据" />
          </Form.Item>
        </Col>
        <Col span={24}>
          <Form.Item label="备注" name={['basicInfo', 'remark']}>
            <TextArea rows={3} placeholder="可补充其他情况" />
          </Form.Item>
        </Col>
      </Row>
    </>
  );

  const personnelPane = (
    <>
      <Typography.Title level={5}>当事人</Typography.Title>
      {renderPartyList('claimants', '当事人')}
      <Divider dashed />
      <Typography.Title level={5}>对方当事人</Typography.Title>
      {renderPartyList('respondents', '对方当事人')}
    </>
  );

  const staffEditPane = (
    <div className={styles.sectionList}>
      <Typography.Title level={5}>人员分配</Typography.Title>
      {onSaveAssignment ? (
        <Spin spinning={assignableStaffLoading}>
          <Form
            form={assignmentForm}
            layout="vertical"
            component={false}
            disabled={!canEditAssignments}
            onValuesChange={() => markDirty('assignment')}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="承办律师"
                  name="assignedLawyerId"
                  rules={[{ required: true, message: '请选择承办律师' }]}
                >
                  <Select
                    placeholder="请选择承办律师"
                    options={lawyerOptions}
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    loading={assignableStaffLoading}
                    disabled={!canEditAssignments}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="律师助理" name="assignedAssistantId">
                  <Select
                    placeholder="请选择律师助理"
                    options={assistantOptions}
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    loading={assignableStaffLoading}
                    disabled={!canEditAssignments}
                  />
                </Form.Item>
              </Col>
            </Row>
            {onLoadAssignableStaff ? (
              <Space size="middle" wrap style={{ marginTop: 16 }}>
                <Button
                  type="link"
                  onClick={() => void ensureAssignableStaff(true)}
                  disabled={assignableStaffLoading}
                >
                  刷新可分配成员
                </Button>
              </Space>
            ) : null}
          </Form>
        </Spin>
      ) : (
        <Typography.Text type="secondary" className={styles.emptyHint}>
          暂无权限调整人员分配
        </Typography.Text>
      )}
    </div>
  );

  const canAddMoreHearings = availableTrialStages.length > 0;
  const canShowHearingForm = Boolean(onAddHearing && canAddHearings);

  const hearingEditPane = (
    <div className={styles.sectionList}>
      {canShowHearingForm ? (
        <>
          <Typography.Title level={5}>新增庭审记录</Typography.Title>
          {!canAddMoreHearings ? (
            <Typography.Text type="secondary" className={styles.emptyHint}>
              所有审理阶段均已记录或前序阶段未完成，暂无法新增新的庭审记录。
            </Typography.Text>
          ) : null}
          <Form
            form={hearingForm}
            layout="vertical"
            component={false}
            disabled={!canAddHearings || !canAddMoreHearings}
            onValuesChange={() => markDirty('hearing')}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="开庭律师"
                  name="trialLawyerId"
                  rules={[{ required: true, message: '请选择开庭律师' }]}
                >
                  <Select
                    placeholder="请选择开庭律师"
                    options={lawyerOptions}
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    disabled={!canAddHearings || !canAddMoreHearings}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="审理阶段"
                  name="trialStage"
                  rules={[{ required: true, message: '请选择审理阶段' }]}
                >
                  <Select
                    placeholder="请选择审理阶段"
                    options={hearingStageOptions}
                    disabled={!canAddHearings || !canAddMoreHearings}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="庭审时间" name="hearingTime">
                  <DatePicker
                    showTime
                    style={{ width: '100%' }}
                    placeholder="请选择庭审时间"
                    format="YYYY-MM-DD HH:mm"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="法院" name="hearingLocation">
                  <Input placeholder="请输入法院" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="判庭" name="tribunal">
                  <Input placeholder="请输入判庭" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="主审法官" name="judge">
                  <Input placeholder="请输入主审法官" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="联系电话" name="contactPhone">
                  <Input placeholder="请输入联系电话" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item label="案号" name="caseNumber">
                  <Input placeholder="请输入案号" />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item label="庭审结果" name="hearingResult">
                  <TextArea rows={3} placeholder="请输入庭审结果" />
                </Form.Item>
              </Col>
            </Row>
          </Form>
          <Divider dashed />
        </>
      ) : null}
      {renderHearingDisplay(displayValues)}
    </div>
  );

  const timeNodePane = (
    <div className={styles.sectionList}>
      {isEditable ? (
        <>
          {canManageTimeNodes ? (
            <>
              <Typography.Title level={5}>维护时间节点</Typography.Title>
              <Form
                form={timeNodeForm}
                layout="vertical"
                component={false}
                onValuesChange={() => markDirty('timeNodes')}
              >
                <Row gutter={16}>
                  {CASE_TIME_NODE_DEFINITIONS.map(definition => (
                    <Col span={12} key={definition.type}>
                      <Form.Item label={definition.label} name={definition.type}>
                        <DatePicker
                          style={{ width: '100%' }}
                          placeholder="请选择日期"
                          allowClear
                          format="YYYY-MM-DD"
                        />
                      </Form.Item>
                    </Col>
                  ))}
                </Row>
              </Form>
              <Divider dashed />
            </>
          ) : (
            <>
              <Typography.Text type="secondary" className={styles.emptyHint}>
                当前角色不可编辑时间节点
              </Typography.Text>
              <Divider dashed />
            </>
          )}
        </>
      ) : null}
      {renderTimeNodeDisplay(displayValues)}
    </div>
  );

  const followUpEditPane = (
    <div className={styles.sectionList}>
      {isEditable ? (
        <>
        {
          onAddFollowUp ? (
        <>
          <Typography.Title level={5}>新增跟进备注</Typography.Title>
          <Form
            form={followUpForm}
            layout="vertical"
            component={false}
            disabled={!canAddFollowUps}
            onValuesChange={() => markDirty('followUp')}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="发生日期"
                  name="occurredOn"
                  rules={[{ required: true, message: '请选择发生日期' }]}
                >
                  <DatePicker style={{ width: '100%' }} placeholder="请选择发生日期" />
                </Form.Item>
              </Col>
              <Col span={24}>
                <Form.Item
                  label="备注"
                  name="note"
                  rules={[{ required: true, message: '请填写跟进备注' }]}
                >
                  <TextArea rows={4} maxLength={500} showCount placeholder="请填写跟进备注" />
                </Form.Item>
              </Col>
            </Row>
          </Form>
        </>
      ) : (
        <Typography.Text type="secondary" className={styles.emptyHint}>
          暂无权限新增跟进备注
        </Typography.Text>
      )
        }
      <Divider dashed />
        </>
      ) : null}
      {renderFollowUpDisplay(displayValues)}
    </div>
  );


  const renderBasicInfoDisplay = (values: WorkInjuryCaseFormValues) => {
    const info = values.basicInfo ?? {};
    return (
      <Descriptions bordered size="small" column={2} className={styles.descriptions}>
        <Descriptions.Item label="案件类型">{formatOptionLabel(CASE_TYPE_LABEL_MAP, info.caseType ?? null)}</Descriptions.Item>
        <Descriptions.Item label="案件级别">{formatOptionLabel(CASE_LEVEL_LABEL_MAP, info.caseLevel ?? null)}</Descriptions.Item>
        <Descriptions.Item label="省份/城市">{formatText(info.provinceCity)}</Descriptions.Item>
        <Descriptions.Item label="标的额">{formatText(info.targetAmount)}</Descriptions.Item>
        <Descriptions.Item label="收费标准">{formatText(info.feeStandard)}</Descriptions.Item>
        <Descriptions.Item label="代理费估值">{formatText(info.agencyFeeEstimate)}</Descriptions.Item>
        <Descriptions.Item label="数据来源">{formatText(info.dataSource)}</Descriptions.Item>
        <Descriptions.Item label="入职时间">{formatDate(info.entryDate ?? null)}</Descriptions.Item>
        <Descriptions.Item label="受伤地点">{formatText(info.injuryLocation)}</Descriptions.Item>
        <Descriptions.Item label="受伤程度">{formatText(info.injurySeverity)}</Descriptions.Item>
        <Descriptions.Item label="受伤原因" span={3}>{formatText(info.injuryCause)}</Descriptions.Item>
        <Descriptions.Item label="工伤认定">{formatBoolean(info.workInjuryCertified ?? null, '有', '无')}</Descriptions.Item>
        <Descriptions.Item label="劳动能力等级鉴定/人损等级">{formatText(info.appraisalLevel)}</Descriptions.Item>
        <Descriptions.Item label="劳动能力/人损等级预估">{formatText(info.appraisalEstimate)}</Descriptions.Item>
        <Descriptions.Item label="当时月薪">{formatText(info.monthlySalary)}</Descriptions.Item>
        <Descriptions.Item label="是否配合提交材料">{formatBoolean(info.customerCooperative ?? null, '是', '否')}</Descriptions.Item>
        <Descriptions.Item label="有无合同">{formatBoolean(info.hasContract ?? null, '有', '无')}</Descriptions.Item>
        <Descriptions.Item label="有无社保">{formatBoolean(info.hasSocialSecurity ?? null, '有', '无')}</Descriptions.Item>
        <Descriptions.Item label="证人是否配合出庭">{formatBoolean(info.witnessCooperative ?? null, '是', '否')}</Descriptions.Item>
        <Descriptions.Item label="已知证据" span={3}>{formatText(info.existingEvidence)}</Descriptions.Item>
        <Descriptions.Item label="备注" span={3}>{formatText(info.remark)}</Descriptions.Item>
      </Descriptions>
    );
  };

  const renderPartyDisplay = (values: WorkInjuryCaseFormValues) => {
    const parties = values.parties ?? {};
    const renderPartyGroup = (list: CaseParty[] | undefined, title: string) => {
      if (!list || list.length === 0) {
        return (
          <Typography.Text type="secondary" className={styles.emptyHint}>
            暂无{title}
          </Typography.Text>
        );
      }
      return list.map((party, index) => (
        <Descriptions
          key={`${title}-${index}`}
          bordered
          size="small"
          column={2}
          className={styles.descriptions}
        >
          <Descriptions.Item label="类型">{formatOptionLabel(ENTITY_TYPE_LABEL_MAP, party.entityType ?? null)}</Descriptions.Item>
          <Descriptions.Item label={party.entityType === 'personal' ? '姓名' : '名称'}>{formatText(party.name)}</Descriptions.Item>
          <Descriptions.Item label={party.entityType === 'personal' ? '身份证' : '社会统一信用代码'}>{formatText(party.idNumber)}</Descriptions.Item>
          <Descriptions.Item label="电话">{formatText(party.phone)}</Descriptions.Item>
          <Descriptions.Item label="地址" span={3}>{formatText(party.address)}</Descriptions.Item>
          <Descriptions.Item label="是否失信">{formatBoolean(party.isDishonest ?? null, '是', '否')}</Descriptions.Item>
        </Descriptions>
      ));
    };

    return (
      <div className={styles.sectionList}>
        <Typography.Title level={5}>当事人</Typography.Title>
        {renderPartyGroup(parties.claimants, '当事人')}
        <Divider dashed />
        <Typography.Title level={5}>对方当事人</Typography.Title>
        {renderPartyGroup(parties.respondents, '对方当事人')}
      </div>
    );
  };

  function renderHearingDisplay(values: WorkInjuryCaseFormValues) {
    const lawyerInfo = values.lawyerInfo ?? {};
    const hearingRecords = lawyerInfo.hearingRecords ?? [];
    const shouldShowStageTitle = hearingRecords.length > 1;

    const renderHearingSection = (record: CaseHearingRecord, index: number) => {
      const stageLabel = record.trialStage ? TRIAL_STAGE_LABEL_MAP[record.trialStage] ?? record.trialStage : null;
    const sectionTitle = stageLabel ?? `庭审信息${index + 1}`;

    const items: ReactNode[] = [];

      if (!shouldShowStageTitle && stageLabel) {
        items.push(
          <Descriptions.Item key="trialStage" label="审理阶段">
            {stageLabel}
          </Descriptions.Item>
        );
      }

      if (record.hearingTime) {
        items.push(
          <Descriptions.Item key="hearingTime" label="庭审时间">
            {formatDate(record.hearingTime, 'YYYY-MM-DD HH:mm')}
          </Descriptions.Item>
        );
      }

      if (record.hearingLocation && record.hearingLocation.trim()) {
        items.push(
          <Descriptions.Item key="hearingLocation" label="庭审地点">
            {formatText(record.hearingLocation)}
          </Descriptions.Item>
        );
      }

      if (record.tribunal && record.tribunal.trim()) {
        items.push(
          <Descriptions.Item key="tribunal" label="判庭">
            {formatText(record.tribunal)}
          </Descriptions.Item>
        );
      }

      if (record.judge && record.judge.trim()) {
        items.push(
          <Descriptions.Item key="judge" label="主审法官">
            {formatText(record.judge)}
          </Descriptions.Item>
        );
      }

      if (record.contactPhone && record.contactPhone.trim()) {
        items.push(
          <Descriptions.Item key="contactPhone" label="联系电话">
            {formatText(record.contactPhone)}
          </Descriptions.Item>
        );
      }

      if (record.caseNumber && record.caseNumber.trim()) {
        items.push(
          <Descriptions.Item key="caseNumber" label="案号" span={2}>
            {formatText(record.caseNumber)}
          </Descriptions.Item>
        );
      }

      if (record.hearingResult && record.hearingResult.trim()) {
        items.push(
          <Descriptions.Item key="hearingResult" label="庭审结果" span={2}>
            <Typography.Paragraph style={{ marginBottom: 0 }}>{record.hearingResult}</Typography.Paragraph>
          </Descriptions.Item>
        );
      }

      if (items.length === 0) {
        items.push(
          <Descriptions.Item key="empty" label="庭审信息" span={2}>
            <Typography.Text type="secondary">暂无详细信息</Typography.Text>
          </Descriptions.Item>
        );
      }

      return (
        <div key={record.id ?? `hearing-${index}`}>
          {shouldShowStageTitle ? (
            <Typography.Title level={5}>{sectionTitle}</Typography.Title>
          ) : null}
          <Descriptions bordered size="small" column={2} className={styles.descriptions}>
            {items}
          </Descriptions>
        </div>
      );
    };

    return (
      <div className={styles.sectionList}>
        {hearingRecords.length ? (
          hearingRecords.map(renderHearingSection)
        ) : (
          <Typography.Text type="secondary" className={styles.emptyHint}>
            暂无庭审信息
          </Typography.Text>
        )}
      </div>
    );
  }

  function renderTimeNodeDisplay(values: WorkInjuryCaseFormValues) {
    const nodes = values.timeNodes ?? [];

    if (!nodes.length) {
      return (
        <Typography.Text type="secondary" className={styles.emptyHint}>
          暂无时间节点记录
        </Typography.Text>
      );
    }

    const sortedNodes = [...nodes].sort((a, b) => {
      const orderA = CASE_TIME_NODE_ORDER_MAP[a.nodeType] ?? Number.MAX_SAFE_INTEGER;
      const orderB = CASE_TIME_NODE_ORDER_MAP[b.nodeType] ?? Number.MAX_SAFE_INTEGER;
      if (orderA === orderB) {
        const timeA = a.occurredOn ? dayjs(a.occurredOn).valueOf() : Number.MAX_SAFE_INTEGER;
        const timeB = b.occurredOn ? dayjs(b.occurredOn).valueOf() : Number.MAX_SAFE_INTEGER;
        return timeA - timeB;
      }
      return orderA - orderB;
    });

    const items = sortedNodes.map(node => ({
      key: `${node.nodeType}-${node.id}`,
      color: 'blue',
      children: (
        <div>
          <Typography.Text strong>{CASE_TIME_NODE_LABEL_MAP[node.nodeType] ?? node.nodeType}</Typography.Text>
          <div>{formatDate(node.occurredOn ?? null)}</div>
        </div>
      )
    }));

    return <Timeline items={items} />;
  }

  const renderAssignmentDisplay = (values: WorkInjuryCaseFormValues) => {
    const adminInfo = values.adminInfo ?? {};
    const collections = adminInfo.collections ?? [];
    const assignedLawyerDisplay =
      adminInfo.assignedLawyerName ?? adminInfo.assignedLawyer ?? values.lawyerInfo?.trialLawyerName ?? null;
    const assignedAssistantDisplay =
      adminInfo.assignedAssistantName ?? adminInfo.assignedAssistant ?? null;
    const salesDisplay = adminInfo.assignedSaleName ?? adminInfo.assignedSaleId ?? null;

    const collectionItems = collections.map((item, index) => ({
      key: `collection-${index}`,
      color: 'blue',
      children: (
        <div>
          <Typography.Text strong>{formatDate(item.date ?? null)}</Typography.Text>
          <div>回款金额：{formatCurrency(item.amount ?? null)}</div>
        </div>
      )
    }));

    return (
      <div className={styles.sectionList}>
        <Descriptions bordered size="small" column={2} className={styles.descriptions}>
          <Descriptions.Item label="承办律师">{formatText(assignedLawyerDisplay)}</Descriptions.Item>
          <Descriptions.Item label="律师助理">{formatText(assignedAssistantDisplay)}</Descriptions.Item>
          <Descriptions.Item label="销售人员">{formatText(salesDisplay)}</Descriptions.Item>
          <Descriptions.Item label="案件状态">{formatOptionLabel(CASE_STATUS_LABELS, adminInfo.caseStatus ?? null)}</Descriptions.Item>
          <Descriptions.Item label="结案原因">{formatText(adminInfo.closedReason)}</Descriptions.Item>
          <Descriptions.Item label="退单原因">{formatText(adminInfo.voidReason)}</Descriptions.Item>
        </Descriptions>
        {
          canShowCollectionSection ? 
          <>
          <Divider dashed>回款记录</Divider>
        {collectionItems.length ? (
          <Timeline items={collectionItems} />
        ) : (
          <Typography.Text type="secondary" className={styles.emptyHint}>
            暂无回款记录
          </Typography.Text>
        )}
          </> : null
        }
      </div>
    );
  };

  function renderFollowUpDisplay(values: WorkInjuryCaseFormValues) {
    const timeline = values.timeline ?? [];

    if (timeline.length === 0) {
      return (
        <Typography.Text type="secondary" className={styles.emptyHint}>
          暂无跟进记录
        </Typography.Text>
      );
    }

    const sortedTimeline = [...timeline].sort((a, b) => {
      const aTime = a.occurredOn ? dayjs(a.occurredOn).valueOf() : 0;
      const bTime = b.occurredOn ? dayjs(b.occurredOn).valueOf() : 0;
      return bTime - aTime;
    });

    return (
      <div className={styles.sectionList}>
        {sortedTimeline.map((item, index) => {
          const entryKey = item.id ?? `follow-up-${index}`;
          const followerDisplay = item.followerName ?? item.followerId ?? null;
          return (
            <div key={entryKey}>
              <Descriptions bordered size="small" column={2} className={styles.descriptions}>
                <Descriptions.Item label="时间">
                  {formatDate(item.occurredOn ?? null)}
                </Descriptions.Item>
                <Descriptions.Item label="跟进人">
                  {formatText(followerDisplay)}
                </Descriptions.Item>
                <Descriptions.Item label="内容" span={2}>
                  <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                    {formatText(item.note)}
                  </Typography.Paragraph>
                </Descriptions.Item>
              </Descriptions>
              {index < sortedTimeline.length - 1 ? <Divider dashed /> : null}
            </div>
          );
        })}
      </div>
    );
  }

  const renderChangeLogDisplay = (logs?: CaseChangeLog[] | null, loading = false) => {
    if (loading) {
      return <Skeleton active paragraph={{ rows: 4 }} />;
    }
    if (!logs || logs.length === 0) {
      return (
        <Typography.Text type="secondary" className={styles.emptyHint}>
          暂无变更记录
        </Typography.Text>
      );
    }
    return (
      <div className={styles.sectionList}>
        {logs.map((log, index) => {
          const actorRole = (log.actorRole ?? '') as UserRole;
          const roleLabel = ROLE_LABEL_MAP[actorRole];
          const actorLabel = log.actorName
            ? roleLabel
              ? `${log.actorName}（${roleLabel}）`
              : log.actorName
            : '系统';
          const timestamp = log.createdAt ? formatDate(log.createdAt, 'YYYY-MM-DD HH:mm') : '—';
          return (
            <div key={log.id} style={{ marginBottom: index < logs.length - 1 ? 16 : 0 }}>
              <Typography.Paragraph strong style={{ marginBottom: 4 }}>
                {log.description ?? log.action ?? '变更记录'}
              </Typography.Paragraph>
              <Typography.Paragraph type="secondary" style={{ marginBottom: log.changes?.length ? 8 : 0 }}>
                {actorLabel} · {timestamp}
              </Typography.Paragraph>
              {log.changes?.length ? (
                <div>
                  {log.changes.map(change => (
                    <Typography.Paragraph key={change.field} style={{ marginBottom: 0 }}>
                      <Typography.Text strong>{change.label}：</Typography.Text>
                      <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
                        {(change.previousValue ?? '—')} → {(change.currentValue ?? '—')}
                      </Typography.Text>
                    </Typography.Paragraph>
                  ))}
                </div>
              ) : null}
              {index < logs.length - 1 ? <Divider dashed /> : null}
            </div>
          );
        })}
      </div>
    );
  };

  const changeLogEditPane = canViewChangeLogs ? (
    <div className={styles.sectionList}>
      <Space size="middle" wrap style={{ marginBottom: 16 }}>
        <Button onClick={() => void loadChangeLogs()} loading={changeLogsLoading}>
          刷新变更记录
        </Button>
      </Space>
      {renderChangeLogDisplay(changeLogs, changeLogsLoading)}
    </div>
  ) : (
    <Typography.Text type="secondary" className={styles.emptyHint}>
      暂无权限查看变更记录
    </Typography.Text>
  );

  const renderFeeDisplay = (values: WorkInjuryCaseFormValues) => {
    const collections = values.adminInfo?.collections ?? [];
    const salesCommission = values.adminInfo?.salesCommission ?? null;
    const handlingFee = values.adminInfo?.handlingFee ?? null;

    const feeSummary = (
      <Descriptions bordered size="small" column={2} className={styles.descriptions}>
        <Descriptions.Item label="销售提成">
          {formatText(salesCommission ?? undefined)}
        </Descriptions.Item>
        <Descriptions.Item label="办案费用">
          {formatText(handlingFee ?? undefined)}
        </Descriptions.Item>
      </Descriptions>
    );

    const timelineContent = collections.length ? (
      <Timeline
        items={collections.map((item, index) => ({
          key: `collection-${index}`,
          color: 'blue',
          children: (
            <div>
              <Typography.Text strong>{formatDate(item.date ?? null)}</Typography.Text>
              <div>回款金额：{formatCurrency(item.amount ?? null)}</div>
            </div>
          )
        }))}
      />
    ) : (
      <Typography.Text type="secondary" className={styles.emptyHint}>
        暂无回款记录
      </Typography.Text>
    );

    return (
      <div className={styles.sectionList}>
        {feeSummary}
        <Divider dashed>回款记录</Divider>
        {timelineContent}
      </div>
    );
  };

  const feesEditPane = (
    <div className={styles.sectionList}>
      {onAddCollection ? (
        <>
          <Typography.Title level={5}>新增回款记录</Typography.Title>
          <Form
            form={collectionForm}
            layout="vertical"
            component={false}
            disabled={!canAddCollections}
            onValuesChange={() => markDirty('collection')}
          >
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  label="回款金额"
                  name="amount"
                  rules={[{ required: true, message: '请输入回款金额' }]}
                >
                  <InputNumber
                    min={0.01}
                    precision={2}
                    style={{ width: '100%' }}
                    placeholder="请输入回款金额"
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  label="回款日期"
                  name="receivedAt"
                  rules={[{ required: true, message: '请选择回款日期' }]}
                >
                  <DatePicker style={{ width: '100%' }} placeholder="请选择回款日期" format="YYYY-MM-DD" />
                </Form.Item>
              </Col>
            </Row>
            <Space size="middle" wrap>
              <Button onClick={() => syncFormsFromValues(displayValues)} disabled={collectionSaving}>
                重置
              </Button>
              <Button
                type="primary"
                onClick={() => void handleCollectionSave()}
                loading={collectionSaving}
                disabled={!canAddCollections}
              >
                保存回款记录
              </Button>
            </Space>
          </Form>
          <Divider dashed />
        </>
      ) : null}
      <Typography.Title level={5}>费用信息</Typography.Title>
      {onUpdateFees ? (
        <Form
          form={feeForm}
          layout="vertical"
          component={false}
          disabled={!canUpdateFees}
          onValuesChange={() => markDirty('fee')}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="提成" name="salesCommission">
                <Input placeholder="请输入销售提成" allowClear />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="办案费用" name="handlingFee">
                <Input placeholder="请输入办案费用" allowClear />
              </Form.Item>
            </Col>
          </Row>
          <Space size="middle" wrap>
            <Button onClick={() => syncFormsFromValues(displayValues)} disabled={feeSaving}>
              重置
            </Button>
            <Button
              type="primary"
              onClick={() => void handleFeeSave()}
              loading={feeSaving}
              disabled={!canUpdateFees}
            >
              保存费用信息
            </Button>
          </Space>
        </Form>
      ) : (
        <Typography.Text type="secondary" className={styles.emptyHint}>
          暂无权限修改费用信息
        </Typography.Text>
      )}
      {renderFeeDisplay(displayValues)}
    </div>
  );


  type TabItem = NonNullable<TabsProps['items']>[number];

  const tabItems: TabItem[] = (() => {
    const items: TabItem[] = [
      {
        key: 'basic',
        label: buildTabLabel('basic'),
        children: canEditBasicInfo ? basicInfoPane : renderBasicInfoDisplay(displayValues)
      },
      {
        key: 'parties',
        label: buildTabLabel('parties'),
        children: isEditable ? personnelPane : renderPartyDisplay(displayValues)
      }
    ];

    if (sessionUser?.role !== 'sale') {
      items.push({
        key: 'hearing',
        label: buildTabLabel('hearing'),
        children: isEditable ? hearingEditPane : renderHearingDisplay(displayValues)
      });
    }

    if (sessionUser?.role !== 'sale' && sessionUser?.role !== 'lawyer' && sessionUser?.role !== 'assistant') {
      items.push({
        key: 'staff',
        label: buildTabLabel('staff'),
        children: isEditable ? staffEditPane : renderAssignmentDisplay(displayValues)
      });
    }

    items.push({
      key: 'timeNodes',
      label: buildTabLabel('timeNodes'),
      children: timeNodePane
    });

    items.push(
      {
        key: 'followUp',
        label: buildTabLabel('followUp'),
        children: followUpEditPane
      },
      {
        key: 'changeLog',
        label: buildTabLabel('changeLog'),
        children: isEditable ? changeLogEditPane : renderChangeLogDisplay(changeLogs, changeLogsLoading)
      }
    );

    if (sessionUser?.role !== 'sale' && sessionUser?.role !== 'lawyer' && sessionUser?.role !== 'assistant') {
      items.push({
        key: 'fees',
        label: buildTabLabel('fees'),
        children: isEditable ? feesEditPane : renderFeeDisplay(displayValues)
      });
    }

    return items;
  })();

  const handleTabChange = (key: string) => {
    if (!isTabKey(key)) {
      return;
    }
    setActiveTab(key);
    if (isEditable && (key === 'staff' || key === 'hearing')) {
      void ensureAssignableStaff();
    }
    if (key === 'changeLog') {
      void loadChangeLogs();
    }
  };

  const editableFooter = useMemo<ReactNode[]>(
    () => {
      const buttons: ReactNode[] = [
        <Button key="cancel" onClick={handleCancel} disabled={Boolean(confirmLoading)}>
          取消
        </Button>
      ];

      if (activeTab === 'basic' && canEditBasicInfo && (onSubmit || onSaveBasicInfo)) {
        const basicDirty = hasTabChanges('basic');
        const basicSavingState = mode === 'create' ? mainFormSaving : basicInfoSaving;
        buttons.push(
          <Button
            key="basic-reset"
            onClick={handleBasicInfoReset}
            disabled={basicSavingState || !basicDirty}
          >
            重置
          </Button>,
          <Button
            key="basic-save"
            type="primary"
            onClick={() => void handleBasicInfoSave()}
            loading={basicSavingState}
            disabled={!canEditBasicInfo || !basicDirty}
          >
            保存基本信息
          </Button>
        );
      }

      if (activeTab === 'parties' && (onSubmit || onSaveParties)) {
        const partiesDirty = hasTabChanges('parties');
        const partiesSavingState = mode === 'create' ? mainFormSaving : partiesSaving;
        buttons.push(
          <Button
            key="parties-reset"
            onClick={handlePartiesReset}
            disabled={partiesSavingState || !partiesDirty}
          >
            重置
          </Button>,
          <Button
            key="parties-save"
            type="primary"
            onClick={() => void handlePartiesSave()}
            loading={partiesSavingState}
            disabled={!isEditable || !partiesDirty}
          >
            保存当事人信息
          </Button>
        );
      }

      if (activeTab === 'staff' && onSaveAssignment) {
        buttons.push(
          <Button
            key="assignment-reset"
            onClick={handleAssignmentReset}
            disabled={assignmentSaving || !canEditAssignments}
          >
            重置
          </Button>,
          <Button
            key="assignment-save"
            type="primary"
            onClick={() => void handleAssignmentSave()}
            loading={assignmentSaving}
            disabled={!canEditAssignments}
          >
            保存人员分配
          </Button>
        );
      }

      if (activeTab === 'hearing' && onAddHearing && canAddHearings) {
        buttons.push(
          <Button
            key="hearing-reset"
            onClick={handleHearingReset}
            disabled={hearingSaving || !canAddHearings || !canAddMoreHearings}
          >
            重置
          </Button>,
          <Button
            key="hearing-save"
            type="primary"
            onClick={() => void handleHearingSave()}
            loading={hearingSaving}
            disabled={!canAddHearings || !canAddMoreHearings}
          >
            保存庭审信息
          </Button>
        );
      }

      if (activeTab === 'timeNodes' && onSaveTimeNodes) {
        const timeNodesDirty = hasTabChanges('timeNodes');
        buttons.push(
          <Button
            key="timeNodes-reset"
            onClick={handleTimeNodeReset}
            disabled={timeNodeSaving || !timeNodesDirty}
          >
            重置
          </Button>,
          <Button
            key="timeNodes-save"
            type="primary"
            onClick={() => void handleTimeNodeSave()}
            loading={timeNodeSaving}
            disabled={!canManageTimeNodes || !timeNodesDirty}
          >
            保存时间节点
          </Button>
        );
      }

      if (activeTab === 'followUp' && onAddFollowUp) {
        buttons.push(
          <Button key="followUp-reset" onClick={handleFollowUpReset} disabled={followUpSaving}>
            重置
          </Button>,
          <Button
            key="followUp-save"
            type="primary"
            onClick={() => void handleFollowUpSave()}
            loading={followUpSaving}
            disabled={!canAddFollowUps}
          >
            保存跟进备注
          </Button>
        );
      }

      return buttons;
    },
    [
      activeTab,
      assignmentSaving,
      basicInfoSaving,
  canEditBasicInfo,
      canAddFollowUps,
      canAddHearings,
      canAddMoreHearings,
      canEditAssignments,
      confirmLoading,
      followUpSaving,
      handleAssignmentReset,
      handleAssignmentSave,
      handleBasicInfoReset,
      handleBasicInfoSave,
      handleCancel,
      handleFollowUpReset,
      handleFollowUpSave,
      handleHearingReset,
      handleHearingSave,
      handlePartiesReset,
      handlePartiesSave,
      handleTimeNodeReset,
      handleTimeNodeSave,
      hasTabChanges,
      hearingSaving,
      isEditable,
      mainFormSaving,
      mode,
      onSaveTimeNodes,
      onAddFollowUp,
      onAddHearing,
      onSaveAssignment,
      onSaveBasicInfo,
      onSaveParties,
      onSubmit,
      partiesSaving,
      timeNodeSaving,
      canManageTimeNodes
    ]
  );

  const modalTitleText = mode === 'create' ? '新增案件' : mode === 'update' ? '编辑案件' : '案件详情';
  const statusLabel = CASE_STATUS_LABELS[pendingStatus] ?? pendingStatus;
  const canModifyStatus = mode === 'create' ? isEditable : isEditable && canUpdateStatus;
  const statusControl = canModifyStatus ? (
    <Select<CaseStatusValue>
      className={styles.statusSelect}
      value={pendingStatus}
      options={caseStatusSelectOptions}
      onChange={value => void handleStatusSelectChange(value)}
      size="small"
      loading={statusUpdating}
      disabled={statusUpdating}
    />
  ) : (
    <Tag color={CASE_STATUS_COLOR_MAP[pendingStatus] ?? 'default'}>{statusLabel}</Tag>
  );

  const modalTitle = (
    <div className={styles.modalTitle}>
      <span className={styles.modalHeading}>{modalTitleText}</span>
      <Space size={8} className={styles.statusControl}>
        <Typography.Text type="secondary">状态</Typography.Text>
        {statusControl}
      </Space>
    </div>
  );

  return (
    <Modal
      open={open}
      title={mode === 'create' ? modalTitleText : modalTitle}
      width={1000}
      maskClosable={false}
      destroyOnClose
      onCancel={handleCancel}
      footer={
        isEditable ? editableFooter : viewFooter
      }
      styles={{
        body: {
          height: 'calc(100vh - 300px)',
          padding: 0,
          overflowY: 'auto',
          overflowX: 'hidden'
        }
      }}
    >
      <Form form={form} layout="vertical" className={styles.form} onValuesChange={handleValuesChange}>
        <div className={styles.viewContainer}>
          <Tabs
            activeKey={activeTab}
            onChange={handleTabChange}
            tabPosition="left"
            items={tabItems}
            className={styles.viewTabs}
            destroyInactiveTabPane={false}
          />
        </div>
      </Form>
    </Modal>
  );
}
