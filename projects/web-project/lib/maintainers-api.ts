import { apiFetch } from './api-client';

export interface MaintainerResponse {
  id: string;
  name: string | null;
  email: string | null;
}

export async function searchMaintainers(keyword?: string): Promise<MaintainerResponse[]> {
  const query = keyword && keyword.trim().length > 0 ? `?keyword=${encodeURIComponent(keyword.trim())}` : '';
  return apiFetch<MaintainerResponse[]>(`/api/maintainers/search${query}`);
}
