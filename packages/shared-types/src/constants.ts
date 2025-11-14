import type { CaseLevel, CaseStatus, CaseType, ContractFormType, TrialStage, UserDepartment, UserRole } from './types';

export const ROLE_LABEL_MAP: Record<UserRole, string> = {
  super_admin: '超级管理员',
  admin: '管理员',
  administration: '行政',
  lawyer: '律师',
  assistant: '律助',
  sale: '销售'
};

export const ROLE_COLOR_MAP: Record<UserRole, string> = {
  super_admin: 'volcano',
  admin: 'geekblue',
  sale: 'purple',
  lawyer: 'green',
  assistant: 'blue',
  administration: 'orange'
};

export const DEPARTMENT_LABEL_MAP: Record<UserDepartment, string> = {
  work_injury: '工伤部门',
  insurance: '保险部门'
};

export const DEPARTMENT_COLOR_MAP: Record<UserDepartment, string> = {
  work_injury: 'geekblue',
  insurance: 'gold'
};

export const CASE_STATUS_LABEL_MAP: Record<CaseStatus, string> = {
  open: '跟进中',
  closed: '已结案',
  void: '废单'
};

export const CASE_TYPE_LABEL_MAP: Record<CaseType, string> = {
  work_injury: '工伤',
  personal_injury: '人损',
  other: '其他'
};

export const CASE_STATUS_COLOR_MAP: Record<CaseStatus, string> = {
  open: 'blue',
  closed: 'green',
  void: 'default'
};

export const CASE_LEVEL_LABEL_MAP: Record<CaseLevel, string> = {
  A: 'A',
  B: 'B',
  C: 'C'
};

export const CONTRACT_FORM_LABELS: Record<ContractFormType, string> = {
  electronic: '电子合同',
  paper: '纸质合同'
};

export const TRIAL_STAGE_LABEL_MAP: Record<TrialStage, string> = {
  first_instance: '一审',
  second_instance: '二审',
  retrial: '再审'
};