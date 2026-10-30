'use client';

import { useT } from '@/components/I18nProvider';
import { api } from '@/lib/api';
import { formatCount, relativeTime } from '@/lib/format';
import { UserPlus, Users } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

interface FansResponse {
  followers: number;
  following: number;
  recent: Array<{
    username: string;
    displayName: string;
    avatarUrl: string | null;
    level: number;
    followedAt: string;
  }>;
  trend: Array<{ day: string; gained: number; lost: number }>;
}

export default function StudioFansPage() {
  const t = useT();
  const [data, setData] = useState<FansResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    void api
      .get<FansResponse>('/api/v1/studio/fans')
      .then(setData)
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : t('加载失败')),
      )
      .finally(() => setLoading(false));
  }, [t]);

  const maxTrend = useMemo(
    () => Math.max(1, ...(data?.trend.map((item) => Math.max(item.gained, item.lost)) ?? [1])),
    [data],
  );

  if (loading) return <div className="card p-10 text-sm text-muted">{t('加载中…')}</div>;
  if (error)
    return <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold">{t('粉丝')}</h2>
        <p className="mt-1 text-sm text-muted">{t('查看粉丝增长与最近关注你的用户。')}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card p-4">
          <div className="flex items-center justify-between text-sm text-muted">
            <span>{t('粉丝总数')}</span>
            <Users className="h-4 w-4" />
          </div>
          <div className="mt-2 text-2xl font-semibold">{formatCount(data?.followers ?? 0)}</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-muted">{t('关注中')}</div>
          <div className="mt-2 text-2xl font-semibold">{formatCount(data?.following ?? 0)}</div>
        </div>
        <div className="card p-4">
          <div className="text-sm text-muted">{t('近 30 天净增')}</div>
          <div className="mt-2 text-2xl font-semibold">
            {formatCount(
              (data?.trend ?? []).reduce((sum, item) => sum + item.gained - item.lost, 0),
            )}
          </div>
        </div>
      </div>

      <section className="card p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <UserPlus className="h-4 w-4 text-brand" />
          {t('近 30 天关注趋势')}
        </h3>
        <div className="flex h-36 items-end gap-1">
          {(data?.trend ?? []).map((item) => (
            <div
              key={item.day}
              title={`${item.day}: +${item.gained} / -${item.lost}`}
              className="flex flex-1 flex-col justify-end gap-0.5"
            >
              <div
                className="w-full rounded-t bg-brand/70"
                style={{ height: `${Math.max(1, (item.gained / maxTrend) * 100)}%` }}
              />
              <div
                className="w-full rounded-b bg-red-300"
                style={{ height: `${Math.max(1, (item.lost / maxTrend) * 100)}%` }}
              />
            </div>
          ))}
        </div>
      </section>

      <section className="card p-5">
        <h3 className="mb-3 text-sm font-semibold">{t('最近关注')}</h3>
        {data?.recent.length ? (
          <ul className="divide-y divide-[var(--border)]">
            {data.recent.map((fan) => (
              <li key={fan.username} className="flex items-center gap-3 py-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-light text-xs font-semibold text-brand-dark">
                  {fan.avatarUrl ? (
                    <img src={fan.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    fan.displayName.slice(0, 1).toUpperCase()
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/space/${fan.username}`}
                    className="truncate text-sm hover:text-brand"
                  >
                    {fan.displayName}
                  </Link>
                  <div className="text-xs text-muted">
                    Lv.{fan.level} · @{fan.username}
                  </div>
                </div>
                <span className="text-xs text-muted">{relativeTime(fan.followedAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">{t('还没有粉丝，继续投稿吧')}</p>
        )}
      </section>
    </div>
  );
}
