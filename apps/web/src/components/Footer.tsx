'use client';

import { api, getMe } from '@/lib/api';
import { type AuthUser, type NavigationItem, consoleAreaForGroup } from '@uiliuili/shared';
import {
  BookOpen,
  Download,
  ExternalLink,
  Gamepad2,
  Heart,
  Home,
  Info,
  Link2,
  Music,
  Star,
  Users,
  Video,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminConsoleLink } from './AdminConsoleLink';
import { useT } from './I18nProvider';
import { LanguageSwitcher } from './LanguageSwitcher';

type FooterSettings = {
  site: { name: string; logoUrl?: string; footer?: string; icp?: string };
  navigation?: { footer?: NavigationItem[] };
};

const FOOTER_ICONS = {
  link: Link2,
  home: Home,
  video: Video,
  star: Star,
  heart: Heart,
  book: BookOpen,
  users: Users,
  info: Info,
  music: Music,
  game: Gamepad2,
  download: Download,
  external: ExternalLink,
} as const;

export function Footer() {
  const t = useT();
  const [settings, setSettings] = useState<FooterSettings>({ site: { name: '萌悠' } });
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    void api
      .get<FooterSettings>('/api/v1/settings')
      .then(setSettings)
      .catch(() => undefined);
    void getMe()
      .then(setUser)
      .catch(() => undefined);
  }, []);

  const isStaff = consoleAreaForGroup(user?.group) !== null;
  const customLinks = (settings.navigation?.footer ?? [])
    .filter((item) => item.enabled)
    .filter((item) => {
      if (item.visibility === 'guest') return !user;
      if (item.visibility === 'user') return Boolean(user);
      if (item.visibility === 'staff') return isStaff;
      return true;
    })
    .sort((left, right) => left.sort - right.sort);

  return (
    <footer className="mt-16 border-t border-line bg-white py-10">
      <div className="container-page flex flex-col gap-4 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          {settings.site.logoUrl ? (
            <img
              src={settings.site.logoUrl}
              alt={settings.site.name}
              className="h-7 w-7 rounded-lg object-cover"
            />
          ) : (
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-sm font-bold text-white">
              萌
            </span>
          )}
          <span>
            {settings.site.name || '萌悠'} · {t('common.footerTagline')}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          {customLinks.map((item) => {
            const Icon = FOOTER_ICONS[item.icon] ?? Link2;
            const external = /^https?:\/\//i.test(item.href);
            const className = 'inline-flex items-center gap-1 hover:text-brand';
            return external ? (
              <a
                key={item.id || item.href}
                href={item.href}
                target={item.newTab ? '_blank' : undefined}
                rel="noopener noreferrer"
                className={className}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </a>
            ) : (
              <Link
                key={item.id || item.href}
                href={item.href}
                target={item.newTab ? '_blank' : undefined}
                className={className}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
          <Link href="/terms" className="hover:text-brand">
            {t('用户协议')}
          </Link>
          <Link href="/privacy" className="hover:text-brand">
            {t('隐私政策')}
          </Link>
          <Link href="/about" className="hover:text-brand">
            {t('common.about')}
          </Link>
          <Link href="/settings" className="hover:text-brand">
            {t('nav.settings')}
          </Link>
          <AdminConsoleLink className="hover:text-brand" />
          <LanguageSwitcher compact />
          {settings.site.icp && <span>{settings.site.icp}</span>}
          <span>{settings.site.footer || 'MIT License'}</span>
        </div>
      </div>
    </footer>
  );
}
