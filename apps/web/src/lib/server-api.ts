import { createTranslator } from '@uiliuili/i18n';
import { cookies, headers } from 'next/headers';
import { ApiError } from './api';
import { getLocale } from './i18n-server';

const serverBase = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:3001';
const FORWARDED_REGION_HEADERS = [
  'cf-ipcountry',
  'x-country-code',
  'x-vercel-ip-country',
  'x-geo-country',
  'x-real-ip',
  'x-forwarded-for',
];

export async function serverFetch<T>(path: string): Promise<T> {
  const [store, incoming] = await Promise.all([cookies(), headers()]);
  const forwarded: Record<string, string> = {};
  for (const name of FORWARDED_REGION_HEADERS) {
    const value = incoming.get(name);
    if (value) forwarded[name] = value;
  }
  const response = await fetch(`${serverBase}${path}`, {
    headers: {
      cookie: store.toString(),
      'user-agent': 'uiliuili-web',
      ...forwarded,
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
    const t = createTranslator(await getLocale());
    throw new ApiError(
      response.status,
      body?.error?.message ? t(body.error.message) : t('请求失败（{0}）', { 0: response.status }),
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
