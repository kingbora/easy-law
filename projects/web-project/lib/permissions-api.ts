import { apiFetch } from './api-client';
import type { UserRole } from './users-api';

export type PermissionCategory = 'menu' | 'action';

export interface PermissionDefinition {
  code: string;
  name: string;
  category: PermissionCategory;
  description: string | null;
}

export interface PermissionRoleInfo {
  role: UserRole;
  label: string;
  description: string | null;
  editable: boolean;
}

export interface PermissionsOverviewResponse {
  roles: PermissionRoleInfo[];
  permissions: PermissionDefinition[];
  assignments: Record<UserRole, string[]>;
}

export interface UpdateRolePermissionsPayload {
  assignments: Array<{
    role: UserRole;
    permissions: string[];
  }>;
}

export async function fetchPermissionsOverview(): Promise<PermissionsOverviewResponse> {
  return apiFetch<PermissionsOverviewResponse>('/api/permissions');
}

export async function updateRolePermissions(payload: UpdateRolePermissionsPayload): Promise<void> {
  await apiFetch('/api/permissions/assignments', {
    method: 'PUT',
    body: payload
  });
}
