import { apiFetch } from './api-client';
import type { UserDepartment, UserRole } from './users-api';

export type CaseType = 'work_injury' | 'personal_injury' | 'other';
export type CaseLevel = 'A' | 'B' | 'C';
export type CaseStatus = '未结案' | '已结案' | '废单';
export type TrialStage = 'first_instance' | 'second_instance' | 'retrial';

export type CaseParticipantEntity = 'personal' | 'organization';

export interface CaseParticipant {
  id: string;
  entityType: CaseParticipantEntity | null;
  name: string;
  idNumber: string | null;
  phone: string | null;
  address: string | null;
  isDishonest: boolean;
  sortOrder: number | null;
}

export interface CaseCollectionRecord {
  id: string;
  amount: string;
  receivedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCaseCollectionPayload {
  amount: string | number;
  receivedAt?: string | Date | null;
}

export interface CaseTimelineRecord {
  id: string;
  occurredOn: string;
  createdAt: string;
  updatedAt: string;
  note: string;
  followerId: string | null;
  followerName: string | null;
}

export interface CaseChangeDetail {
  field: string;
  label: string;
  previousValue: string | null;
  currentValue: string | null;
}

export interface CaseChangeLog {
  id: string;
  action: string;
  description: string | null;
  changes: CaseChangeDetail[] | null;
  actorId: string | null;
  actorName: string | null;
  actorRole: UserRole | string | null;
  createdAt: string;
}

export interface CaseParticipantsGroup {
  claimants?: CaseParticipant[];
  respondents?: CaseParticipant[];
}

export interface CaseHearingRecord {
  id: string;
  trialLawyerId: string | null;
  trialLawyerName: string | null;
  hearingTime: string | null;
  hearingLocation: string | null;
  tribunal: string | null;
  judge: string | null;
  caseNumber: string | null;
  contactPhone: string | null;
  trialStage: TrialStage | null;
  hearingResult: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CaseRecord {
  id: string;
  caseType: CaseType;
  caseLevel: CaseLevel;
  provinceCity: string | null;
  targetAmount: string | null;
  feeStandard: string | null;
  agencyFeeEstimate: string | null;
  dataSource: string | null;
  hasContract: boolean | null;
  hasSocialSecurity: boolean | null;
  entryDate: string | null;
  injuryLocation: string | null;
  injurySeverity: string | null;
  injuryCause: string | null;
  workInjuryCertified: boolean | null;
  monthlySalary: string | null;
  appraisalLevel: string | null;
  appraisalEstimate: string | null;
  existingEvidence: string | null;
  customerCooperative: boolean | null;
  witnessCooperative: boolean | null;
  remark: string | null;
  department: UserDepartment | null;
  assignedSaleId: string | null;
  assignedSaleName: string | null;
  assignedLawyerId: string | null;
  assignedLawyerName: string | null;
  assignedAssistantId: string | null;
  assignedAssistantName: string | null;
  caseStatus: CaseStatus | null;
  closedReason: string | null;
  voidReason: string | null;
  salesCommission: string | null;
  handlingFee: string | null;
  createdAt: string;
  updatedAt: string;
  participants: CaseParticipantsGroup;
  collections: CaseCollectionRecord[];
  timeline: CaseTimelineRecord[];
  hearings: CaseHearingRecord[];
}

export interface AssignableStaffMember {
  id: string;
  name: string | null;
  role: UserRole;
  department: UserDepartment | null;
}

export interface AssignableStaffResponse {
  lawyers: AssignableStaffMember[];
  assistants: AssignableStaffMember[];
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CaseListResponse {
  data: CaseRecord[];
  pagination: PaginationMeta;
}

export interface CaseListQuery {
  page?: number;
  pageSize?: number;
  department?: UserDepartment;
  assignedSaleId?: string;
  assignedLawyerId?: string;
  caseType?: CaseType;
  caseLevel?: CaseLevel;
  caseStatus?: CaseStatus;
  search?: string;
  orderBy?: 'createdAt' | 'updatedAt';
  orderDirection?: 'asc' | 'desc';
}

export interface CaseParticipantInput {
  entityType?: CaseParticipantEntity | null;
  name?: string | null;
  idNumber?: string | null;
  phone?: string | null;
  address?: string | null;
  isDishonest?: boolean | null;
  sortOrder?: number | null;
}

export interface CaseParticipantsInput {
  claimants?: CaseParticipantInput[];
  respondents?: CaseParticipantInput[];
}

export interface CaseCollectionInput {
  id?: string;
  amount?: string | number | null;
  receivedAt?: string | Date | null;
}

export interface CaseTimelineInput {
  id?: string;
  occurredOn: string | Date;
  note: string | null;
  followerId?: string | null;
}

export interface CaseHearingInput {
  trialLawyerId?: string | null;
  hearingTime?: string | Date | null;
  hearingLocation?: string | null;
  tribunal?: string | null;
  judge?: string | null;
  caseNumber?: string | null;
  contactPhone?: string | null;
  trialStage?: TrialStage | null;
  hearingResult?: string | null;
}

export interface CasePayload {
  caseType: CaseType;
  caseLevel: CaseLevel;
  provinceCity?: string | null;
  targetAmount?: string | number | null;
  feeStandard?: string | null;
  agencyFeeEstimate?: string | number | null;
  dataSource?: string | null;
  hasContract?: boolean | null;
  hasSocialSecurity?: boolean | null;
  entryDate?: string | Date | null;
  injuryLocation?: string | null;
  injurySeverity?: string | null;
  injuryCause?: string | null;
  workInjuryCertified?: boolean | null;
  monthlySalary?: string | number | null;
  appraisalLevel?: string | null;
  appraisalEstimate?: string | null;
  existingEvidence?: string | null;
  customerCooperative?: boolean | null;
  witnessCooperative?: boolean | null;
  remark?: string | null;
  department?: UserDepartment | null;
  assignedSaleId?: string | null;
  assignedLawyerId?: string | null;
  assignedAssistantId?: string | null;
  caseStatus?: CaseStatus | null;
  closedReason?: string | null;
  voidReason?: string | null;
  salesCommission?: string | number | null;
  handlingFee?: string | number | null;
  participants?: CaseParticipantsInput;
  collections?: CaseCollectionInput[];
  timeline?: CaseTimelineInput[];
  hearings?: CaseHearingInput[] | null;
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

export async function updateCase(id: string, payload: CasePayload): Promise<CaseRecord> {
  const response = await apiFetch<CaseDetailResponse>(`/api/cases/${id}`, {
    method: 'PUT',
    body: payload
  });
  return response.data;
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
