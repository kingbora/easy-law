export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

const RAW_API_BASE_URL = process.env.NEXT_PUBLIC_WEBSITE_URL;

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, '');
}

export function getApiBaseUrl(): string {
  if (!RAW_API_BASE_URL) {
    throw new Error('未配置 NEXT_PUBLIC_WEBSITE_URL 环境变量');
  }
  return normalizeBaseUrl(RAW_API_BASE_URL);
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  skipJson?: boolean;
}

export async function apiFetch<TResponse>(path: string, options: RequestOptions = {}): Promise<TResponse> {
  const { skipJson, headers, body, credentials, method, ...rest } = options;

  const payload = typeof body === 'string' || body === undefined ? body : JSON.stringify(body);

  const mergedHeaders: HeadersInit = {
    ...(payload ? { 'Content-Type': 'application/json' } : {}),
    ...(headers ?? {})
  };

  const baseUrl = getApiBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  const response = await fetch(`${baseUrl}${normalizedPath}`, {
    method: method ?? 'GET',
    credentials: credentials ?? 'include',
    ...rest,
    headers: mergedHeaders,
    body: payload as BodyInit | undefined
  });

  if (!response.ok) {
    let errorPayload: unknown;
    try {
      errorPayload = await response.json();
    } catch (error) {
      // ignore json parse errors
    }

    const message =
      (typeof errorPayload === 'object' && errorPayload && 'message' in errorPayload && typeof errorPayload.message === 'string')
        ? errorPayload.message
        : `请求失败（${response.status}）`;

    throw new ApiError(message, response.status, errorPayload);
  }

  if (response.status === 204 || skipJson) {
    return undefined as TResponse;
  }

  return (await response.json()) as TResponse;
}
