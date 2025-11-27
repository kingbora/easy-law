import type {
  DepartmentMenuConfig,
  UpdateDepartmentMenuConfigPayload,
  UserDepartment
} from '@easy-law/shared-types';

import { apiFetch } from './api-client';

interface MenuConfigResponse {
  data: DepartmentMenuConfig;
}

export async function fetchDepartmentMenuConfig(department?: UserDepartment): Promise<DepartmentMenuConfig> {
  const query = department ? `?department=${department}` : '';
  const response = await apiFetch<MenuConfigResponse>(`/api/menu-config${query}`);
  return response.data;
}

export async function updateDepartmentMenuConfig(
  department: UserDepartment,
  payload: UpdateDepartmentMenuConfigPayload
): Promise<DepartmentMenuConfig> {
  const response = await apiFetch<MenuConfigResponse>(`/api/menu-config`, {
    method: 'PUT',
    body: {
      department,
      ...payload
    }
  });
  return response.data;
}
