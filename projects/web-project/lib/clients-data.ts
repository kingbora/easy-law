import type { ClientGender, ClientSource, ClientStatus, ClientType } from './clients-api';

export const CLIENT_TYPE_LABELS: Record<ClientType, string> = {
  individual: '自然人',
  company: '企业'
};

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  potential: '潜在客户',
  active: '签约客户',
  dormant: '沉睡客户',
  lost: '流失客户'
};

export const CLIENT_STATUS_COLOR_MAP: Record<ClientStatus, string> = {
  potential: 'gold',
  active: 'green',
  dormant: 'blue',
  lost: 'red'
};

export const CLIENT_SOURCE_LABELS: Record<ClientSource, string> = {
  referral: '转介绍',
  website: '官网咨询',
  offline_event: '线下活动',
  other: '其他渠道'
};

export const CLIENT_GENDER_LABELS: Record<ClientGender, string> = {
  male: '男',
  female: '女'
};

export const CLIENT_TYPE_OPTIONS = Object.entries(CLIENT_TYPE_LABELS).map(([value, label]) => ({
  value: value as ClientType,
  label
}));

export const CLIENT_STATUS_OPTIONS = Object.entries(CLIENT_STATUS_LABELS).map(([value, label]) => ({
  value: value as ClientStatus,
  label
}));

export const CLIENT_SOURCE_OPTIONS = Object.entries(CLIENT_SOURCE_LABELS).map(([value, label]) => ({
  value: value as ClientSource,
  label
}));

export const CLIENT_GENDER_OPTIONS = Object.entries(CLIENT_GENDER_LABELS).map(([value, label]) => ({
  value: value as ClientGender,
  label
}));
