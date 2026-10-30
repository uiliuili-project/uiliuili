import { createTranslator, localeCookieName, normalizeLocale } from '@uiliuili/i18n';

const serverBase = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3001';

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

type CaptchaSolver = (action: string) => Promise<void>;
let captchaSolver: CaptchaSolver | null = null;

/** Registered by the global captcha gate so challenged requests can retry. */
export function setCaptchaSolver(solver: CaptchaSolver | null): void {
  captchaSolver = solver;
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
    const body = data as { error?: { message?: string; code?: string; details?: unknown } };
    const t = createTranslator(normalizeLocale(readCookie(localeCookieName)));
    throw new ApiError(
      response.status,
      body?.error?.message ? t(body.error.message) : t('请求失败（{0}）', { 0: response.status }),
      body?.error?.code,
      body?.error?.details,
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
  options: RequestInit & { body?: unknown; raw?: boolean } = {},
): Promise<T> {
  const { raw, ...init } = options;
  const headers = new Headers(init.headers);
  const method = (init.method ?? 'GET').toUpperCase();
  if (init.body !== undefined && !raw && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    const csrf = readCookie('ul_csrf');
    if (csrf) headers.set('x-csrf-token', csrf);
  }
  const body = (
    init.body === undefined || raw || init.body instanceof FormData
      ? init.body
      : JSON.stringify(init.body)
  ) as BodyInit | undefined;
  const send = () =>
    fetch(path, {
      ...init,
      method,
      headers,
      credentials: 'include',
      body,
    });
  let response = await send();
  if (response.status === 401 && !path.includes('/auth/refresh') && !path.includes('/auth/login')) {
    const refreshed = await fetch('/api/v1/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'x-csrf-token': readCookie('ul_csrf') ?? '' },
    });
    if (refreshed.ok) response = await send();
  }
  if (response.status === 429 && captchaSolver) {
    const snapshot = await response
      .clone()
      .json()
      .catch(() => null);
    if (snapshot?.error?.code === 'CAPTCHA_REQUIRED') {
      const action = String(snapshot.error?.details?.action ?? 'login');
      try {
        await captchaSolver(action);
        // The verifier grants a short server-side pass, so replaying the same
        // request succeeds without asking the caller to rebuild its payload.
        response = await send();
      } catch (error) {
        if (error instanceof Error) throw error;
      }
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

/** Uploads a cropped personal-space cover as raw image bytes. */
export function uploadCover(image: Blob) {
  return clientFetch<{ user: import('@uiliuili/shared').AuthUser }>('/api/v1/auth/cover', {
    method: 'PUT',
    body: image,
    raw: true,
    headers: { 'content-type': image.type || 'image/webp' },
  });
}

export function removeCover() {
  return clientFetch<{ user: import('@uiliuili/shared').AuthUser }>('/api/v1/auth/cover', {
    method: 'DELETE',
  });
}

/** Uploads a composer image and returns the stored public URL. */
export function uploadImage(image: Blob) {
  return clientFetch<{ url: string; contentType: string; bytes: number }>(
    '/api/v1/uploads/images',
    {
      method: 'POST',
      body: image,
      raw: true,
      headers: { 'content-type': image.type || 'application/octet-stream' },
    },
  );
}
