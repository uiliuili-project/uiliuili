import { enUS } from './locales/en-US';
import { type MessageTree, zhCN } from './locales/zh-CN';

export type Locale = 'zh-CN' | 'en-US';
export type { MessageTree };

export const messages: Record<Locale, MessageTree> = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

export const locales: Locale[] = ['zh-CN', 'en-US'];
export const defaultLocale: Locale = 'zh-CN';

function lookup(tree: MessageTree, key: string): string | undefined {
  let current: string | MessageTree | undefined = tree;
  for (const part of key.split('.')) {
    if (!current || typeof current === 'string') return undefined;
    current = current[part];
  }
  return typeof current === 'string' ? current : undefined;
}

export function translate(
  locale: Locale,
  key: string,
  variables: Record<string, string | number> = {},
): string {
  const value = lookup(messages[locale], key) ?? lookup(messages[defaultLocale], key) ?? key;
  return value.replace(/\{(\w+)\}/g, (_, name: string) =>
    variables[name] === undefined ? `{${name}}` : String(variables[name]),
  );
}

export function createTranslator(locale: Locale) {
  return (key: string, variables?: Record<string, string | number>) =>
    translate(locale, key, variables);
}

export { enUS, zhCN };
