import { apiFetch } from './api-client';

export type UserRole = 'master' | 'admin' | 'sale' | 'lawyer' | 'assistant';

export interface UserResponse {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  image: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  initialPassword?: string;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  role: UserRole;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  role?: UserRole;
  image?: string | null;
}

export async function fetchUsers(): Promise<UserResponse[]> {
  return apiFetch<UserResponse[]>('/api/users');
}

export async function createUser(payload: CreateUserPayload): Promise<UserResponse> {
  return apiFetch<UserResponse>('/api/users', {
    method: 'POST',
    body: payload
  });
}

export async function updateUser(id: string, payload: UpdateUserPayload): Promise<UserResponse> {
  return apiFetch<UserResponse>(`/api/users/${id}`, {
    method: 'PUT',
    body: payload
  });
}

export async function deleteUser(id: string): Promise<void> {
  await apiFetch<void>(`/api/users/${id}`, {
    method: 'DELETE'
  });
}
