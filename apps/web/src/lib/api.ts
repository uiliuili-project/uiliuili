const serverBase = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3001';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, message: string, code = 'UNKNOWN') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    const body = data as { error?: { message?: string; code?: string } };
    throw new ApiError(
      response.status,
      body?.error?.message ?? `请求失败（${response.status}）`,
      body?.error?.code,
    );
  }
  return data as T;
}

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.cookie
    .split('; ')
    .find((item) => item.startsWith(`${name}=`))
    ?.split('=')
    .slice(1)
    .join('=');
}

export async function clientFetch<T>(
  path: string,
  options: RequestInit & { body?: unknown } = {},
): Promise<T> {
  const headers = new Headers(options.headers);
  const method = (options.method ?? 'GET').toUpperCase();
  if (options.body !== undefined && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = readCookie('ul_csrf');
    if (csrf) headers.set('x-csrf-token', csrf);
  }
  const body = (
    options.body === undefined || options.body instanceof FormData
      ? options.body
      : JSON.stringify(options.body)
  ) as BodyInit | undefined;
  let response = await fetch(path, {
    ...options,
    method,
    headers,
    credentials: 'include',
    body,
  });
  if (response.status === 401 && !path.includes('/auth/refresh') && !path.includes('/auth/login')) {
    const refreshed = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'x-csrf-token': readCookie('ul_csrf') ?? '' },
    });
    if (refreshed.ok) {
      response = await fetch(path, {
        ...options,
        method,
        headers,
        credentials: 'include',
        body,
      });
    }
  }
  return parseResponse<T>(response);
}

export const api = {
  get: <T>(path: string) => clientFetch<T>(path),
  post: <T>(path: string, body?: unknown) =>
    clientFetch<T>(path, { method: 'POST', body: body as BodyInit | undefined }),
  patch: <T>(path: string, body?: unknown) =>
    clientFetch<T>(path, { method: 'PATCH', body: body as BodyInit | undefined }),
  put: <T>(path: string, body?: unknown) =>
    clientFetch<T>(path, { method: 'PUT', body: body as BodyInit | undefined }),
  delete: <T>(path: string) => clientFetch<T>(path, { method: 'DELETE' }),
};

export function csrfHeader(): Record<string, string> {
  const token = readCookie('ul_csrf');
  return token ? { 'x-csrf-token': token } : {};
}

export async function ensureCsrf(): Promise<void> {
  await api.get<{ token: string }>('/api/v1/auth/csrf').catch(() => undefined);
}

export async function getMe() {
  try {
    return (await api.get<{ user: import('@uiliuili/shared').AuthUser }>('/api/v1/auth/me')).user;
  } catch {
    return null;
  }
}
