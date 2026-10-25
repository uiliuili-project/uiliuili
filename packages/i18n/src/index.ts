import { enUS } from './locales/en-US';
import { uiEn } from './locales/ui-en';
import { type MessageTree, zhCN } from './locales/zh-CN';

export type Locale = 'zh-CN' | 'en-US';
export type { MessageTree };

export const messages: Record<Locale, MessageTree> = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

export const locales: Locale[] = ['zh-CN', 'en-US'];
export const defaultLocale: Locale = 'zh-CN';
export const localeCookieName = 'ul_locale';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (locales as string[]).includes(value);
}

export function normalizeLocale(value: string | null | undefined): Locale {
  if (!value) return defaultLocale;
  const lower = value.toLowerCase();
  if (lower === 'zh' || lower.startsWith('zh-')) return 'zh-CN';
  if (lower === 'en' || lower.startsWith('en-')) return 'en-US';
  return defaultLocale;
}

function lookup(tree: MessageTree, key: string): string | undefined {
  let current: string | MessageTree | undefined = tree;
  for (const part of key.split('.')) {
    if (!current || typeof current === 'string') return undefined;
    current = current[part];
  }
  return typeof current === 'string' ? current : undefined;
}

function interpolate(value: string, variables: Record<string, unknown>): string {
  return value.replace(/\{(\w+)\}/g, (_, name: string) => {
    const variable = variables[name];
    return variable === undefined ? `{${name}}` : variable === null ? '' : String(variable);
  });
}

export function translate(
  locale: Locale,
  key: string,
  variables: Record<string, unknown> = {},
): string {
  const localized = lookup(messages[locale], key) ?? (locale === 'en-US' ? uiEn[key] : undefined);
  const value = localized ?? lookup(messages[defaultLocale], key) ?? key;
  return interpolate(value, variables);
}

export function createTranslator(locale: Locale) {
  return (key: string, variables?: Record<string, unknown>) => translate(locale, key, variables);
}

export function formatNumber(locale: Locale, value: number): string {
  return new Intl.NumberFormat(locale === 'zh-CN' ? 'zh-CN' : 'en-US').format(value);
}

export { enUS, uiEn, zhCN };
