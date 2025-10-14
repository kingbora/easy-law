import { apiFetch } from './api-client';

export type ClientType = 'individual' | 'company';
export type ClientStatus = 'potential' | 'active' | 'dormant' | 'lost';
export type ClientSource = 'referral' | 'website' | 'offline_event' | 'other';
export type ClientGender = 'male' | 'female';

export interface ClientListItem {
  id: string;
  name: string;
  type: ClientType;
  phone: string;
  responsibleLawyer: {
    id: string;
    name: string | null;
  } | null;
  status: ClientStatus;
  tags: string[];
  source: ClientSource | null;
  createdAt: string | null;
}

export interface ClientListResponse {
  items: ClientListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
}

export interface ClientAttachment {
  id: string;
  filename: string;
  fileType: string | null;
  fileUrl: string;
  description: string | null;
  uploadedAt: string | null;
  uploadedBy: string | null;
}

export interface ClientIndividualProfile {
  idCardNumber: string;
  gender: ClientGender | null;
  occupation: string | null;
}

export interface ClientCompanyProfile {
  unifiedCreditCode: string;
  companyType: string | null;
  industry: string | null;
  registeredCapital: string | null;
  legalRepresentative: string | null;
}

export interface ClientDetail extends ClientListItem {
  email: string | null;
  address: string | null;
  sourceRemark: string | null;
  remark: string | null;
  updatedAt: string | null;
  individualProfile: ClientIndividualProfile | null;
  companyProfile: ClientCompanyProfile | null;
  attachments: ClientAttachment[];
}

export interface FetchClientsParams {
  page?: number;
  pageSize?: number;
  name?: string;
  type?: ClientType;
  source?: ClientSource;
  status?: ClientStatus;
}

export interface ClientPayload {
  name: string;
  type: ClientType;
  phone: string;
  email?: string | null;
  address?: string | null;
  source?: ClientSource | null;
  sourceRemark?: string | null;
  status?: ClientStatus | null;
  responsibleLawyerId: string;
  tags?: string[];
  remark?: string | null;
  individualProfile?: {
    idCardNumber: string;
    gender?: ClientGender | null;
    occupation?: string | null;
  };
  companyProfile?: {
    unifiedCreditCode: string;
    companyType?: string | null;
    industry?: string | null;
    registeredCapital?: string | number | null;
    legalRepresentative?: string | null;
  };
  attachments?: Array<{
    filename: string;
    fileType?: string | null;
    fileUrl: string;
    description?: string | null;
  }>;
}

const buildQueryString = (params: FetchClientsParams) => {
  const searchParams = new URLSearchParams();
  if (params.page) {
    searchParams.set('page', String(params.page));
  }
  if (params.pageSize) {
    searchParams.set('pageSize', String(params.pageSize));
  }
  if (params.name) {
    searchParams.set('name', params.name);
  }
  if (params.type) {
    searchParams.set('type', params.type);
  }
  if (params.source) {
    searchParams.set('source', params.source);
  }
  if (params.status) {
    searchParams.set('status', params.status);
  }
  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
};

export async function fetchClients(params: FetchClientsParams = {}): Promise<ClientListResponse> {
  const queryString = buildQueryString(params);
  return apiFetch<ClientListResponse>(`/api/clients${queryString}`);
}

export async function fetchClientDetail(id: string): Promise<ClientDetail> {
  return apiFetch<ClientDetail>(`/api/clients/${id}`);
}

export async function createClient(payload: ClientPayload): Promise<ClientDetail> {
  return apiFetch<ClientDetail>('/api/clients', {
    method: 'POST',
    body: payload
  });
}

export async function updateClient(id: string, payload: ClientPayload): Promise<ClientDetail> {
  return apiFetch<ClientDetail>(`/api/clients/${id}`, {
    method: 'PUT',
    body: payload
  });
}

export async function deleteClient(id: string): Promise<void> {
  await apiFetch<void>(`/api/clients/${id}`, {
    method: 'DELETE'
  });
}
