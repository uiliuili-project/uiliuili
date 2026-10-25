'use client';
import { useLocale, useT } from '@/components/I18nProvider';

import { api } from '@/lib/api';
import { formatCount, formatDuration, relativeTime } from '@/lib/format';
import type { VideoCard } from '@uiliuili/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface HistoryItem {
  video: VideoCard;
  progressMs: number;
  durationMs: number;
  completed: boolean;
  watchedAt: string;
}

export default function HistoryPage() {
  const t = useT();
  const locale = useLocale();
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get<{ items: HistoryItem[] }>('/api/v1/me/history?limit=40')
      .then((data) => setItems(data.items))
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : t('加载失败')),
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container-page py-6">
      <h1 className="mb-5 text-xl font-semibold">{t('观看历史')}</h1>
      {loading && <p className="text-sm text-muted">{t('加载中…')}</p>}
      {error && (
        <div className="card p-8 text-center">
          <p className="text-sm text-muted">{error}</p>
          <Link href="/login" className="btn-primary mt-4">
            {t('去登录')}{' '}
          </Link>
        </div>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="card py-16 text-center text-sm text-muted">{t('还没有观看记录')}</div>
      )}
      <div className="space-y-3">
        {items.map((item) => {
          const duration = item.durationMs || item.video.durationSeconds * 1000;
          const percent = duration > 0 ? Math.min(100, (item.progressMs / duration) * 100) : 0;
          return (
            <Link
              key={item.video.id}
              href={`/video/${item.video.id}`}
              className="card flex gap-4 p-3 transition hover:border-brand"
            >
              <div className="relative aspect-video w-40 shrink-0 overflow-hidden rounded-lg bg-canvas sm:w-52">
                {item.video.coverUrl && (
                  <img src={item.video.coverUrl} alt="" className="h-full w-full object-cover" />
                )}
                <span className="absolute bottom-1 right-1 rounded bg-black/65 px-1.5 py-0.5 text-[11px] text-white">
                  {formatDuration(item.video.durationSeconds)}
                </span>
                <div className="absolute inset-x-0 bottom-0 h-1 bg-black/30">
                  <div className="h-full bg-brand" style={{ width: `${percent}%` }} />
                </div>
              </div>
              <div className="min-w-0 flex-1 py-1">
                <h2 className="line-clamp-2 text-sm font-medium sm:text-base">
                  {item.video.title}
                </h2>
                <p className="mt-1 text-xs text-muted">
                  {item.video.uploader.displayName} · {formatCount(item.video.views, locale)}{' '}
                  {t('播放')}{' '}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {item.completed
                    ? t('已看完')
                    : t('看到 {0} 分 {1} 秒', {
                        0: Math.floor(item.progressMs / 1000 / 60),
                        1: Math.floor((item.progressMs / 1000) % 60),
                      })}{' '}
                  · {relativeTime(item.watchedAt, locale)}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
