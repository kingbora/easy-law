export const USER_ROLES = [
  'super_admin',
  'admin',
  'administration',
  'lawyer',
  'assistant',
  'sale'
] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const USER_DEPARTMENTS = ['work_injury', 'insurance'] as const;

export type UserDepartment = (typeof USER_DEPARTMENTS)[number];

export const CASE_TYPES = ['work_injury', 'personal_injury', 'other'] as const;

export type CaseType = (typeof CASE_TYPES)[number];

export const CASE_LEVELS = ['A', 'B', 'C'] as const;

export type CaseLevel = (typeof CASE_LEVELS)[number];

export const CASE_STATUS = ['open', 'closed', 'void'] as const;

export type CaseStatus = (typeof CASE_STATUS)[number];

export const CASE_CATEGORIES = ['work_injury', 'insurance'] as const;

export type CaseCategory = (typeof CASE_CATEGORIES)[number];

export const CONTRACT_QUOTE_TYPES = ['fixed', 'risk', 'other'] as const;

export type ContractQuoteType = (typeof CONTRACT_QUOTE_TYPES)[number];

export const LITIGATION_FEE_TYPES = ['party_pay', 'law_firm_advance', 'other'] as const;

export type LitigationFeeType = (typeof LITIGATION_FEE_TYPES)[number];

export const TRAVEL_FEE_TYPES = ['law_firm_advance', 'reimbursed', 'other'] as const;

export type TravelFeeType = (typeof TRAVEL_FEE_TYPES)[number];

export const CONTRACT_FORM_TYPES = ['electronic', 'paper'] as const;

export type ContractFormType = (typeof CONTRACT_FORM_TYPES)[number];

export const CASE_TIME_NODE_TYPES = [
  'apply_employment_confirmation',
  'labor_arbitration_decision',
  'submit_injury_certification',
  'receive_injury_certification',
  'submit_disability_assessment',
  'receive_disability_assessment',
  'apply_insurance_arbitration',
  'insurance_arbitration_decision',
  'file_lawsuit',
  'lawsuit_review_approved',
  'final_judgement'
] as const;

export type CaseTimeNodeType = (typeof CASE_TIME_NODE_TYPES)[number];

export const TRIAL_STAGES = ['arbitration', 'first_instance', 'second_instance', 'retrial'] as const;

export type TrialStage = (typeof TRIAL_STAGES)[number];

export const CASE_PARTICIPANT_ENTITIES = ['personal', 'organization'] as const;

export type CaseParticipantEntity = (typeof CASE_PARTICIPANT_ENTITIES)[number];

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
  note: string | null;
  followerId: string | null;
  followerName: string | null;
}

export interface CaseChangeDetail {
  field: string;
  label: string;
  previousValue: string | null;
  currentValue: string | null;
}

export interface CaseChangeListItem {
  id: string;
  action: string;
  field: string | null;
  fieldLabel: string | null;
  previousValue: string | null;
  currentValue: string | null;
}

export interface CaseChangeLog {
  id: string;
  action: string;
  remark: string | null;
  actorId: string | null;
  actorName: string | null;
  actorRole: UserRole | string | null;
  createdAt: string;
  changeList: CaseChangeListItem[];
}

export interface CaseUpdateConflictField {
  field: string;
  label: string;
  baseValue: string | null;
  remoteValue?: string | null;
  clientValue?: string | null;
}

export type CaseUpdateConflictType = 'hard' | 'mergeable';

export interface CaseUpdateConflictDetails {
  type: CaseUpdateConflictType;
  message: string;
  caseId: string;
  baseVersion: number | null;
  latestVersion: number;
  remoteChanges: CaseUpdateConflictField[];
  clientChanges: CaseUpdateConflictField[];
  conflictingFields: string[];
  updatedAt: string;
  updatedById: string | null;
  updatedByName: string | null;
  updatedByRole: UserRole | string | null;
}

export interface CaseTimeNodeRecord {
  id: string;
  nodeType: CaseTimeNodeType;
  occurredOn: string;
  createdAt: string;
  updatedAt: string;
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
  caseCategory: CaseCategory;
  province: string | null;
  city: string | null;
  targetAmount: string | null;
  agencyFeeEstimate: string | null;
  dataSource: string | null;
  hasContract: boolean | null;
  contractDate: string | null;
  clueDate: string | null;
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
  contractQuoteType: ContractQuoteType | null;
  contractQuoteAmount: string | null;
  contractQuoteUpfront: string | null;
  contractQuoteRatio: string | null;
  contractQuoteOther: string | null;
  estimatedCollection: string | null;
  litigationFeeType: LitigationFeeType | null;
  travelFeeType: TravelFeeType | null;
  contractForm: ContractFormType | null;
  insuranceRiskLevel: CaseLevel | null;
  insuranceTypes: string[];
  insuranceMisrepresentations: string[];
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
  version: number;
  updaterId: string | null;
  updaterName: string | null;
  updaterRole: UserRole | string | null;
  createdAt: string;
  updatedAt: string;
  participants: CaseParticipantsGroup;
  collections: CaseCollectionRecord[];
  timeNodes: CaseTimeNodeRecord[];
  timeline: CaseTimelineRecord[];
  hearings: CaseHearingRecord[];
}

export type CaseResponsibleRole = Extract<UserRole, 'sale' | 'lawyer' | 'assistant'>;

export const CASE_RESPONSIBLE_FILTER_OTHERS = '__others__' as const;

export type CaseResponsibleFilterValue =
  | `${CaseResponsibleRole}:${string}`
  | typeof CASE_RESPONSIBLE_FILTER_OTHERS;

export type CaseTableColumnKey =
  | 'caseNumber'
  | 'caseStatus'
  | 'caseType'
  | 'caseLevel'
  | 'partyNames'
  | 'provinceCity'
  | 'responsibleStaff'
  | 'collectionAmount'
  | 'contractDate'
  | 'clueDate'
  | 'targetAmount'
  | 'contractForm'
  | 'insuranceTypes'
  | 'dataSource'
  | 'entryDate'
  | 'createdAt'
  | 'updatedAt';

export interface CaseTablePreference {
  tableKey: string;
  visibleColumns: CaseTableColumnKey[];
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
  sales: AssignableStaffMember[];
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
  caseNumber?: string;
  caseType?: CaseType;
  caseLevel?: CaseLevel;
  caseStatus?: CaseStatus;
  caseId?: string;
  partyName?: string;
  responsible?: CaseResponsibleFilterValue;
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

export interface CaseTimeNodeInput {
  nodeType: CaseTimeNodeType;
  occurredOn: string | Date;
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
  caseCategory?: CaseCategory | null;
  province?: string | null;
  city?: string | null;
  targetAmount?: string | number | null;
  agencyFeeEstimate?: string | number | null;
  dataSource?: string | null;
  hasContract?: boolean | null;
  contractDate?: string | Date | null;
  clueDate?: string | Date | null;
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
  contractQuoteType?: ContractQuoteType | null;
  contractQuoteAmount?: string | number | null;
  contractQuoteUpfront?: string | number | null;
  contractQuoteRatio?: string | number | null;
  contractQuoteOther?: string | null;
  estimatedCollection?: string | number | null;
  litigationFeeType?: LitigationFeeType | null;
  travelFeeType?: TravelFeeType | null;
  contractForm?: ContractFormType | null;
  insuranceRiskLevel?: CaseLevel | null;
  insuranceTypes?: string[] | null;
  insuranceMisrepresentations?: string[] | null;
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
  timeNodes?: CaseTimeNodeInput[];
}

export interface CaseUpdateMeta {
  baseVersion?: number | null;
  baseSnapshot?: Record<string, unknown> | null;
  dirtyFields?: string[] | null;
  resolveMode?: 'merge';
}

export interface CaseUpdateRequest {
  payload: CasePayload;
  meta?: CaseUpdateMeta | null;
}

export interface ListCasesOptions extends CaseListQuery {}

export interface DepartmentMenuConfig {
  department: UserDepartment;
  dataSources: string[];
  trialStages: TrialStage[];
  updatedBy?: string | null;
  updatedAt?: string | null;
}

export interface UpdateDepartmentMenuConfigPayload {
  dataSources?: string[];
  trialStages?: TrialStage[];
}