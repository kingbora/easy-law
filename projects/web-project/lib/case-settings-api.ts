import { apiFetch } from './api-client';

export interface CaseCategoryItem {
  id: string;
  name: string;
  sortIndex: number;
  isSystem: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CaseTypeItem {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  categories: CaseCategoryItem[];
}

export interface CaseTypePayload {
  name: string;
  description?: string | null;
  categories?: Array<{
    id?: string;
    name: string;
  }>;
}

export async function fetchCaseTypes(): Promise<CaseTypeItem[]> {
  return apiFetch<CaseTypeItem[]>('/api/case-settings');
}

export async function createCaseType(payload: CaseTypePayload): Promise<CaseTypeItem> {
  return apiFetch<CaseTypeItem>('/api/case-settings', {
    method: 'POST',
    body: payload
  });
}

export async function updateCaseType(id: string, payload: CaseTypePayload): Promise<CaseTypeItem> {
  return apiFetch<CaseTypeItem>(`/api/case-settings/${id}`, {
    method: 'PUT',
    body: payload
  });
}

export async function deleteCaseType(id: string): Promise<void> {
  await apiFetch<void>(`/api/case-settings/${id}`, {
    method: 'DELETE'
  });
}
