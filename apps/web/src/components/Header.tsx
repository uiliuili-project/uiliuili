'use client';

import { api, getMe } from '@/lib/api';
import { cn } from '@/lib/cn';
import { createTranslator } from '@uiliuili/i18n';
import type { AuthUser } from '@uiliuili/shared';
import { Bell, Home, LogOut, Plus, Search, Settings, User, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const t = createTranslator('zh-CN');

const navItems = [
  { href: '/', label: t('nav.home'), icon: Home },
  { href: '/trending', label: t('nav.trending'), icon: Users },
  { href: '/following', label: t('nav.following'), icon: Users },
  { href: '/history', label: t('nav.history'), icon: User },
];

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [unread, setUnread] = useState(0);
  const [query, setQuery] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [siteName, setSiteName] = useState('uiliuili');

  useEffect(() => {
    void api
      .get<{ site: { name: string } }>('/api/v1/settings')
      .then((settings) => setSiteName(settings.site.name || 'uiliuili'))
      .catch(() => undefined);
    void getMe().then((current) => {
      setUser(current);
      if (current) {
        void api
          .get<{ count: number }>('/api/v1/notifications/unread-count')
          .then((data) => setUnread(data.count))
          .catch(() => undefined);
      }
    });
  }, [pathname]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    if (value) router.push(`/search?q=${encodeURIComponent(value)}`);
  };

  const logout = async () => {
    await api.post('/api/v1/auth/logout').catch(() => undefined);
    setUser(null);
    setMenuOpen(false);
    router.refresh();
    router.push('/');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="container-page flex h-16 items-center gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-[#ff9db5] text-lg font-bold text-white">
            u
          </span>
          <span className="hidden text-lg font-bold tracking-tight sm:block">{siteName}</span>
        </Link>

        <nav className="hidden items-center gap-1 lg:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-medium text-muted transition hover:bg-canvas hover:text-ink',
                pathname === item.href && 'bg-brand-light text-brand-dark',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <form onSubmit={submit} className="relative ml-auto w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('nav.searchPlaceholder')}
            className="input h-10 rounded-full pl-9 pr-20"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-full bg-brand px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-dark"
          >
            搜索
          </button>
        </form>

        <div className="flex shrink-0 items-center gap-2">
          {user ? (
            <>
              <Link href="/studio" className="btn-soft hidden sm:inline-flex">
                <Plus className="h-4 w-4" />
                {t('nav.upload')}
              </Link>
              <Link
                href="/notifications"
                className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-canvas hover:text-ink"
                aria-label="消息"
              >
                <Bell className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </Link>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((open) => !open)}
                  className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-canvas ring-1 ring-line"
                >
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-sm font-semibold text-brand">
                      {user.displayName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </button>
                {menuOpen && (
                  <div className="absolute right-0 top-12 w-52 overflow-hidden rounded-xl border border-line bg-white p-1 shadow-float">
                    <div className="px-3 py-2">
                      <div className="truncate text-sm font-semibold">{user.displayName}</div>
                      <div className="truncate text-xs text-muted">@{user.username}</div>
                    </div>
                    <Link
                      href={`/space/${user.username}`}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-canvas"
                    >
                      <User className="h-4 w-4" />
                      {t('nav.space')}
                    </Link>
                    <Link
                      href="/settings"
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-canvas"
                    >
                      <Settings className="h-4 w-4" />
                      {t('settings.title')}
                    </Link>
                    <button
                      type="button"
                      onClick={logout}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" />
                      {t('common.logout')}
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link href="/login" className="btn-ghost hidden sm:inline-flex">
                {t('common.login')}
              </Link>
              <Link href="/register" className="btn-primary">
                {t('common.register')}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
