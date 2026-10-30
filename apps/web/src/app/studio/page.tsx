'use client';

import { useT } from '@/components/I18nProvider';
import { api } from '@/lib/api';
import { formatCount, relativeTime } from '@/lib/format';
import type { StudioVideo } from '@/lib/types';
import type { AuthUser } from '@uiliuili/shared';
import {
  ArrowUpRight,
  BarChart3,
  BookOpen,
  Film,
  MessageSquare,
  Play,
  Sparkles,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

interface Analytics {
  rangeDays: number;
  totals: {
    views: number;
    likes: number;
    coins: number;
    favorites: number;
    comments: number;
    danmaku: number;
    followers: number;
    gained: number;
    lost: number;
  };
  daily: Array<{ day: string; views: number; completions: number }>;
  topVideos: Array<{ id: string; title: string; coverUrl: string | null; views: number }>;
}

interface CommentRow {
  id: string;
  videoTitle: string;
  content: string;
  createdAt: string;
  displayName: string;
}

interface Growth {
  level: number;
  experience: number;
  progress: number;
  nextLevelExperience: number | null;
  badges: Array<{ code: string; label: string }>;
}

export default function StudioOverviewPage() {
  const t = useT();
  const [videos, setVideos] = useState<StudioVideo[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [growth, setGrowth] = useState<Growth | null>(null);
  const [pendingInvites, setPendingInvites] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void Promise.all([
      api.get<{ items: StudioVideo[] }>('/api/v1/studio/videos?limit=6'),
      api.get<Analytics>('/api/v1/studio/analytics?days=30'),
      api.get<{ items: CommentRow[] }>('/api/v1/studio/comments?limit=5'),
      api.get<Growth>('/api/v1/studio/growth'),
      api.get<{ pending: unknown[] }>('/api/v1/studio/collaborations'),
    ])
      .then(([studio, stats, inbox, level, collab]) => {
        setVideos(studio.items);
        setAnalytics(stats);
        setComments(inbox.items);
        setGrowth(level);
        setPendingInvites(collab.pending.length);
      })
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : t('加载失败')),
      )
      .finally(() => setLoading(false));
  }, [t]);

  const maxViews = useMemo(
    () => Math.max(1, ...(analytics?.daily.map((item) => item.views) ?? [1])),
    [analytics],
  );

  if (loading) {
    return <div className="card p-10 text-sm text-muted">{t('加载中…')}</div>;
  }

  const cards = [
    { label: '30 日播放', value: analytics?.totals.views ?? 0, icon: Play },
    { label: '新增粉丝', value: analytics?.totals.followers ?? 0, icon: Users },
    {
      label: '互动',
      value: (analytics?.totals.likes ?? 0) + (analytics?.totals.comments ?? 0),
      icon: MessageSquare,
    },
    { label: '稿件总数', value: videos.length, icon: Film },
  ];

  return (
    <div className="space-y-5">
      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="card p-4">
              <div className="flex items-center justify-between text-sm text-muted">
                <span>{t(card.label)}</span>
                <Icon className="h-4 w-4" />
              </div>
              <div className="mt-2 text-2xl font-semibold">{formatCount(card.value)}</div>
            </div>
          );
        })}
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className="card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold">
              <BarChart3 className="h-4 w-4 text-brand" />
              {t('近 30 日播放趋势')}
            </h2>
            <Link href="/studio/analytics" className="text-sm text-brand">
              {t('查看详细数据')}
            </Link>
          </div>
          <div className="flex h-40 items-end gap-1">
            {(analytics?.daily ?? []).map((item) => (
              <div
                key={item.day}
                title={`${item.day}: ${item.views}`}
                className="flex-1 rounded-t bg-brand/70 transition hover:bg-brand"
                style={{ height: `${Math.max(2, (item.views / maxViews) * 100)}%` }}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted">
            <span>{analytics?.daily[0]?.day ?? ''}</span>
            <span>{analytics?.daily.at(-1)?.day ?? ''}</span>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold">
            <Sparkles className="h-4 w-4 text-brand" />
            {t('成长进度')}
          </h2>
          <div className="text-sm text-muted">
            {t('等级')} Lv.{growth?.level ?? 0} · {t('经验')} {growth?.experience ?? 0}
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/10">
            <div
              className="h-full rounded-full bg-brand"
              style={{ width: `${growth?.progress ?? 0}%` }}
            />
          </div>
          <div className="mt-2 text-xs text-muted">
            {growth?.nextLevelExperience
              ? t('距离下一级还需 {0} 经验', {
                  0: Math.max(0, growth.nextLevelExperience - growth.experience),
                })
              : t('已达到最高等级')}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {(growth?.badges ?? []).slice(0, 6).map((badge) => (
              <span key={badge.code} className="chip">
                {badge.label}
              </span>
            ))}
          </div>
          <Link
            href="/studio/growth"
            className="mt-4 inline-flex items-center gap-1 text-sm text-brand"
          >
            {t('查看成长任务')} <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">{t('最近稿件')}</h2>
            <Link href="/studio/videos" className="text-sm text-brand">
              {t('全部稿件')}
            </Link>
          </div>
          {videos.length === 0 ? (
            <p className="py-6 text-sm text-muted">
              {t('还没有稿件，')}
              <Link href="/studio/videos/new" className="text-brand">
                {t('去投稿')}
              </Link>
            </p>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {videos.map((video) => (
                <li key={video.id}>
                  <Link
                    href={`/studio/videos/${video.id}`}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{video.title}</div>
                      <div className="mt-0.5 text-xs text-muted">
                        {t('播放')} {formatCount(video.views)} · {relativeTime(video.updatedAt)}
                      </div>
                    </div>
                    <span className="chip shrink-0">{t(video.status)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">{t('最新评论')}</h2>
            <Link href="/studio/comments" className="text-sm text-brand">
              {t('评论管理')}
            </Link>
          </div>
          {comments.length === 0 ? (
            <p className="py-6 text-sm text-muted">{t('暂时没有新评论')}</p>
          ) : (
            <ul className="space-y-3">
              {comments.map((comment) => (
                <li key={comment.id} className="rounded-lg bg-black/[0.03] p-3">
                  <div className="text-xs text-muted">
                    {comment.displayName} · {comment.videoTitle} · {relativeTime(comment.createdAt)}
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm">{comment.content}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {pendingInvites > 0 && (
        <Link
          href="/studio/collaborations"
          className="card flex items-center justify-between p-4 text-sm"
        >
          <span className="flex items-center gap-2">
            <Film className="h-4 w-4 text-brand" />
            {t('你有 {0} 个联合投稿邀请待处理', { 0: pendingInvites })}
          </span>
          <ArrowUpRight className="h-4 w-4" />
        </Link>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <QuickLink href="/studio/videos/new" icon={Film} label={t('投稿新视频')} />
        <QuickLink href="/studio/columns/new" icon={BookOpen} label={t('写一篇专栏')} />
        <QuickLink href="/studio/collections" icon={Users} label={t('整理合集')} />
      </div>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof Film;
  label: string;
}) {
  return (
    <Link href={href} className="card flex items-center gap-2 p-4 text-sm font-medium">
      <Icon className="h-4 w-4 text-brand" />
      {label}
      <ArrowUpRight className="ml-auto h-4 w-4 text-muted" />
    </Link>
  );
}
