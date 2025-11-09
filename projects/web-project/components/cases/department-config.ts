import type { CaseTableColumnKey } from '@/lib/cases-api';
// 案件列表筛选项类型定义
export type CaseTableFilterKey =
  | 'caseNumber'
  | 'caseStatus'
  | 'caseType'
  | 'caseLevel'
  | 'provinceCity'
  | 'assignedLawyerName'
  | 'assignedAssistantName'
  | 'assignedSaleName'
  | 'entryDate'
  | 'createdAt';
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
  filterOptions: CaseTableFilterKey[];
}
// 各部门案件列表筛选项配置
const DEPARTMENT_FILTER_OPTIONS: Record<UserDepartment, CaseTableFilterKey[]> = {
  work_injury: [
    'caseStatus',
    'caseType',
    'caseLevel',
    'provinceCity',
    'assignedLawyerName',
    'assignedAssistantName',
    'entryDate',
    'createdAt'
  ],
  insurance: [
    'caseNumber',
    'caseStatus',
    'caseLevel'
  ]
};

export const DEFAULT_CASE_DEPARTMENT: UserDepartment = 'work_injury';

export const CASE_TABLE_COLUMN_LABELS: Record<CaseTableColumnKey, string> = {
  caseNumber: '案号',
  caseStatus: '案件状态',
  caseType: '案件类型',
  caseLevel: '案件级别',
  claimantNames: '当事人',
  respondentNames: '对方当事人',
  provinceCity: '省份/城市',
  assignedLawyerName: '负责律师',
  assignedAssistantName: '负责助理',
  assignedSaleName: '跟进销售',
  contractDate: '合同日期',
  clueDate: '线索日期',
  targetAmount: '标的额',
  contractForm: '合同形式',
  insuranceRiskLevel: '风险等级',
  insuranceTypes: '保险类型',
  dataSource: '数据来源',
  entryDate: '入职时间',
  createdAt: '创建时间',
  updatedAt: '更新时间'
};

const DEPARTMENT_COLUMN_OPTION_KEYS: Record<UserDepartment, CaseTableColumnKey[]> = {
  work_injury: [
    'caseNumber',
    'caseStatus',
    'caseType',
    'caseLevel',
    'claimantNames',
    'respondentNames',
    'provinceCity',
    'assignedLawyerName',
    'assignedSaleName',
    'dataSource',
    'targetAmount',
    'createdAt'
  ],
  insurance: [
    'caseNumber',
    'caseStatus',
    'claimantNames',
    'respondentNames',
    'contractDate',
    'clueDate',
    'targetAmount',
    'contractForm',
    'insuranceRiskLevel',
    'insuranceTypes',
    'assignedLawyerName',
    'assignedSaleName',
    'dataSource',
    'createdAt'
  ]
};

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
  work_injury: [
    'caseNumber',
    'caseStatus',
    'caseType',
    'caseLevel',
    'claimantNames',
    'assignedLawyerName',
    'assignedSaleName'
  ],
  insurance: [
    'caseNumber',
    'caseStatus',
    'claimantNames',
    'contractDate',
    'contractForm',
    'insuranceRiskLevel'
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
    ['contractDate', 'contractForm', 'caseLevel'],
    ['clueDate', 'targetAmount', 'dataSource'],
    ['estimatedCollection', 'litigationFeeType', 'travelFeeType'],
    ['contractQuoteType', 'contractQuoteAmount', 'contractQuoteUpfront', 'contractQuoteRatio', 'contractQuoteOther'],
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
    'insuranceMisrepresentations'
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
  const filterOptions = DEPARTMENT_FILTER_OPTIONS[department] || [];
  const columnKeys = DEPARTMENT_COLUMN_OPTION_KEYS[department] ?? [];

  const columnOptions =
    columnKeys.length > 0
      ? columnKeys.map((key) => ({ key, label: CASE_TABLE_COLUMN_LABELS[key] }))
      : (Object.entries(CASE_TABLE_COLUMN_LABELS) as Array<[CaseTableColumnKey, string]>).map(
          ([key, label]) => ({ key, label })
        );
  const availableColumnSet = new Set(columnOptions.map((option) => option.key));

  const defaultColumnsCandidate =
    defaultColumnsOverride.length > 0 ? defaultColumnsOverride : columnOptions.map((option) => option.key);
  const defaultColumns = defaultColumnsCandidate.filter((key) => availableColumnSet.has(key));
  if (defaultColumns.length === 0 && columnOptions.length > 0) {
    defaultColumns.push(columnOptions[0].key);
  }
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
    columnOptions,
    defaultColumns,
    visibleTabs,
    editableTabs,
    modalOperations,
    tableActions,
    allowCreate: allowCreateOverride ?? true,
    basicInfoLayout: [...departmentBasicInfoLayout],
    requiredBasicInfoFields: new Set(requiredFields),
    filterOptions
  };
};

export const CASE_DEPARTMENT_CONFIG: Record<UserDepartment, CaseDepartmentConfig> = {
  work_injury: buildDepartmentConfig('work_injury'),
  insurance: buildDepartmentConfig('insurance')
};
