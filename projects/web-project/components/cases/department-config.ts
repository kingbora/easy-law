import type { CaseTableColumnKey } from '@/lib/cases-api';
import type { UserDepartment } from '@/lib/users-api';

import type { WorkInjuryCaseTabKey } from './modal';

export type CaseTableActionKey = 'update-status' | 'add-follow-up' | 'add-time-node';

export interface CaseModalOperationsConfig {
  assignment: boolean;
  status: boolean;
  hearing: boolean;
  followUp: boolean;
  collection: boolean;
  fees: boolean;
  timeNodes: boolean;
  changeLog: boolean;
}

export type BasicInfoFieldKey =
  | 'caseType'
  | 'caseLevel'
  | 'provinceCity'
  | 'targetAmount'
  | 'feeStandard'
  | 'agencyFeeEstimate'
  | 'dataSource'
  | 'entryDate'
  | 'clueDate'
  | 'contractDate'
  | 'injuryLocation'
  | 'injurySeverity'
  | 'injuryCause'
  | 'workInjuryCertified'
  | 'appraisalLevel'
  | 'appraisalEstimate'
  | 'monthlySalary'
  | 'customerCooperative'
  | 'hasContract'
  | 'hasSocialSecurity'
  | 'witnessCooperative'
  | 'caseCategory'
  | 'insuranceRiskLevel'
  | 'contractForm'
  | 'contractQuoteType'
  | 'contractQuoteAmount'
  | 'contractQuoteUpfront'
  | 'contractQuoteRatio'
  | 'estimatedCollection'
  | 'litigationFeeType'
  | 'travelFeeType'
  | 'contractQuoteOther'
  | 'insuranceTypes'
  | 'insuranceMisrepresentations'
  | 'existingEvidence'
  | 'remark'
  | 'insuranceDivider';

export type BasicInfoLayoutRow = Array<BasicInfoFieldKey | ''>;

export interface CaseDepartmentConfig {
  department: UserDepartment;
  tableKey: string;
  columnOptions: Array<{ key: CaseTableColumnKey; label: string }>;
  defaultColumns: CaseTableColumnKey[];
  visibleTabs: WorkInjuryCaseTabKey[];
  editableTabs: WorkInjuryCaseTabKey[];
  modalOperations: CaseModalOperationsConfig;
  tableActions: ReadonlyArray<CaseTableActionKey>;
  allowCreate: boolean;
  basicInfoLayout: BasicInfoLayoutRow[];
  requiredBasicInfoFields: ReadonlySet<BasicInfoFieldKey>;
}

export const DEFAULT_CASE_DEPARTMENT: UserDepartment = 'work_injury';

const SHARED_COLUMN_OPTIONS: Array<{ key: CaseTableColumnKey; label: string }> = [
  { key: 'caseNumber', label: '案号' },
  { key: 'caseStatus', label: '案件状态' },
  { key: 'caseType', label: '案件类型' },
  { key: 'caseLevel', label: '案件级别' },
  { key: 'claimantNames', label: '当事人' },
  { key: 'provinceCity', label: '省份/城市' },
  { key: 'assignedLawyerName', label: '负责律师' },
  { key: 'assignedAssistantName', label: '负责助理' },
  { key: 'assignedSaleName', label: '跟进销售' },
  { key: 'entryDate', label: '入职时间' },
  { key: 'createdAt', label: '创建时间' },
  { key: 'updatedAt', label: '更新时间' }
];

const SHARED_DEFAULT_COLUMNS: CaseTableColumnKey[] = [
  'caseNumber',
  'caseStatus',
  'caseType',
  'caseLevel',
  'claimantNames',
  'provinceCity',
  'assignedLawyerName',
  'assignedAssistantName'
];

const SHARED_VISIBLE_TABS: WorkInjuryCaseTabKey[] = [
  'basic',
  'parties',
  'hearing',
  'staff',
  'timeNodes',
  'followUp',
  'changeLog',
  'fees'
];

const SHARED_MODAL_OPERATIONS: CaseModalOperationsConfig = {
  assignment: true,
  status: true,
  hearing: true,
  followUp: true,
  collection: true,
  fees: true,
  timeNodes: true,
  changeLog: true
};

const SHARED_TABLE_ACTIONS: ReadonlyArray<CaseTableActionKey> = ['update-status', 'add-follow-up', 'add-time-node'];

const DEPARTMENT_DEFAULT_COLUMNS: Record<UserDepartment, CaseTableColumnKey[]> = {
  work_injury: [],
  insurance: [
    'caseNumber',
    'caseStatus',
    'caseType',
    'caseLevel',
    'claimantNames',
    'provinceCity',
    'assignedSaleName',
    'assignedLawyerName',
    'assignedAssistantName'
  ]
};

const DEPARTMENT_VISIBLE_TABS: Record<UserDepartment, WorkInjuryCaseTabKey[]> = {
  work_injury: [],
  insurance: ['basic', 'parties', 'staff', 'followUp', 'changeLog', 'fees']
};

const DEPARTMENT_EDITABLE_TABS: Record<UserDepartment, WorkInjuryCaseTabKey[]> = {
  work_injury: [],
  insurance: ['basic', 'parties', 'staff', 'followUp', 'changeLog', 'fees']
};

const DEPARTMENT_MODAL_OPERATION_OVERRIDES: Record<UserDepartment, Partial<CaseModalOperationsConfig>> = {
  work_injury: {},
  insurance: {
    hearing: false,
    timeNodes: false
  }
};

const DEPARTMENT_TABLE_ACTIONS: Record<UserDepartment, CaseTableActionKey[]> = {
  work_injury: [],
  insurance: ['update-status', 'add-follow-up']
};

const DEPARTMENT_ALLOW_CREATE_OVERRIDES: Partial<Record<UserDepartment, boolean>> = {};

const DEPARTMENT_BASIC_INFO_LAYOUT: Record<UserDepartment, BasicInfoLayoutRow[]> = {
  work_injury: [
    ['caseType', 'caseLevel', 'provinceCity'],
    ['targetAmount', 'feeStandard', 'agencyFeeEstimate'],
    ['dataSource', 'entryDate', 'injuryLocation'],
    ['injurySeverity', 'injuryCause', 'workInjuryCertified'],
    ['appraisalLevel', 'appraisalEstimate', 'monthlySalary'],
    ['customerCooperative', 'hasContract', 'hasSocialSecurity'],
    ['witnessCooperative', '', ''],
    ['existingEvidence', '', ''],
    ['remark', '', '']
  ],
  insurance: [
    ['contractDate', 'contractForm', 'contractQuoteType'],
    ['contractQuoteAmount', 'contractQuoteUpfront', 'contractQuoteRatio'],
    ['contractQuoteOther', '', ''],
    ['clueDate', 'targetAmount', 'caseLevel'],
    ['dataSource', 'estimatedCollection', 'litigationFeeType'],
    ['travelFeeType', '', ''],
    ['insuranceTypes', '', ''],
    ['insuranceMisrepresentations', '', ''],
    ['remark', '', '']
  ]
};

const DEPARTMENT_REQUIRED_BASIC_FIELDS: Record<UserDepartment, BasicInfoFieldKey[]> = {
  work_injury: ['caseType', 'caseLevel', 'provinceCity', 'dataSource'],
  insurance: [
    'contractDate',
    'contractForm',
    'contractQuoteType',
    'clueDate',
    'targetAmount',
    'dataSource',
    'caseLevel',
    'estimatedCollection',
    'litigationFeeType',
    'travelFeeType',
    'insuranceTypes',
    'insuranceMisrepresentations',
    'remark'
  ]
};

const buildDepartmentConfig = (department: UserDepartment): CaseDepartmentConfig => {
  const defaultColumnsOverride = DEPARTMENT_DEFAULT_COLUMNS[department];
  const visibleTabsOverride = DEPARTMENT_VISIBLE_TABS[department];
  const editableTabsOverride = DEPARTMENT_EDITABLE_TABS[department];
  const modalOverrides = DEPARTMENT_MODAL_OPERATION_OVERRIDES[department];
  const tableActionsOverride = DEPARTMENT_TABLE_ACTIONS[department];
  const allowCreateOverride = DEPARTMENT_ALLOW_CREATE_OVERRIDES[department];
  const departmentBasicInfoLayout = DEPARTMENT_BASIC_INFO_LAYOUT[department];
  const requiredFields = DEPARTMENT_REQUIRED_BASIC_FIELDS[department];

  const defaultColumns =
    defaultColumnsOverride.length > 0 ? [...defaultColumnsOverride] : [...SHARED_DEFAULT_COLUMNS];
  const visibleTabs =
    visibleTabsOverride.length > 0 ? [...visibleTabsOverride] : [...SHARED_VISIBLE_TABS];
  const editableTabs =
    editableTabsOverride.length > 0 ? [...editableTabsOverride] : [...visibleTabs];
  const modalOperations: CaseModalOperationsConfig = {
    ...SHARED_MODAL_OPERATIONS,
    ...modalOverrides
  };
  const tableActions: ReadonlyArray<CaseTableActionKey> =
    tableActionsOverride.length > 0 ? [...tableActionsOverride] : [...SHARED_TABLE_ACTIONS];

  return {
    department,
    tableKey: `${department}_cases`,
    columnOptions: [...SHARED_COLUMN_OPTIONS],
    defaultColumns,
    visibleTabs,
    editableTabs,
    modalOperations,
    tableActions,
    allowCreate: allowCreateOverride ?? true,
    basicInfoLayout: [...departmentBasicInfoLayout],
    requiredBasicInfoFields: new Set(requiredFields)
  };
};

export const CASE_DEPARTMENT_CONFIG: Record<UserDepartment, CaseDepartmentConfig> = {
  work_injury: buildDepartmentConfig('work_injury'),
  insurance: buildDepartmentConfig('insurance')
};
