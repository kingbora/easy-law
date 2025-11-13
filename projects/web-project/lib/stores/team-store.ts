import dayjs from 'dayjs';

import { createAppStore } from './createStore';
import {
  fetchUsers,
  type UserResponse,
  
  type UserSupervisorInfo
} from '@/lib/users-api';
import { ApiError } from '@/lib/api-client';
import type { UserRole, UserDepartment } from '@easy-law/shared-types';

export interface TeamMember {
  id: string;
  name: string;
  role: UserRole;
  email: string;
  joinDate: string;
  image?: string | null;
  gender: 'male' | 'female' | null;
  initialPassword?: string;
  department: UserDepartment | null;
  supervisor: UserSupervisorInfo | null;
  supervisorId: string | null;
}

export type TeamFilters = {
  name?: string;
  role?: UserRole;
};

export interface TeamPaginationState {
  current: number;
  pageSize: number;
  defaultPageSize: number;
  pageSizeOptions: string[];
  showQuickJumper: boolean;
  showSizeChanger: boolean;
  align: 'end';
  total?: number;
}

export interface TeamState {
  members: TeamMember[];
  loading: boolean;
  initialized: boolean;
  error: string | null;
  lastFetchedAt: number | null;
  filters: TeamFilters;
  pagination: TeamPaginationState;
  loadMembers: (options?: { force?: boolean }) => Promise<TeamMember[]>;
  setMembers: (members: TeamMember[]) => void;
  upsertMember: (member: TeamMember) => void;
  removeMember: (memberId: string) => void;
  setFilters: (filters: TeamFilters) => void;
  resetFilters: () => void;
  setPagination: (patch: Partial<TeamPaginationState>) => void;
}

export const DEFAULT_TEAM_PAGINATION: TeamPaginationState = {
  current: 1,
  pageSize: 10,
  defaultPageSize: 10,
  pageSizeOptions: ['5', '10', '15', '20', '30'],
  showQuickJumper: true,
  showSizeChanger: true,
  align: 'end',
  total: 0,
};

export function mapUserToTeamMember(user: UserResponse, fallbackPassword?: string): TeamMember {
  const supervisor = user.supervisor ?? null;
  return {
    id: user.id,
    name: user.name ?? '',
    role: user.role,
    email: user.email,
    joinDate: user.createdAt ? dayjs(user.createdAt).format('YYYY-MM-DD') : '',
    image: user.image,
    gender: user.gender ?? null,
    initialPassword: user.initialPassword ?? fallbackPassword,
    department: user.department ?? null,
    supervisor,
    supervisorId: supervisor?.id ?? null
  };
}

export const useTeamStore = createAppStore<TeamState>((set, get) => ({
  members: [],
  loading: false,
  initialized: false,
  error: null,
  lastFetchedAt: null,
  filters: {},
  pagination: DEFAULT_TEAM_PAGINATION,
  async loadMembers(options) {
    const force = options?.force ?? false;
    const state = get();
    if (!force && (state.loading || state.initialized)) {
      return state.members;
    }

    set((draft) => {
      draft.loading = true;
      draft.error = null;
    });

    try {
      const list = await fetchUsers();
      const mapped = list.map((item) => mapUserToTeamMember(item));
      set((draft) => {
        draft.members = mapped;
        draft.loading = false;
        draft.initialized = true;
        draft.error = null;
        draft.lastFetchedAt = Date.now();
      });
      return mapped;
    } catch (error) {
      const message = error instanceof ApiError ? error.message : '获取成员列表失败，请稍后重试';
      set((draft) => {
        draft.loading = false;
        draft.error = message;
        draft.initialized = true;
      });
      throw error;
    }
  },
  setMembers(members) {
    set((draft) => {
      draft.members = members;
      draft.initialized = true;
      draft.error = null;
      draft.lastFetchedAt = Date.now();
    });
  },
  upsertMember(member) {
    set((draft) => {
  const index = draft.members.findIndex((item: TeamMember) => item.id === member.id);
      if (index >= 0) {
        draft.members[index] = {
          ...draft.members[index],
          ...member
        };
      } else {
        draft.members.unshift(member);
      }
      draft.lastFetchedAt = Date.now();
    });
  },
  removeMember(memberId) {
    set((draft) => {
  draft.members = draft.members.filter((member: TeamMember) => member.id !== memberId);
      draft.lastFetchedAt = Date.now();
    });
  },
  setFilters(filters) {
    set((draft) => {
      draft.filters = filters;
    });
  },
  resetFilters() {
    set((draft) => {
      draft.filters = {};
    });
  },
  setPagination(patch) {
    set((draft) => {
      draft.pagination = {
        ...draft.pagination,
        ...patch
      };
    });
  }
}));
