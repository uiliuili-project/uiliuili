'use client';

import { useLocale, useT } from '@/components/I18nProvider';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { relativeTime } from '@/lib/format';
import type { StudioVideo } from '@/lib/types';
import { RotateCcw, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function StudioTrashPage() {
  const t = useT();
  const locale = useLocale();
  const [items, setItems] = useState<StudioVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const data = await api.get<{ items: StudioVideo[] }>('/api/v1/studio/videos/trash?limit=50');
    setItems(data.items);
  };

  useEffect(() => {
    void load()
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : t('加载失败')),
      )
      .finally(() => setLoading(false));
  }, [t]);

  const restore = async (video: StudioVideo) => {
    setError('');
    try {
      await api.post(`/api/v1/studio/videos/${video.id}/restore`);
      setMessage(t('已恢复「{0}」', { 0: video.title }));
      await load();
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : t('恢复失败'));
    }
  };

  const purge = async (video: StudioVideo) => {
    if (!window.confirm(t('彻底删除后无法恢复，确定删除「{0}」吗？', { 0: video.title }))) return;
    setError('');
    try {
      await api.delete(`/api/v1/studio/videos/${video.id}/purge`);
      setMessage(t('已彻底删除'));
      await load();
    } catch (purgeError) {
      setError(purgeError instanceof Error ? purgeError.message : t('删除失败'));
    }
  };

  if (loading) return <div className="card p-10 text-sm text-muted">{t('加载中…')}</div>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold">{t('回收站')}</h2>
        <p className="mt-1 text-sm text-muted">{t('删除的稿件会先进入这里，恢复后可继续管理。')}</p>
      </div>

      {(message || error) && (
        <div
          className={cn(
            'rounded-xl px-4 py-3 text-sm',
            error ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700',
          )}
        >
          {error || message}
        </div>
      )}

      <div className="card divide-y divide-[var(--border)]">
        {items.map((video) => (
          <div key={video.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="h-14 w-24 shrink-0 overflow-hidden rounded bg-black/10">
              {video.coverUrl && (
                <img src={video.coverUrl} alt="" className="h-full w-full object-cover" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{video.title}</div>
              <div className="mt-0.5 text-xs text-muted">
                {t('删除于')} {relativeTime(video.updatedAt, locale)} · {t(video.status)}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => void restore(video)} className="btn-soft">
                <RotateCcw className="h-4 w-4" />
                {t('恢复')}
              </button>
              <button
                type="button"
                onClick={() => void purge(video)}
                className="btn-ghost text-red-600"
              >
                <Trash2 className="h-4 w-4" />
                {t('彻底删除')}
              </button>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="p-10 text-center text-sm text-muted">{t('回收站是空的')}</p>
        )}
      </div>
    </div>
  );
}
