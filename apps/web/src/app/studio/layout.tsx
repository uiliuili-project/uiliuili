'use client';

import { useT } from '@/components/I18nProvider';
import { getMe } from '@/lib/api';
import { cn } from '@/lib/cn';
import { type AuthUser, isStaffGroup } from '@uiliuili/shared';
import {
  BarChart3,
  BookOpen,
  Film,
  FolderHeart,
  Inbox,
  LayoutDashboard,
  ListVideo,
  MessageSquare,
  Music2,
  ShieldCheck,
  Sparkles,
  Trash2,
  UploadCloud,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const NAV = [
  { href: '/studio', label: '概览', icon: LayoutDashboard },
  { href: '/studio/videos', label: '投稿管理', icon: ListVideo },
  { href: '/studio/videos/new', label: '新建投稿', icon: UploadCloud },
  { href: '/studio/analytics', label: '数据', icon: BarChart3 },
  { href: '/studio/comments', label: '评论', icon: MessageSquare },
  { href: '/studio/danmaku', label: '弹幕', icon: Music2 },
  { href: '/studio/collections', label: '合集', icon: FolderHeart },
  { href: '/studio/columns', label: '专栏', icon: BookOpen },
  { href: '/studio/fans', label: '粉丝', icon: Users },
  { href: '/studio/growth', label: '成长', icon: Sparkles },
  { href: '/studio/messages', label: '消息', icon: Inbox },
  { href: '/studio/collaborations', label: '联合投稿', icon: Film },
  { href: '/studio/trash', label: '回收站', icon: Trash2 },
] as const;

export default function StudioLayout({ children }: { children: React.ReactNode }) {
  const t = useT();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void getMe()
      .then(setUser)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="container-page py-16 text-sm text-muted">{t('加载中…')}</div>;
  }

  if (!user) {
    return (
      <div className="container-page py-16">
        <div className="card mx-auto max-w-md p-10 text-center">
          <h1 className="text-xl font-semibold">{t('请先登录')}</h1>
          <p className="mt-2 text-sm text-muted">{t('登录后即可进入创作中心')}</p>
          <Link href="/login" className="btn-primary mt-6">
            {t('去登录')}
          </Link>
        </div>
      </div>
    );
  }

  // A nested route belongs to the most specific navigation entry, so
  // `/studio/videos/new` never lights up both "投稿管理" and "新建投稿".
  const activeHref = NAV.reduce<string | null>((best, item) => {
    const matches = pathname === item.href || pathname.startsWith(`${item.href}/`);
    if (!matches) return best;
    return best === null || item.href.length > best.length ? item.href : best;
  }, null);
  const isActive = (href: string) => href === activeHref;

  return (
    <div className="container-page py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">{t('创作中心')}</h1>
          <p className="mt-1 text-sm text-muted">{t('管理你的稿件、专栏与数据')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/space/${user.username}`} className="btn-ghost">
            {t('查看我的空间')}
          </Link>
          {isStaffGroup(user.group) && (
            <a href="/admin/" className="btn-soft">
              <ShieldCheck className="h-4 w-4" />
              {t(user.group === 'REVIEWER' ? '审核中心' : '管理后台')}
            </a>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[190px_minmax(0,1fr)]">
        <nav
          aria-label={t('创作中心导航')}
          className="card flex gap-1 overflow-x-auto p-2 lg:sticky lg:top-4 lg:h-fit lg:flex-col lg:overflow-visible"
        >
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm transition',
                  isActive(item.href)
                    ? 'bg-brand/10 font-medium text-brand'
                    : 'text-muted hover:bg-black/5 hover:text-[var(--foreground)]',
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="whitespace-nowrap">{t(item.label)}</span>
              </Link>
            );
          })}
        </nav>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
