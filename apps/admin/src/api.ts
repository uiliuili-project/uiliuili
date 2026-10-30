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

let captchaSolver: ((action: string) => Promise<void>) | null = null;

/** Registered by the admin captcha gate so challenged requests can retry. */
export function setCaptchaSolver(solver: ((action: string) => Promise<void>) | null) {
  captchaSolver = solver;
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
  options: RequestInit & { body?: unknown; raw?: boolean } = {},
): Promise<T> {
  const { raw, ...init } = options;
  const headers = new Headers(init.headers);
  const method = (init.method ?? 'GET').toUpperCase();
  const multipart = init.body instanceof FormData;
  if (init.body !== undefined && !multipart && !raw) {
    headers.set('Content-Type', 'application/json');
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = readCookie('ul_csrf');
    if (csrf) headers.set('x-csrf-token', csrf);
  }
  const body = (
    init.body === undefined || multipart || raw ? init.body : JSON.stringify(init.body)
  ) as BodyInit | undefined;
  let response = await fetch(path, {
    ...init,
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
        ...init,
        method,
        headers,
        credentials: 'include',
        body,
      });
    }
  }
  if (response.status === 429 && captchaSolver) {
    const snapshot = await response
      .clone()
      .json()
      .catch(() => null);
    if (snapshot?.error?.code === 'CAPTCHA_REQUIRED') {
      const action = String(snapshot.error?.details?.action ?? 'login');
      await captchaSolver(action);
      // The verifier grants a short server-side pass, so replaying the same
      // request succeeds without rebuilding its payload.
      response = await fetch(path, {
        ...init,
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
  upload: <T>(path: string, body: Blob, contentType?: string) =>
    request<T>(path, {
      method: 'POST',
      body,
      raw: true,
      headers: contentType ? { 'Content-Type': contentType } : undefined,
    }),
};
