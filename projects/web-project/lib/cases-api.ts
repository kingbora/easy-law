import { ApiError, apiFetch } from './api-client';
import type {
  AssignableStaffResponse,
  CaseChangeLog,
  CaseCollectionRecord,
  CaseHearingRecord,
  CaseListQuery,
  CaseListResponse,
  CasePayload,
  CaseRecord,
  CaseTableColumnKey,
  CaseTablePreference,
  CaseTimeNodeInput,
  CaseTimeNodeRecord,
  CaseUpdateConflictDetails,
  CaseUpdateRequest,
  CreateCaseCollectionPayload,
  UserDepartment
} from '@easy-law/shared-types';

export class CaseUpdateConflictError extends ApiError {
  override details: CaseUpdateConflictDetails;

  constructor(message: string, details: CaseUpdateConflictDetails) {
    super(message, 409, details);
    this.name = 'CaseUpdateConflictError';
    this.details = details;
  }
}

function isCaseUpdateConflictDetails(value: unknown): value is CaseUpdateConflictDetails {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.type !== 'string') {
    return false;
  }
  if (typeof record.caseId !== 'string') {
    return false;
  }
  if (typeof record.latestVersion !== 'number') {
    return false;
  }
  if (!Array.isArray(record.remoteChanges) || !Array.isArray(record.clientChanges)) {
    return false;
  }
  return true;
}

function extractConflictDetails(payload: unknown): CaseUpdateConflictDetails | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const data = payload as Record<string, unknown>;
  const maybeDetails = data.details ?? payload;
  return isCaseUpdateConflictDetails(maybeDetails) ? (maybeDetails as CaseUpdateConflictDetails) : null;
}

interface CaseDetailResponse {
  data: CaseRecord;
}

function buildQueryString(query?: CaseListQuery): string {
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

export async function fetchCases(query?: CaseListQuery): Promise<CaseListResponse> {
  const queryString = buildQueryString(query);
  return apiFetch<CaseListResponse>(`/api/cases${queryString}`);
}

export async function fetchCaseById(id: string): Promise<CaseRecord> {
  const response = await apiFetch<CaseDetailResponse>(`/api/cases/${id}`);
  return response.data;
}

export async function createCase(payload: CasePayload): Promise<CaseRecord> {
  const response = await apiFetch<CaseDetailResponse>(`/api/cases`, {
    method: 'POST',
    body: payload
  });
  return response.data;
}

export async function updateCase(id: string, input: CasePayload | CaseUpdateRequest): Promise<CaseRecord> {
  const requestBody: CaseUpdateRequest =
    input && typeof input === 'object' && 'payload' in input
      ? {
          payload: (input as CaseUpdateRequest).payload,
          meta: (input as CaseUpdateRequest).meta ?? undefined
        }
      : {
          payload: input as CasePayload
        };

  try {
    const response = await apiFetch<CaseDetailResponse>(`/api/cases/${id}`, {
      method: 'PUT',
      body: requestBody
    });
    return response.data;
  } catch (error) {
    if (error instanceof ApiError && error.status === 409) {
      const details = extractConflictDetails(error.details);
      if (details) {
        throw new CaseUpdateConflictError(error.message, details);
      }
    }
    throw error;
  }
}

export async function deleteCase(id: string): Promise<void> {
  await apiFetch<void>(`/api/cases/${id}`, {
    method: 'DELETE'
  });
}

export async function createCaseCollection(
  caseId: string,
  payload: CreateCaseCollectionPayload
): Promise<CaseCollectionRecord> {
  const response = await apiFetch<{ data: CaseCollectionRecord }>(`/api/cases/${caseId}/collections`, {
    method: 'POST',
    body: payload
  });
  return response.data;
}

export async function fetchCaseChangeLogs(id: string): Promise<CaseChangeLog[]> {
  const response = await apiFetch<{ data: CaseChangeLog[] }>(`/api/cases/${id}/change-logs`);
  return response.data;
}

export async function fetchCaseHearings(id: string): Promise<CaseHearingRecord[]> {
  const response = await apiFetch<{ data: CaseHearingRecord[] }>(`/api/cases/${id}/hearings`);
  return response.data;
}

export async function updateCaseTimeNodes(
  caseId: string,
  payload: CaseTimeNodeInput[]
): Promise<CaseTimeNodeRecord[]> {
  const response = await apiFetch<{ data: CaseTimeNodeRecord[] }>(`/api/cases/${caseId}/time-nodes`, {
    method: 'PUT',
    body: payload
  });
  return response.data;
}

export async function fetchAssignableStaff(params?: {
  department?: UserDepartment;
}): Promise<AssignableStaffResponse> {
  const query = new URLSearchParams();
  if (params?.department) {
    query.set('department', params.department);
  }
  const queryString = query.toString();
  const response = await apiFetch<{ data: AssignableStaffResponse }>(
    `/api/cases/assignable-staff${queryString ? `?${queryString}` : ''}`
  );
  return response.data;
}

export async function fetchCaseTablePreferences(tableKey: string): Promise<CaseTablePreference> {
  const query = tableKey ? `?tableKey=${encodeURIComponent(tableKey)}` : '';
  const response = await apiFetch<{ data: CaseTablePreference }>(
    `/api/cases/column-preferences${query}`
  );
  return response.data;
}

export async function updateCaseTablePreferences(
  tableKey: string,
  visibleColumns: CaseTableColumnKey[]
): Promise<CaseTablePreference> {
  const response = await apiFetch<{ data: CaseTablePreference }>(`/api/cases/column-preferences`, {
    method: 'PUT',
    body: {
      tableKey,
      visibleColumns
    }
  });
  return response.data;
}
