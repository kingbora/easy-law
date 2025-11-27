import type { DepartmentMenuConfig, UpdateDepartmentMenuConfigPayload, UserDepartment } from '@easy-law/shared-types';

import { ApiError } from '@/lib/api-client';
import { fetchDepartmentMenuConfig, updateDepartmentMenuConfig } from '@/lib/menu-config-api';

import { createAppStore } from './createStore';

interface MenuConfigState {
  configs: Partial<Record<UserDepartment, DepartmentMenuConfig>>;
  loadingMap: Partial<Record<UserDepartment, boolean>>;
  errorMap: Partial<Record<UserDepartment, string | null>>;
  fetchConfig: (department: UserDepartment, options?: { force?: boolean }) => Promise<DepartmentMenuConfig>;
  updateConfig: (department: UserDepartment, payload: UpdateDepartmentMenuConfigPayload) => Promise<DepartmentMenuConfig>;
  clearConfig: (department?: UserDepartment) => void;
}

export const useMenuConfigStore = createAppStore<MenuConfigState>((set, get) => ({
  configs: {},
  loadingMap: {},
  errorMap: {},
  async fetchConfig(department, options) {
    const force = options?.force ?? false;
    const state = get();
    if (!force && state.configs[department]) {
      return state.configs[department] as DepartmentMenuConfig;
    }

    set((draft) => {
      draft.loadingMap[department] = true;
      draft.errorMap[department] = null;
    });

    try {
      const config = await fetchDepartmentMenuConfig(department);
      set((draft) => {
        draft.configs[department] = config;
        draft.loadingMap[department] = false;
        draft.errorMap[department] = null;
      });
      return config;
    } catch (error) {
      const message = error instanceof ApiError ? error.message : '获取菜单配置失败';
      set((draft) => {
        draft.loadingMap[department] = false;
        draft.errorMap[department] = message;
      });
      throw error;
    }
  },
  async updateConfig(department, payload) {
    set((draft) => {
      draft.loadingMap[department] = true;
      draft.errorMap[department] = null;
    });

    try {
      const config = await updateDepartmentMenuConfig(department, payload);
      set((draft) => {
        draft.configs[department] = config;
        draft.loadingMap[department] = false;
        draft.errorMap[department] = null;
      });
      return config;
    } catch (error) {
      const message = error instanceof ApiError ? error.message : '保存菜单配置失败';
      set((draft) => {
        draft.loadingMap[department] = false;
        draft.errorMap[department] = message;
      });
      throw error;
    }
  },
  clearConfig(department) {
    set((draft) => {
      if (department) {
        delete draft.configs[department];
        delete draft.loadingMap[department];
        delete draft.errorMap[department];
        return;
      }
      draft.configs = {};
      draft.loadingMap = {};
      draft.errorMap = {};
    });
  }
}));
