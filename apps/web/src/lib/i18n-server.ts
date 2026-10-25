import { createTranslator, localeCookieName, normalizeLocale } from '@uiliuili/i18n';
import { cookies, headers } from 'next/headers';

export async function getLocale() {
  const cookieStore = await cookies();
  const fromCookie = cookieStore.get(localeCookieName)?.value;
  if (fromCookie) return normalizeLocale(fromCookie);
  const language = (await headers()).get('accept-language');
  const preferred = language?.split(',')[0]?.split(';')[0];
  return normalizeLocale(preferred);
}

export async function getT() {
  return createTranslator(await getLocale());
}
