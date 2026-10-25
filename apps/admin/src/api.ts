import { createTranslator, normalizeLocale } from '@uiliuili/i18n';

const localeStorageKey = 'uiliuili.admin.locale';

function currentLocale() {
  if (typeof window === 'undefined') return normalizeLocale('zh-CN');
  return normalizeLocale(
    window.localStorage.getItem(localeStorageKey) ?? window.navigator.language,
  );
}

export interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, message: string, code = 'UNKNOWN', details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function readCookie(name: string): string | undefined {
  return document.cookie
    .split('; ')
    .find((item) => item.startsWith(`${name}=`))
    ?.split('=')
    .slice(1)
    .join('=');
}

export async function request<T>(
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
  if (response.status === 401 && !path.includes('/auth/refresh')) {
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
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    const body = data as ApiErrorBody;
    const t = createTranslator(currentLocale());
    throw new ApiError(
      response.status,
      body?.error?.message ? t(body.error.message) : t('请求失败（{0}）', { 0: response.status }),
      body?.error?.code ?? 'UNKNOWN',
      body?.error?.details,
    );
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body as BodyInit | undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body as BodyInit | undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body as BodyInit | undefined }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
