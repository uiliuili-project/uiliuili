'use client';

import { useT } from '@/components/I18nProvider';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { relativeTime } from '@/lib/format';
import type { NotificationItem } from '@/lib/types';
import { Bell, CheckCheck } from 'lucide-react';
import { useEffect, useState } from 'react';

const filters = ['all', 'unread'] as const;

export default function StudioMessagesPage() {
  const t = useT();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [filter, setFilter] = useState<(typeof filters)[number]>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    const data = await api.get<{ items: NotificationItem[] }>(
      `/api/v1/notifications?limit=50${filter === 'unread' ? '&unread=true' : ''}`,
    );
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
  }, [filter]);

  const markAll = async () => {
    await api
      .post('/api/v1/notifications/read-all')
      .then(load)
      .catch(() => undefined);
  };

  const markOne = async (id: string) => {
    await api
      .post(`/api/v1/notifications/${id}/read`)
      .then(load)
      .catch(() => undefined);
  };

  if (loading) return <div className="card p-10 text-sm text-muted">{t('加载中…')}</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{t('消息中心')}</h2>
          <p className="mt-1 text-sm text-muted">{t('审核结果、评论、粉丝与联合投稿通知。')}</p>
        </div>
        <div className="flex items-center gap-2">
          {filters.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setFilter(item)}
              className={cn('chip', filter === item && 'chip-active')}
            >
              {t(item === 'all' ? '全部' : '未读')}
            </button>
          ))}
          <button type="button" onClick={() => void markAll()} className="btn-ghost">
            <CheckCheck className="h-4 w-4" />
            {t('全部已读')}
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      <div className="card divide-y divide-[var(--border)]">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => void markOne(item.id)}
            className="flex w-full items-start gap-3 p-4 text-left transition hover:bg-canvas"
          >
            <Bell className={cn('mt-0.5 h-4 w-4', item.readAt ? 'text-muted' : 'text-brand')} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span
                  className={cn('truncate text-sm', item.readAt ? 'text-muted' : 'font-medium')}
                >
                  {item.title}
                </span>
                <span className="shrink-0 text-xs text-muted">{relativeTime(item.createdAt)}</span>
              </div>
              {item.body && <p className="mt-1 line-clamp-2 text-xs text-muted">{item.body}</p>}
            </div>
          </button>
        ))}
        {items.length === 0 && (
          <p className="p-10 text-center text-sm text-muted">{t('暂时没有消息')}</p>
        )}
      </div>
    </div>
  );
}
