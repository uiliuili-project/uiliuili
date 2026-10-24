'use client';

import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { relativeTime } from '@/lib/format';
import type { NotificationItem } from '@/lib/types';
import { Bell, CheckCheck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [unreadOnly, setUnreadOnly] = useState(false);

  const load = async (unread = unreadOnly) => {
    setLoading(true);
    try {
      const data = await api.get<{ items: NotificationItem[] }>(
        `/api/v1/notifications?limit=50${unread ? '&unread=true' : ''}`,
      );
      setItems(data.items);
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const markAll = async () => {
    await api.post('/api/v1/notifications/read-all');
    setItems((current) => current.map((item) => ({ ...item, readAt: new Date().toISOString() })));
  };

  const open = async (item: NotificationItem) => {
    if (!item.readAt) {
      await api.post(`/api/v1/notifications/${item.id}/read`).catch(() => undefined);
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry,
        ),
      );
    }
  };

  return (
    <div className="container-page py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">消息中心</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const next = !unreadOnly;
              setUnreadOnly(next);
              void load(next);
            }}
            className={cn('chip', unreadOnly && 'chip-active')}
          >
            仅未读
          </button>
          <button type="button" onClick={() => void markAll()} className="btn-ghost">
            <CheckCheck className="h-4 w-4" />
            全部已读
          </button>
        </div>
      </div>
      {error && (
        <div className="card p-8 text-center">
          <p className="text-sm text-muted">{error}</p>
          <Link href="/login" className="btn-primary mt-4">
            去登录
          </Link>
        </div>
      )}
      {loading && <p className="text-sm text-muted">加载中…</p>}
      {!loading && !error && items.length === 0 && (
        <div className="card py-16 text-center text-sm text-muted">没有消息</div>
      )}
      <div className="space-y-2">
        {items.map((item) => {
          const content = (
            <div
              key={`content-${item.id}`}
              className={cn(
                'flex gap-3 rounded-xl2 border border-line bg-white p-4 transition hover:border-brand',
                !item.readAt && 'border-brand/30 bg-brand-light/20',
              )}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand-dark">
                <Bell className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{item.title}</span>
                  {!item.readAt && <span className="h-2 w-2 rounded-full bg-brand" />}
                </div>
                {item.body && <p className="mt-1 text-sm text-muted">{item.body}</p>}
                <p className="mt-1 text-xs text-muted">{relativeTime(item.createdAt)}</p>
              </div>
            </div>
          );
          return item.link ? (
            <Link key={item.id} href={item.link} onClick={() => void open(item)} className="block">
              {content}
            </Link>
          ) : (
            <button
              key={item.id}
              type="button"
              onClick={() => void open(item)}
              className="block w-full text-left"
            >
              {content}
            </button>
          );
        })}
      </div>
    </div>
  );
}
