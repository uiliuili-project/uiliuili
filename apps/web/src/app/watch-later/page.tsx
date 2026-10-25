'use client';
import { useLocale, useT } from '@/components/I18nProvider';

import { api } from '@/lib/api';
import { formatCount, formatDuration } from '@/lib/format';
import type { VideoCard } from '@uiliuili/shared';
import { Clock, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function WatchLaterPage() {
  const t = useT();
  const locale = useLocale();
  const [items, setItems] = useState<VideoCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const data = await api.get<{ items: VideoCard[] }>('/api/v1/me/watch-later');
      setItems(data.items);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : t('加载失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const remove = async (videoId: string) => {
    await api.delete(`/api/v1/videos/${videoId}/watch-later`).catch(() => undefined);
    setItems((current) => current.filter((video) => video.id !== videoId));
  };

  return (
    <div className="container-page py-6">
      <div className="mb-5 flex items-center gap-2">
        <Clock className="h-5 w-5 text-brand" />
        <h1 className="text-xl font-semibold">{t('稍后再看')}</h1>
        <span className="text-sm text-muted">
          {items.length} {t('个视频')}
        </span>
      </div>

      {loading && <p className="text-sm text-muted">{t('加载中…')}</p>}
      {error && (
        <div className="card p-8 text-center">
          <p className="text-sm text-muted">{error}</p>
          <Link href="/login" className="btn-primary mt-4">
            {t('去登录')}
          </Link>
        </div>
      )}
      {!loading && !error && items.length === 0 && (
        <div className="card py-16 text-center text-sm text-muted">{t('稍后再看还是空的')}</div>
      )}

      {items.length > 0 && (
        <div className="space-y-3">
          {items.map((video) => (
            <div key={video.id} className="card flex flex-wrap gap-4 p-3 sm:flex-nowrap">
              <Link
                href={`/video/${video.id}`}
                className="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg bg-canvas sm:w-56"
              >
                {video.coverUrl && (
                  <img src={video.coverUrl} alt="" className="h-full w-full object-cover" />
                )}
                <span className="absolute bottom-1 right-1 rounded bg-black/65 px-1.5 py-0.5 text-[11px] text-white">
                  {formatDuration(video.durationSeconds)}
                </span>
              </Link>
              <div className="min-w-0 flex-1 py-0.5">
                <Link
                  href={`/video/${video.id}`}
                  className="line-clamp-2 text-sm font-medium hover:text-brand"
                >
                  {video.title}
                </Link>
                <p className="mt-1 text-xs text-muted">
                  {video.uploader.displayName} · {formatCount(video.views, locale)} {t('播放')}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <Link
                    href={`/video/${video.id}`}
                    className="btn-soft h-8 rounded-full px-3 text-xs"
                  >
                    {t('继续观看')}
                  </Link>
                  <button
                    type="button"
                    onClick={() => void remove(video.id)}
                    className="btn-ghost h-8 rounded-full px-3 text-xs text-red-500 hover:border-red-200 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {t('移除')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
