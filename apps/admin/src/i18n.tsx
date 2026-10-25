'use client';

import { type Locale, createTranslator, isLocale, normalizeLocale } from '@uiliuili/i18n';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'uiliuili.admin.locale';

interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: ReturnType<typeof createTranslator>;
}

const I18nContext = createContext<I18nValue | null>(null);

function initialLocale(): Locale {
  if (typeof window === 'undefined') return 'zh-CN';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (isLocale(stored)) return stored;
  return normalizeLocale(window.navigator.language);
}

export function AdminI18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const t = useMemo(() => createTranslator(locale), [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = (next: Locale) => {
    if (!isLocale(next)) return;
    window.localStorage.setItem(STORAGE_KEY, next);
    setLocaleState(next);
    document.documentElement.lang = next;
  };

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside AdminI18nProvider');
  return value;
}

export function useT() {
  return useI18n().t;
}

export function AdminLanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        color: '#666',
      }}
    >
      <span>{t('common.language')}</span>
      <select
        aria-label={t('common.language')}
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
        style={{ border: '1px solid #d9d9d9', borderRadius: 6, padding: '2px 6px' }}
      >
        <option value="zh-CN">简体中文</option>
        <option value="en-US">English</option>
      </select>
    </label>
  );
}
