import { apiFetch } from './api-client';
import type { UserDepartment, UserRole } from './users-api';

export type CaseType = 'work_injury' | 'personal_injury' | 'other';
export type CaseLevel = 'A' | 'B' | 'C';
export type CaseStatus = '未结案' | '已结案' | '废单';
export type TrialStage = 'first_instance' | 'second_instance' | 'retrial';
export type CaseTimelineNode =
  | 'apply_labor_confirmation'
  | 'receive_labor_confirmation_award'
  | 'apply_work_injury_certification'
  | 'receive_work_injury_decision'
  | 'apply_work_ability_appraisal'
  | 'receive_work_ability_conclusion'
  | 'apply_work_injury_benefit_award'
  | 'lawsuit_filed'
  | 'filing_approved'
  | 'judgment_time';

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

export interface CaseTimelineRecord {
  id: string;
  nodeType: CaseTimelineNode;
  occurredOn: string;
  createdAt: string;
  updatedAt: string;
  note: string | null;
  followerId: string | null;
  followerName: string | null;
}

export interface CaseParticipantsGroup {
  claimants?: CaseParticipant[];
  respondents?: CaseParticipant[];
}

export interface CaseHearingRecord {
  hearingTime: string | null;
  hearingLocation: string | null;
  tribunal: string | null;
  judge: string | null;
  caseNumber: string | null;
  contactPhone: string | null;
  trialStage: TrialStage | null;
  hearingResult: string | null;
}

export interface CaseRecord {
  id: string;
  referenceNo: string | null;
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
  ownerId: string | null;
  assignedLawyerId: string | null;
  assignedAssistantId: string | null;
  assignedTrialLawyerId: string | null;
  caseStatus: CaseStatus | null;
  closedReason: string | null;
  voidReason: string | null;
  lawyerProgress: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  participants: CaseParticipantsGroup;
  collections: CaseCollectionRecord[];
  timeline: CaseTimelineRecord[];
  hearing: CaseHearingRecord | null;
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
  ownerId?: string;
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
  nodeType: CaseTimelineNode;
  occurredOn: string | Date;
  note?: string | null;
  followerId?: string | null;
}

export interface CaseHearingInput {
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
  referenceNo?: string | null;
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
  ownerId?: string | null;
  assignedLawyerId?: string | null;
  assignedAssistantId?: string | null;
  assignedTrialLawyerId?: string | null;
  caseStatus?: CaseStatus | null;
  closedReason?: string | null;
  voidReason?: string | null;
  lawyerProgress?: Record<string, unknown> | null;
  participants?: CaseParticipantsInput;
  collections?: CaseCollectionInput[];
  timeline?: CaseTimelineInput[];
  hearing?: CaseHearingInput | null;
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
