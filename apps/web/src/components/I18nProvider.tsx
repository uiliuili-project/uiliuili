'use client';

import {
  type Locale,
  createTranslator,
  isLocale,
  localeCookieName,
  normalizeLocale,
} from '@uiliuili/i18n';
import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: ReturnType<typeof createTranslator>;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const t = useMemo(() => createTranslator(locale), [locale]);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = (next: Locale) => {
    if (!isLocale(next)) return;
    setLocaleState(next);
    document.documentElement.lang = next;
    document.cookie = `${localeCookieName}=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  };

  return <I18nContext.Provider value={{ locale, setLocale, t }}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used inside I18nProvider');
  return value;
}

export function useT() {
  return useI18n().t;
}

export function useLocale(): Locale {
  const { locale } = useI18n();
  return normalizeLocale(locale);
}
