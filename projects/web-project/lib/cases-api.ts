import { apiFetch } from './api-client';

export type CaseStatus = 'consultation' | 'entrusted' | 'in_progress' | 'closed' | 'terminated';
export type CaseBillingMethod = 'fixed_fee' | 'hourly' | 'contingency' | 'hybrid';
export type CaseOpponentType = 'individual' | 'company';

export interface CaseLawyerInfo {
  id: string;
  name: string | null;
  email: string | null;
  isPrimary: boolean;
  hourlyRate: string | null;
}

export interface CaseListItem {
  id: string;
  name: string;
  status: CaseStatus;
  billingMethod: CaseBillingMethod;
  client: {
    id: string;
    name: string;
  };
  caseType: {
    id: string;
    name: string;
  };
  caseCategory: {
    id: string;
    name: string;
  };
  lawyers: CaseLawyerInfo[];
  primaryLawyerId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CaseListResponse {
  items: CaseListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
}

export interface CaseDetail extends CaseListItem {
  description: string | null;
  court: string | null;
  filingDate: string | null;
  hearingDate: string | null;
  evidenceDeadline: string | null;
  appealDeadline: string | null;
  disputedAmount: string | null;
  materials: CaseMaterial[];
  billing: {
    lawyerFeeTotal: string | null;
    estimatedHours: number | null;
    contingencyRate: string | null;
    otherFeeBudget: string | null;
    paymentPlan: string | null;
  };
  opponent: {
    name: string;
    type: CaseOpponentType;
    idNumber: string | null;
    lawyer: string | null;
    thirdParty: string | null;
  };
}

export interface CaseMaterial {
  id: string;
  filename: string;
  fileType: string | null;
  fileSize: number | null;
  downloadUrl: string;
  uploadedAt: string | null;
  uploadedBy: string | null;
}

export interface FetchCasesParams {
  page?: number;
  pageSize?: number;
  clientId?: string;
  caseTypeId?: string;
  caseCategoryId?: string;
  status?: CaseStatus;
  lawyerId?: string;
  billingMethod?: CaseBillingMethod;
  search?: string;
}

export interface CaseLawyerPayload {
  lawyerId: string;
  isPrimary: boolean;
  hourlyRate?: string | null;
}

export interface CasePayload {
  name: string;
  clientId: string;
  caseTypeId: string;
  caseCategoryId: string;
  status: CaseStatus;
  description?: string | null;
  court?: string | null;
  filingDate?: string | null;
  hearingDate?: string | null;
  evidenceDeadline?: string | null;
  appealDeadline?: string | null;
  disputedAmount?: string | null;
  billingMethod: CaseBillingMethod;
  lawyerFeeTotal?: string | null;
  estimatedHours?: number | null;
  contingencyRate?: string | null;
  otherFeeBudget?: string | null;
  paymentPlan?: string | null;
  opponentName: string;
  opponentType: CaseOpponentType;
  opponentIdNumber?: string | null;
  opponentLawyer?: string | null;
  thirdParty?: string | null;
  lawyers: CaseLawyerPayload[];
  materials?: CaseMaterialUploadItem[];
}

export interface CaseMaterialUploadItem {
  id?: string;
  filename?: string;
  fileType?: string | null;
  fileSize?: number | null;
  base64Data?: string;
}

const buildQueryString = (params: FetchCasesParams) => {
  const searchParams = new URLSearchParams();
  if (params.page) {
    searchParams.set('page', String(params.page));
  }
  if (params.pageSize) {
    searchParams.set('pageSize', String(params.pageSize));
  }
  if (params.clientId) {
    searchParams.set('clientId', params.clientId);
  }
  if (params.caseTypeId) {
    searchParams.set('caseTypeId', params.caseTypeId);
  }
  if (params.caseCategoryId) {
    searchParams.set('caseCategoryId', params.caseCategoryId);
  }
  if (params.status) {
    searchParams.set('status', params.status);
  }
  if (params.lawyerId) {
    searchParams.set('lawyerId', params.lawyerId);
  }
  if (params.billingMethod) {
    searchParams.set('billingMethod', params.billingMethod);
  }
  if (params.search) {
    searchParams.set('search', params.search);
  }
  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

export async function fetchCases(params: FetchCasesParams = {}): Promise<CaseListResponse> {
  const query = buildQueryString(params);
  return apiFetch<CaseListResponse>(`/api/cases${query}`);
}

export async function fetchCaseDetail(id: string): Promise<CaseDetail> {
  return apiFetch<CaseDetail>(`/api/cases/${id}`);
}

export async function createCase(payload: CasePayload): Promise<CaseDetail> {
  return apiFetch<CaseDetail>('/api/cases', {
    method: 'POST',
    body: payload
  });
}

export async function updateCase(id: string, payload: CasePayload): Promise<CaseDetail> {
  return apiFetch<CaseDetail>(`/api/cases/${id}`, {
    method: 'PUT',
    body: payload
  });
}

export async function deleteCase(id: string): Promise<void> {
  await apiFetch<void>(`/api/cases/${id}`, {
    method: 'DELETE'
  });
}
