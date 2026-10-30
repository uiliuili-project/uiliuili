'use client';

import { useT } from '@/components/I18nProvider';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatDuration, relativeTime } from '@/lib/format';
import { Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface DanmakuRow {
  id: string;
  videoId: string;
  videoTitle: string;
  content: string;
  progressMs: number;
  color: string;
  mode: string;
  status: string;
  createdAt: string;
  username: string;
  displayName: string;
}

const filters = ['all', 'visible', 'hidden'] as const;

export default function StudioDanmakuPage() {
  const t = useT();
  const [items, setItems] = useState<DanmakuRow[]>([]);
  const [status, setStatus] = useState<(typeof filters)[number]>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    const query = status === 'all' ? '' : `&status=${status}`;
    const data = await api.get<{ items: DanmakuRow[] }>(`/api/v1/studio/danmaku?limit=50${query}`);
    setItems(data.items);
  };

  useEffect(() => {
    setLoading(true);
    void load()
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : t('加载失败')),
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const moderate = async (row: DanmakuRow, action: 'hide' | 'visible') => {
    setError('');
    try {
      await api.post(`/api/v1/studio/danmaku/${row.id}/moderate`, { action });
      await load();
    } catch (moderateError) {
      setError(moderateError instanceof Error ? moderateError.message : t('操作失败'));
    }
  };

  if (loading) return <div className="card p-10 text-sm text-muted">{t('加载中…')}</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{t('弹幕管理')}</h2>
          <p className="mt-1 text-sm text-muted">{t('查看并隐藏不合适的弹幕。')}</p>
        </div>
        <div className="flex gap-1">
          {filters.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setStatus(item)}
              className={cn('chip', status === item && 'chip-active')}
            >
              {t(item === 'all' ? '全部' : item === 'visible' ? '显示中' : '已隐藏')}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      <div className="card divide-y divide-[var(--border)]">
        {items.map((row) => (
          <div key={row.id} className="flex flex-wrap items-center gap-3 p-4">
            <span
              className="max-w-[45%] truncate text-sm font-medium"
              style={{ color: row.color || undefined }}
            >
              {row.content}
            </span>
            <span className="text-xs text-muted">{formatDuration(row.progressMs / 1000)}</span>
            <span className="text-xs text-muted">{row.displayName}</span>
            <span className="text-xs text-muted">{relativeTime(row.createdAt)}</span>
            <Link
              href={`/video/${row.videoId}`}
              target="_blank"
              className="min-w-0 flex-1 truncate text-right text-xs text-brand hover:underline"
            >
              {row.videoTitle}
            </Link>
            {row.status === 'visible' ? (
              <button
                type="button"
                onClick={() => void moderate(row, 'hide')}
                className="btn-ghost px-2 py-1"
              >
                <EyeOff className="h-4 w-4" />
                {t('隐藏')}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void moderate(row, 'visible')}
                className="btn-ghost px-2 py-1"
              >
                <Eye className="h-4 w-4" />
                {t('恢复')}
              </button>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <p className="p-10 text-center text-sm text-muted">{t('没有符合条件的弹幕')}</p>
        )}
      </div>
    </div>
  );
}
