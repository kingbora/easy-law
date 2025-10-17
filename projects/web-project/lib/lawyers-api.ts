import { apiFetch } from './api-client';

export interface LawyerResponse {
  id: string;
  name: string | null;
  email: string | null;
  role: 'master' | 'admin' | 'sale' | 'lawyer' | 'assistant';
}

export async function searchLawyers(keyword?: string): Promise<LawyerResponse[]> {
  const query = keyword && keyword.trim().length > 0 ? `?keyword=${encodeURIComponent(keyword.trim())}` : '';
  return apiFetch<LawyerResponse[]>(`/api/lawyers/search${query}`);
}
