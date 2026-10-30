'use client';

import { useT } from '@/components/I18nProvider';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatCount, formatDate } from '@/lib/format';
import type { StudioAnalytics } from '@/lib/types';
import { Eye, Heart, MessageSquare, TrendingUp, Users } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

const sourceLabels: Record<string, string> = {
  direct: '直接访问',
  home: '首页',
  search: '搜索',
  feed: '关注动态',
  related: '相关推荐',
  space: '个人空间',
  collection: '合集',
  topic: '话题',
  ranking: '排行榜',
  notification: '通知',
  external: '站外',
  unknown: '未知',
};

const deviceLabels: Record<string, string> = {
  desktop: '桌面端',
  mobile: '手机',
  tablet: '平板',
  tv: '电视',
  bot: '机器人',
  unknown: '未知',
};

const ranges = [7, 30, 90] as const;

export default function StudioAnalyticsPage() {
  const t = useT();
  const [data, setData] = useState<StudioAnalytics | null>(null);
  const [days, setDays] = useState<(typeof ranges)[number]>(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    void api
      .get<StudioAnalytics>(`/api/v1/studio/analytics?days=${days}`)
      .then(setData)
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : t('加载失败')),
      )
      .finally(() => setLoading(false));
  }, [days, t]);

  const maxViews = useMemo(
    () => Math.max(1, ...(data?.daily.map((item) => item.views) ?? [1])),
    [data],
  );

  if (loading && !data) return <div className="card p-10 text-sm text-muted">{t('加载中…')}</div>;

  const totals = data?.totals;
  const cards = [
    { label: '播放量', value: totals?.views ?? 0, icon: Eye },
    { label: '点赞', value: totals?.likes ?? 0, icon: Heart },
    { label: '互动', value: (totals?.comments ?? 0) + (totals?.danmaku ?? 0), icon: MessageSquare },
    { label: '净增粉丝', value: totals?.followers ?? 0, icon: Users },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{t('数据面板')}</h2>
          <p className="mt-1 text-sm text-muted">{t('统计为匿名聚合数据，不包含单个观众信息。')}</p>
        </div>
        <div className="flex gap-1">
          {ranges.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setDays(value)}
              className={cn('chip', days === value && 'chip-active')}
            >
              {t('近 {0} 天', { 0: value })}
            </button>
          ))}
        </div>
      </div>

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

      <section className="card p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <TrendingUp className="h-4 w-4 text-brand" />
          {t('播放趋势')}
        </h3>
        <div className="flex h-48 items-end gap-1">
          {(data?.daily ?? []).map((item) => (
            <div
              key={item.day}
              title={`${item.day}: ${item.views}`}
              className="flex-1 rounded-t bg-brand/70 transition hover:bg-brand"
              style={{ height: `${Math.max(2, (item.views / maxViews) * 100)}%` }}
            />
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted">
          <span>{data?.daily[0]?.day ?? ''}</span>
          <span>{data?.daily.at(-1)?.day ?? ''}</span>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <Breakdown title={t('播放来源')} rows={data?.sources ?? []} labels={sourceLabels} />
        <Breakdown title={t('设备分布')} rows={data?.devices ?? []} labels={deviceLabels} />
        <Breakdown title={t('国家/地区')} rows={data?.countries ?? []} labels={{}} />
      </div>

      <section className="card p-5">
        <h3 className="mb-3 text-sm font-semibold">{t('热门稿件')}</h3>
        {data?.topVideos.length ? (
          <ul className="divide-y divide-[var(--border)]">
            {data.topVideos.map((video, index) => (
              <li key={video.id} className="flex items-center gap-3 py-2.5">
                <span className="w-5 text-sm font-semibold text-muted">{index + 1}</span>
                <div className="h-10 w-16 shrink-0 overflow-hidden rounded bg-black/10">
                  {video.coverUrl && (
                    <img src={video.coverUrl} alt="" className="h-full w-full object-cover" />
                  )}
                </div>
                <Link
                  href={`/studio/videos/${video.id}`}
                  className="min-w-0 flex-1 truncate text-sm hover:text-brand"
                >
                  {video.title}
                </Link>
                <span className="text-xs text-muted">
                  {formatCount(video.views)} {t('播放')}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{t('暂时没有播放数据')}</p>
        )}
      </section>

      {data && (
        <p className="text-center text-xs text-muted">
          {formatDate(data.daily[0]?.day ?? null)} – {formatDate(data.daily.at(-1)?.day ?? null)}
        </p>
      )}
    </div>
  );
}

function Breakdown({
  title,
  rows,
  labels,
}: {
  title: string;
  rows: Array<{ key: string; value: number }>;
  labels: Record<string, string>;
}) {
  const t = useT();
  const total = rows.reduce((sum, row) => sum + row.value, 0) || 1;
  return (
    <section className="card p-5">
      <h3 className="mb-3 text-sm font-semibold">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted">{t('暂无数据')}</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.slice(0, 8).map((row) => (
            <li key={row.key || 'unknown'}>
              <div className="flex justify-between text-xs">
                <span>{t(labels[row.key] ?? (row.key || '未知'))}</span>
                <span className="text-muted">{Math.round((row.value / total) * 100)}%</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-black/10">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${Math.max(2, (row.value / total) * 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
