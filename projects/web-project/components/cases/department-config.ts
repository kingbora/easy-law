import type { CaseTableColumnKey, UserDepartment } from '@easy-law/shared-types';
// 案件列表筛选项类型定义
export type CaseTableFilterKey =
  | 'caseNumber'
  | 'caseStatus'
  | 'caseType'
  | 'caseLevel'
  | 'partyName'
  | 'responsible'
  | 'provinceCity'
  | 'assignedLawyerName'
  | 'assignedAssistantName'
  | 'assignedSaleName'
  | 'entryDate'
  | 'createdAt';

import type { WorkInjuryCaseTabKey } from './modal';

export type CaseTableActionKey = 'update-status' | 'add-follow-up' | 'add-time-node' | 'add-collection';

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
  | 'province'
  | 'city'
  | 'targetAmount'
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
    'partyName',
    'provinceCity',
    'assignedLawyerName',
    'assignedAssistantName',
    'entryDate',
    'createdAt',
    'responsible'
  ],
  insurance: [
    'caseStatus',
    'caseLevel',
    'partyName',
    'responsible'
  ]
};

export const DEFAULT_CASE_DEPARTMENT: UserDepartment = 'work_injury';

export const CASE_TABLE_COLUMN_LABELS: Record<CaseTableColumnKey, string> = {
  caseNumber: '案号',
  caseStatus: '案件状态',
  caseType: '案件类型',
  caseLevel: '案件级别',
  partyNames: '当事人（含对方）',
  provinceCity: '省份/城市',
  responsibleStaff: '负责人',
  collectionAmount: '回款金额',
  contractDate: '合同日期',
  clueDate: '线索日期',
  targetAmount: '案件标的',
  contractForm: '合同形式',
  insuranceTypes: '保险类型',
  dataSource: '数据来源',
  entryDate: '入职时间',
  createdAt: '创建时间',
  updatedAt: '更新时间'
};

const DEPARTMENT_COLUMN_OPTION_KEYS: Record<UserDepartment, CaseTableColumnKey[]> = {
  work_injury: [
    'caseStatus',
    'caseType',
    'caseLevel',
    'partyNames',
    'provinceCity',
    'responsibleStaff',
    'collectionAmount',
    'targetAmount',
    'dataSource',
    'entryDate',
    'createdAt',
    'updatedAt'
  ],
  insurance: [
    'caseStatus',
    'caseType',
    'caseLevel',
    'partyNames',
    'contractDate',
    'clueDate',
    'targetAmount',
    'contractForm',
    'insuranceTypes',
    'responsibleStaff',
    'collectionAmount',
    'dataSource',
    'createdAt',
    'updatedAt'
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

const SHARED_TABLE_ACTIONS: ReadonlyArray<CaseTableActionKey> = ['update-status', 'add-follow-up', 'add-time-node', 'add-collection'];

const DEPARTMENT_DEFAULT_COLUMNS: Record<UserDepartment, CaseTableColumnKey[]> = {
  work_injury: [
    'caseStatus',
    'caseType',
    'caseLevel',
    'partyNames',
    'responsibleStaff',
    'collectionAmount',
    'targetAmount'
  ],
  insurance: [
    'caseStatus',
    'caseLevel',
    'partyNames',
    'contractDate',
    'contractForm',
    'responsibleStaff',
    'collectionAmount'
  ]
};

const DEPARTMENT_COLUMN_LABEL_OVERRIDES: Partial<Record<UserDepartment, Partial<Record<CaseTableColumnKey, string>>>> = {
  insurance: {
    caseLevel: '风险等级',
    targetAmount: '案件标的'
  }
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
  insurance: ['update-status', 'add-follow-up', 'add-collection']
};

const DEPARTMENT_ALLOW_CREATE_OVERRIDES: Partial<Record<UserDepartment, boolean>> = {};

const DEPARTMENT_BASIC_INFO_LAYOUT: Record<UserDepartment, BasicInfoLayoutRow[]> = {
  work_injury: [
    ['caseType', 'caseLevel', 'province'],
    ['city', 'targetAmount', 'agencyFeeEstimate'],
    ['contractQuoteType', 'contractQuoteAmount', 'contractQuoteUpfront', 'contractQuoteRatio', 'contractQuoteOther'],
    ['dataSource', 'entryDate', 'injuryLocation'],
    ['injurySeverity', 'injuryCause', 'workInjuryCertified'],
    ['appraisalLevel', 'monthlySalary', 'customerCooperative'],
    ['hasContract', 'hasSocialSecurity', 'witnessCooperative'],
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
  work_injury: ['caseType', 'caseLevel', 'province', 'city', 'dataSource', 'contractQuoteType'],
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

  const columnLabelOverrides = DEPARTMENT_COLUMN_LABEL_OVERRIDES[department];
  const columnOptions =
    columnKeys.length > 0
      ? columnKeys.map((key) => ({
        key,
        label: columnLabelOverrides?.[key] ?? CASE_TABLE_COLUMN_LABELS[key]
      }))
      : (Object.entries(CASE_TABLE_COLUMN_LABELS) as Array<[CaseTableColumnKey, string]>).map(
          ([key, label]) => ({ key, label: columnLabelOverrides?.[key] ?? label })
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
