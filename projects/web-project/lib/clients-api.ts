import { apiFetch } from './api-client';
import type { CaseLevel, CaseStatus, CaseType } from './cases-api';
import type { UserDepartment } from './users-api';

export interface ClientListQuery {
  page?: number;
  pageSize?: number;
  department?: UserDepartment | null;
  search?: string;
}

export interface CaseClientRecord {
  id: string;
  name: string;
  entityType: 'personal' | 'organization' | null;
  phone: string | null;
  idNumber: string | null;
  caseId: string;
  caseType: CaseType;
  caseLevel: CaseLevel;
  caseStatus: CaseStatus | null;
  department: UserDepartment | null;
  assignedSaleName: string | null;
  assignedLawyerName: string | null;
  assignedAssistantName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CaseClientDetail extends CaseClientRecord {
  address: string | null;
  isDishonest: boolean;
}

export interface UpdateCaseClientPayload {
  name?: string;
  entityType?: 'personal' | 'organization' | null;
  phone?: string | null;
  idNumber?: string | null;
  address?: string | null;
  isDishonest?: boolean | null;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ClientListResponse {
  data: CaseClientRecord[];
  pagination: PaginationMeta;
}

function buildQueryString(query?: ClientListQuery): string {
  if (!query) {
    return '';
  }

  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value === null || value === undefined || value === '') {
      return;
    }
    params.set(key, typeof value === 'number' ? value.toString(10) : String(value));
  });

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

export async function fetchClients(query?: ClientListQuery): Promise<ClientListResponse> {
  const queryString = buildQueryString(query);
  return apiFetch<ClientListResponse>(`/api/clients${queryString}`);
}

export async function fetchClientDetail(id: string): Promise<CaseClientDetail> {
  return apiFetch<CaseClientDetail>(`/api/clients/${id}`);
}

export async function updateClientDetail(
  id: string,
  payload: UpdateCaseClientPayload
): Promise<CaseClientDetail> {
  return apiFetch<CaseClientDetail>(`/api/clients/${id}`, {
    method: 'PATCH',
    body: payload
  });
}
