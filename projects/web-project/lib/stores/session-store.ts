import { createContext, useContext } from 'react';

import { createAppStore } from './createStore';
import { fetchCurrentUser, type CurrentUserResponse } from '@/lib/users-api';
import { ApiError } from '@/lib/api-client';

export interface SessionState {
  user: CurrentUserResponse | null;
  loading: boolean;
  initialized: boolean;
  error: string | null;
  lastFetchedAt: number | null;
  refresh: (options?: { force?: boolean }) => Promise<CurrentUserResponse | null>;
  setUser: (user: CurrentUserResponse | null) => void;
  updateUser: (patch: Partial<CurrentUserResponse>) => void;
  clear: () => void;
}

export const useSessionStore = createAppStore<SessionState>((set, get) => ({
  user: null,
  loading: false,
  initialized: false,
  error: null,
  lastFetchedAt: null,
  async refresh(options) {
    const force = options?.force ?? false;
    const state = get();
    if (!force && (state.loading || state.initialized)) {
      return state.user;
    }

    set((draft) => {
      draft.loading = true;
      draft.error = null;
    });

    try {
      const user = await fetchCurrentUser();
      set((draft) => {
        draft.user = user;
        draft.loading = false;
        draft.initialized = true;
        draft.error = null;
        draft.lastFetchedAt = Date.now();
      });
      return user;
    } catch (error) {
      const message = error instanceof ApiError ? error.message : '获取当前用户信息失败';
      set((draft) => {
        draft.user = null;
        draft.loading = false;
        draft.initialized = true;
        draft.error = message;
      });
      return null;
    }
  },
  setUser(user) {
    set((draft) => {
      draft.user = user;
      draft.initialized = true;
      draft.error = null;
      draft.lastFetchedAt = user ? Date.now() : draft.lastFetchedAt;
    });
  },
  updateUser(patch) {
    set((draft) => {
      if (!draft.user) {
        return;
      }
      draft.user = {
        ...draft.user,
        ...patch
      };
      draft.lastFetchedAt = Date.now();
    });
  },
  clear() {
    set((draft) => {
      draft.user = null;
      draft.loading = false;
      draft.error = null;
      draft.initialized = false;
      draft.lastFetchedAt = null;
    });
  }
}));

export const SessionInitialUserContext = createContext<CurrentUserResponse | null>(null);

export function useCurrentUser(): CurrentUserResponse | null {
  const storeUser = useSessionStore((state) => state.user);
  const initialUser = useContext(SessionInitialUserContext);
  return storeUser ?? initialUser ?? null;
}
