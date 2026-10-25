'use client';

import type { Locale } from '@uiliuili/i18n';
import { Languages } from 'lucide-react';
import { useI18n } from './I18nProvider';

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n();
  return (
    <label className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1.5 text-xs text-muted">
      <Languages className="h-3.5 w-3.5" />
      <span className={compact ? 'sr-only' : 'hidden sm:inline'}>{t('common.language')}</span>
      <select
        aria-label={t('common.language')}
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
        className="bg-transparent text-xs font-medium text-ink outline-none"
      >
        <option value="zh-CN">简体中文</option>
        <option value="en-US">English</option>
      </select>
    </label>
  );
}
