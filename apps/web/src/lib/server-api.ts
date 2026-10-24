import { cookies } from 'next/headers';
import { ApiError } from './api';

const serverBase = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3001';

export async function serverFetch<T>(path: string): Promise<T> {
  const store = await cookies();
  const response = await fetch(`${serverBase}${path}`, {
    headers: {
      cookie: store.toString(),
      'user-agent': 'uiliuili-web',
    },
    cache: 'no-store',
  });
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

export async function serverFetchSafe<T>(path: string, fallback: T): Promise<T> {
  try {
    return await serverFetch<T>(path);
  } catch {
    return fallback;
  }
}
