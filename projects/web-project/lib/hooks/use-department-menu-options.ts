import { useCallback, useEffect, useMemo } from 'react';
import type { DepartmentMenuConfig, TrialStage, UserDepartment } from '@easy-law/shared-types';
import { DEFAULT_MENU_DATA_SOURCES, DEFAULT_TRIAL_STAGE_ORDER } from '@easy-law/shared-types';

import { useMenuConfigStore } from '@/lib/stores/menu-config-store';

interface UseDepartmentMenuOptionsExtras {
  dataSources?: Array<string | null | undefined> | null;
  trialStages?: Array<TrialStage | null | undefined> | null;
}

interface UseDepartmentMenuOptionsParams {
  department: UserDepartment | null | undefined;
  autoFetch?: boolean;
  extras?: UseDepartmentMenuOptionsExtras;
}

interface UseDepartmentMenuOptionsResult {
  config?: DepartmentMenuConfig;
  loading: boolean;
  error: string | null;
  dataSources: string[];
  trialStages: TrialStage[];
  refresh: (options?: { force?: boolean }) => Promise<DepartmentMenuConfig | undefined>;
}

export function useDepartmentMenuOptions({
  department,
  autoFetch = true,
  extras
}: UseDepartmentMenuOptionsParams): UseDepartmentMenuOptionsResult {
  const config = useMenuConfigStore(state => (department ? state.configs[department] : undefined));
  const loading = useMenuConfigStore(state => (department ? state.loadingMap[department] ?? false : false));
  const error = useMenuConfigStore(state => (department ? state.errorMap[department] ?? null : null));
  const fetchConfig = useMenuConfigStore(state => state.fetchConfig);

  useEffect(() => {
    if (!department || !autoFetch) {
      return;
    }
    void fetchConfig(department).catch(() => undefined);
  }, [autoFetch, department, fetchConfig]);

  const refresh = useCallback(
    (options?: { force?: boolean }) => {
      if (!department) {
        return Promise.resolve(undefined);
      }
      return fetchConfig(department, options);
    },
    [department, fetchConfig]
  );

  const resolvedDataSources = useMemo(() => {
    const unique = new Set<string>();
    const appendList = (items?: Array<string | null | undefined> | null) => {
      (items ?? []).forEach(item => {
        const value = `${item ?? ''}`.trim();
        if (!value || unique.has(value)) {
          return;
        }
        unique.add(value);
      });
    };
    appendList(config?.dataSources);
    appendList(extras?.dataSources ?? null);
  appendList([...DEFAULT_MENU_DATA_SOURCES]);
    return Array.from(unique.values());
  }, [config?.dataSources, extras?.dataSources]);

  const resolvedTrialStages = useMemo(() => {
    const unique = new Set<TrialStage>();
    const appendList = (items?: Array<TrialStage | null | undefined> | null) => {
      (items ?? []).forEach(item => {
        if (!item || unique.has(item)) {
          return;
        }
        unique.add(item);
      });
    };
    appendList(config?.trialStages);
    appendList(extras?.trialStages ?? null);
  appendList([...DEFAULT_TRIAL_STAGE_ORDER]);
    return unique.size ? Array.from(unique.values()) : [...DEFAULT_TRIAL_STAGE_ORDER];
  }, [config?.trialStages, extras?.trialStages]);

  return {
    config,
    loading,
    error,
    dataSources: resolvedDataSources,
    trialStages: resolvedTrialStages,
    refresh
  };
}
