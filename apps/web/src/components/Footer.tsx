'use client';

import { api } from '@/lib/api';
import { createTranslator } from '@uiliuili/i18n';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const t = createTranslator('zh-CN');

type FooterSettings = { site: { name: string; footer?: string; icp?: string } };

export function Footer() {
  const [settings, setSettings] = useState<FooterSettings>({ site: { name: 'uiliuili' } });

  useEffect(() => {
    void api
      .get<FooterSettings>('/api/v1/settings')
      .then(setSettings)
      .catch(() => undefined);
  }, []);
  return (
    <footer className="mt-16 border-t border-line bg-white py-10">
      <div className="container-page flex flex-col gap-4 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">
            u
          </span>
          <span>{settings.site.name || 'uiliuili'} · 开源弹幕视频社区</span>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/about" className="hover:text-brand">
            {t('common.about')}
          </Link>
          <Link href="/settings" className="hover:text-brand">
            {t('nav.settings')}
          </Link>
          <a href="/admin/" className="hover:text-brand">
            {t('nav.admin')}
          </a>
          {settings.site.icp && <span>{settings.site.icp}</span>}
          <span>{settings.site.footer || 'MIT License'}</span>
        </div>
      </div>
    </footer>
  );
}
