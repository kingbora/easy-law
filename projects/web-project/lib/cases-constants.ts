import type { CaseBillingMethod, CaseStatus } from './cases-api';

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  consultation: '咨询中',
  entrusted: '已委托',
  in_progress: '办理中',
  closed: '已结案',
  terminated: '终止代理'
};

export const CASE_BILLING_METHOD_LABELS: Record<CaseBillingMethod, string> = {
  fixed_fee: '固定收费',
  hourly: '按小时收费',
  contingency: '风险代理',
  hybrid: '混合收费'
};

export const CASE_STATUS_OPTIONS = (Object.entries(CASE_STATUS_LABELS) as Array<[CaseStatus, string]>).map(
  ([value, label]) => ({ value, label })
);

export const CASE_BILLING_METHOD_OPTIONS = (
  Object.entries(CASE_BILLING_METHOD_LABELS) as Array<[CaseBillingMethod, string]>
).map(([value, label]) => ({ value, label }));
