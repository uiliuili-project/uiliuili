'use client';

import { useT } from '@/components/I18nProvider';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatCount, formatDate } from '@/lib/format';
import type { StudioVideo } from '@/lib/types';
import { ExternalLink, Pencil, Plus, Search, Trash2, UploadCloud } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

const STATUS_FILTERS = [
  'all',
  'draft',
  'uploading',
  'processing',
  'ready',
  'pending_review',
  'published',
  'blocked',
  'failed',
] as const;

export default function StudioVideosPage() {
  const t = useT();
  const [videos, setVideos] = useState<StudioVideo[]>([]);
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>('all');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const data = await api.get<{ items: StudioVideo[] }>('/api/v1/studio/videos?limit=50');
    setVideos(data.items);
  };

  useEffect(() => {
    void load()
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : t('加载失败')),
      )
      .finally(() => setLoading(false));
  }, [t]);

  const filtered = useMemo(
    () =>
      videos.filter(
        (video) =>
          (status === 'all' || video.status === status) &&
          (!q.trim() || video.title.toLowerCase().includes(q.trim().toLowerCase())),
      ),
    [videos, status, q],
  );

  const remove = async (video: StudioVideo) => {
    if (!window.confirm(t('确定将「{0}」移入回收站吗？', { 0: video.title }))) return;
    setError('');
    try {
      await api.delete(`/api/v1/studio/videos/${video.id}`);
      setMessage(t('已移入回收站'));
      await load();
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : t('操作失败'));
    }
  };

  if (loading) return <div className="card p-10 text-sm text-muted">{t('加载中…')}</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{t('投稿管理')}</h2>
        <Link href="/studio/videos/new" className="btn-primary">
          <Plus className="h-4 w-4" />
          {t('投稿新视频')}
        </Link>
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

      <div className="card flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[180px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={q}
            onChange={(event) => setQ(event.target.value)}
            placeholder={t('搜索稿件标题')}
            className="input pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {STATUS_FILTERS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setStatus(item)}
              className={cn('chip', status === item && 'chip-active')}
            >
              {t(item === 'all' ? '全部' : item)}
            </button>
          ))}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs text-muted">
              <th className="px-4 py-3 font-medium">{t('稿件')}</th>
              <th className="px-4 py-3 font-medium">{t('状态')}</th>
              <th className="px-4 py-3 font-medium">{t('播放')}</th>
              <th className="px-4 py-3 font-medium">{t('互动')}</th>
              <th className="px-4 py-3 font-medium">{t('更新时间')}</th>
              <th className="px-4 py-3 font-medium">{t('操作')}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((video) => (
              <tr key={video.id} className="border-b border-[var(--border)] last:border-0">
                <td className="max-w-[320px] px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-20 shrink-0 overflow-hidden rounded bg-black/10">
                      {video.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={video.coverUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted">
                          <UploadCloud className="h-4 w-4" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/studio/videos/${video.id}`}
                        className="truncate font-medium hover:text-brand"
                      >
                        {video.title}
                      </Link>
                      <div className="mt-0.5 text-xs text-muted">
                        {video.durationSeconds
                          ? `${Math.floor(video.durationSeconds / 60)}:${String(video.durationSeconds % 60).padStart(2, '0')}`
                          : '—'}
                        {video.contentType && video.contentType !== 'original'
                          ? ` · ${t(video.contentType)}`
                          : ''}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="chip">{t(video.status)}</span>
                </td>
                <td className="px-4 py-3">{formatCount(video.views)}</td>
                <td className="px-4 py-3 text-xs text-muted">
                  {t('赞')} {formatCount(video.likes)} · {t('评论')} {formatCount(video.comments)}
                </td>
                <td className="px-4 py-3 text-xs text-muted">{formatDate(video.updatedAt)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/studio/videos/${video.id}`}
                      className="btn-ghost px-2 py-1"
                      title={t('编辑')}
                    >
                      <Pencil className="h-4 w-4" />
                    </Link>
                    {video.status === 'published' && (
                      <a
                        href={`/video/${video.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="btn-ghost px-2 py-1"
                        title={t('查看')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => void remove(video)}
                      className="btn-ghost px-2 py-1 text-red-600"
                      title={t('移入回收站')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted">
                  {t('没有符合条件的稿件')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
