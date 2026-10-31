import { formatCount, formatDuration, relativeTime } from '@/lib/format';
import { getLocale, getT } from '@/lib/i18n-server';
import { serverFetchSafe } from '@/lib/server-api';
import type { RankingItem } from '@uiliuili/shared';
import { Trophy } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('排行榜') };
}

const PERIODS = [
  { key: 'day', label: '日榜' },
  { key: 'week', label: '周榜' },
  { key: 'month', label: '月榜' },
  { key: 'all', label: '总榜' },
] as const;

interface PageProps {
  searchParams: Promise<{ period?: string }>;
}

export default async function RankingsPage({ searchParams }: PageProps) {
  const { period: rawPeriod } = await searchParams;
  const period = PERIODS.some((item) => item.key === rawPeriod) ? rawPeriod : 'week';
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const data = await serverFetchSafe<{ items: RankingItem[] }>(
    `/api/v1/rankings?period=${period}&limit=30`,
    { items: [] },
  );

  return (
    <div className="container-page py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Trophy className="h-5 w-5 text-brand" />
          {t('排行榜')}
        </h1>
        <div className="flex gap-1 rounded-lg bg-canvas p-1 text-xs">
          {PERIODS.map((item) => (
            <Link
              key={item.key}
              href={`/rankings?period=${item.key}`}
              className={
                period === item.key
                  ? 'rounded-md bg-white px-3 py-1.5 text-brand shadow-sm'
                  : 'rounded-md px-3 py-1.5 text-muted'
              }
            >
              {t(item.label)}
            </Link>
          ))}
        </div>
      </div>

      {data.items.length === 0 ? (
        <div className="card py-16 text-center text-sm text-muted">{t('暂无排行数据')}</div>
      ) : (
        <div key={period} className="motion-rise-in space-y-2">
          {data.items.map((item, index) => (
            <Link
              key={item.video.id}
              href={`/video/${item.video.id}`}
              className="card flex items-center gap-4 p-3 transition hover:border-brand"
            >
              <div
                className={
                  index < 3
                    ? 'w-8 shrink-0 text-center text-xl font-bold text-brand'
                    : 'w-8 shrink-0 text-center text-lg font-semibold text-muted'
                }
              >
                {item.rank ?? index + 1}
              </div>
              <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-lg bg-canvas sm:w-40">
                {item.video.coverUrl && (
                  <img src={item.video.coverUrl} alt="" className="h-full w-full object-cover" />
                )}
                <span className="absolute bottom-1 right-1 rounded bg-black/65 px-1.5 py-0.5 text-[11px] text-white">
                  {formatDuration(item.video.durationSeconds)}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="line-clamp-2 text-sm font-medium sm:text-base">
                  {item.video.title}
                </h2>
                <p className="mt-1 text-xs text-muted">
                  {item.video.uploader.displayName} ·{' '}
                  {relativeTime(item.video.publishedAt ?? item.video.createdAt, locale)}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {period === 'all'
                    ? `${formatCount(item.video.views, locale)} ${t('播放')}`
                    : `${formatCount(item.periodViews, locale)} ${t('期间播放')}`}
                  {' · '}
                  {formatCount(item.video.likes, locale)} {t('点赞')}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
