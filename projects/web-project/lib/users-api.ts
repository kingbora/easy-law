import { ApiError } from './api-client';
import { authClient } from './auth-client';

export type UserRole = 'super_admin' | 'admin' | 'administration' | 'lawyer' | 'assistant' | 'sale';
export type UserDepartment = 'work_injury' | 'insurance';

export interface UserSupervisorInfo {
  id: string;
  name: string | null;
}

export interface UserResponse {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  image: string | null;
  gender: 'male' | 'female' | null;
  department: UserDepartment | null;
  supervisor: UserSupervisorInfo | null;
  createdAt: string | null;
  updatedAt: string | null;
  initialPassword?: string;
}

export interface CreateUserPayload {
  name: string;
  email: string;
  role: UserRole;
  gender?: 'male' | 'female' | null;
  department?: UserDepartment | null;
  supervisorId?: string | null;
  password?: string;
  creatorId?: string | null;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  role?: UserRole;
  image?: string | null;
  gender?: 'male' | 'female' | null;
  department?: UserDepartment | null;
  supervisorId?: string | null;
  updaterId?: string | null;
}

export interface CurrentUserResponse extends UserResponse {
  permissions: string[];
}

const DEFAULT_INITIAL_PASSWORD = 'a@000123';

const USER_ROLES: readonly UserRole[] = ['super_admin', 'admin', 'administration', 'lawyer', 'assistant', 'sale'];
const USER_DEPARTMENTS: readonly UserDepartment[] = ['work_injury', 'insurance'];
const USER_GENDERS = ['male', 'female'] as const;

type BetterAuthResponse<TData> = {
  data: TData | null;
  error: {
    status: number;
    statusText?: string;
    message?: string;
  } | null;
};

function ensureAuthSuccess<TData>(result: BetterAuthResponse<TData>, fallbackMessage: string): TData {
  if (result.error) {
    const { status, message, statusText } = result.error;
    throw new ApiError(message ?? statusText ?? fallbackMessage, status ?? 500, result.error);
  }

  if (result.data === null || result.data === undefined) {
    throw new ApiError(fallbackMessage, 500);
  }

  return result.data;
}

function castRole(value: unknown): UserRole {
  if (typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value)) {
    return value as UserRole;
  }
  return 'assistant';
}

function castGender(value: unknown): UserResponse['gender'] {
  if (typeof value === 'string' && (USER_GENDERS as readonly string[]).includes(value)) {
    return value as UserResponse['gender'];
  }
  return null;
}

function castDepartment(value: unknown): UserResponse['department'] {
  if (typeof value === 'string' && (USER_DEPARTMENTS as readonly string[]).includes(value as UserDepartment)) {
    return value as UserDepartment;
  }
  return null;
}

function normalizeDate(value: unknown): string | null {
  if (!value) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  return null;
}

function normalizeSupervisor(value: unknown): UserSupervisorInfo | null {
  if (!value) {
    return null;
  }

  if (typeof value === 'string') {
    return { id: value, name: null };
  }

  if (typeof value === 'object' && value !== null) {
    const id = 'id' in value && typeof (value as { id?: unknown }).id === 'string' ? (value as { id: string }).id : null;
    if (!id) {
      return null;
    }
    const name = 'name' in value && typeof (value as { name?: unknown }).name === 'string' ? (value as { name: string }).name : null;
    return { id, name };
  }

  return null;
}

function mapUserPayload(raw: unknown): UserResponse | null {
  if (typeof raw !== 'object' || raw === null) {
    return null;
  }

  const container = raw as Record<string, unknown>;
  const base = (container.user as Record<string, unknown> | undefined) ?? container;

  if (typeof base !== 'object' || base === null) {
    return null;
  }

  const baseData =
    'data' in base && typeof (base as { data?: unknown }).data === 'object' && (base as { data?: unknown }).data !== null
      ? ((base as { data: Record<string, unknown> }).data)
      : undefined;
  const containerData =
    'data' in container && typeof (container as { data?: unknown }).data === 'object' && (container as { data?: unknown }).data !== null
      ? ((container as { data: Record<string, unknown> }).data)
      : undefined;
  const mergedData = {
    ...(containerData ?? {}),
    ...(baseData ?? {})
  } as Record<string, unknown>;

  const id = typeof base.id === 'string' ? base.id : null;
  const email = typeof base.email === 'string' ? base.email : null;

  if (!id || !email) {
    return null;
  }

  const supervisor = normalizeSupervisor(
    container.supervisor ??
      base.supervisor ??
      base.supervisorInfo ??
      base.supervisorId ??
      container.supervisorId ??
      mergedData.supervisor ??
      mergedData.supervisorInfo ??
      mergedData.supervisorId
  );

  const createdAt = normalizeDate(base.createdAt ?? container.createdAt);
  const updatedAt = normalizeDate(base.updatedAt ?? container.updatedAt);

  return {
    id,
    name: typeof base.name === 'string' ? base.name : null,
    email,
    role: castRole(base.role ?? container.role),
    image: typeof base.image === 'string' ? base.image : null,
    gender: castGender(base.gender ?? container.gender ?? mergedData.gender),
    department: castDepartment(base.department ?? container.department ?? mergedData.department),
    supervisor,
    createdAt,
    updatedAt,
    initialPassword:
      typeof container.initialPassword === 'string'
        ? container.initialPassword
        : typeof base.initialPassword === 'string'
          ? base.initialPassword
          : undefined
  };
}

function mapListPayload(data: unknown): UserResponse[] {
  if (Array.isArray(data)) {
    return data.map((item) => mapUserPayload(item)).filter(Boolean) as UserResponse[];
  }

  if (typeof data === 'object' && data !== null) {
    const value = data as Record<string, unknown>;
    if (Array.isArray(value.users)) {
      return value.users.map((item) => mapUserPayload(item)).filter(Boolean) as UserResponse[];
    }
    if (Array.isArray(value.accounts)) {
      return value.accounts.map((item) => mapUserPayload(item)).filter(Boolean) as UserResponse[];
    }
  }

  return [];
}

function mapSingularPayload(data: unknown, errorMessage: string): UserResponse {
  const mapped = mapUserPayload(data);
  if (!mapped) {
    throw new ApiError(errorMessage, 500, data);
  }
  return mapped;
}

export async function fetchUsers(): Promise<UserResponse[]> {
  const result = (await authClient.admin.listUsers({
    query: {}
  } as Parameters<typeof authClient.admin.listUsers>[0])) as BetterAuthResponse<unknown>;
  const data = ensureAuthSuccess(result, '获取用户列表失败');
  return mapListPayload(data);
}

export async function createUser(payload: CreateUserPayload): Promise<UserResponse> {
  const password = payload.password ?? DEFAULT_INITIAL_PASSWORD;

  const extraData: Record<string, unknown> = {};

  if (payload.gender !== undefined) {
    extraData.gender = payload.gender;
  }
  if (payload.department !== undefined) {
    extraData.department = payload.department;
  }
  if (payload.supervisorId !== undefined) {
    extraData.supervisorId = payload.supervisorId;
  }
  if (payload.creatorId !== undefined) {
    extraData.creatorId = payload.creatorId;
  }

  const result = (await authClient.admin.createUser({
    email: payload.email,
    password,
    name: payload.name,
    role: payload.role,
    ...(Object.keys(extraData).length > 0 ? { data: extraData } : {})
  } as Parameters<typeof authClient.admin.createUser>[0])) as BetterAuthResponse<unknown>;

  const data = ensureAuthSuccess(result, '创建成员失败');
  const mapped = mapSingularPayload(data, '创建成员失败：返回数据无效');

  if (!mapped.initialPassword) {
    mapped.initialPassword = password;
  }

  return mapped;
}

export async function updateUser(id: string, payload: UpdateUserPayload): Promise<UserResponse> {
  const updateData: Record<string, unknown> = {};

  if (payload.name !== undefined) {
    updateData.name = payload.name;
  }
  if (payload.email !== undefined) {
    updateData.email = payload.email;
  }
  if (payload.role !== undefined) {
    updateData.role = payload.role;
  }
  if (payload.image !== undefined) {
    updateData.image = payload.image;
  }
  if (payload.gender !== undefined) {
    updateData.gender = payload.gender;
  }
  if (payload.department !== undefined) {
    updateData.department = payload.department;
  }
  if (payload.supervisorId !== undefined) {
    updateData.supervisorId = payload.supervisorId;
  }
  if (payload.updaterId !== undefined) {
    updateData.updaterId = payload.updaterId;
  }

  const result = (await authClient.admin.updateUser({
    userId: id,
    data: updateData
  } as Parameters<typeof authClient.admin.updateUser>[0])) as BetterAuthResponse<unknown>;

  const responseData = ensureAuthSuccess(result, '更新成员信息失败');
  return mapSingularPayload(responseData, '更新成员信息失败：返回数据无效');
}

export async function deleteUser(id: string): Promise<void> {
  const result = (await authClient.admin.removeUser({
    userId: id
  } as Parameters<typeof authClient.admin.removeUser>[0])) as BetterAuthResponse<unknown>;
  ensureAuthSuccess(result, '删除成员失败');
}

export async function fetchCurrentUser(): Promise<CurrentUserResponse> {
  const sessionResult = (await authClient.getSession()) as BetterAuthResponse<
    | {
        user: unknown;
        session: Record<string, unknown> | null;
      }
    | null
  >;
  const sessionData = ensureAuthSuccess(sessionResult, '获取当前用户信息失败');

  if (!sessionData || !sessionData.user) {
    throw new ApiError('当前未登录或会话已过期', 401);
  }

  const accountId = typeof sessionData.session?.accountId === 'string' ? sessionData.session.accountId : null;

  let accountPayload: unknown = { user: sessionData.user, permissions: [] };

  if (accountId) {
    try {
      const accountResult = (await authClient.accountInfo({ accountId } as Parameters<typeof authClient.accountInfo>[0])) as BetterAuthResponse<unknown>;
      accountPayload = ensureAuthSuccess(accountResult, '获取当前用户信息失败');
    } catch (error) {
      if (error instanceof ApiError) {
        accountPayload = { user: sessionData.user, permissions: [] };
      } else {
        throw error;
      }
    }
  }

  const user = mapSingularPayload((accountPayload as Record<string, unknown>).user ?? accountPayload, '获取当前用户信息失败：返回数据无效');
  const permissions = Array.isArray((accountPayload as Record<string, unknown>).permissions)
    ? ((accountPayload as Record<string, unknown>).permissions as unknown[]).map((item) => String(item))
    : [];

  return {
    ...user,
    permissions
  };
}
