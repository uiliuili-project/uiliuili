'use client';

import { useT } from '@/components/I18nProvider';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { relativeTime } from '@/lib/format';
import { Eye, EyeOff, Trash2, User } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

interface CommentRow {
  id: string;
  videoId: string;
  videoTitle: string;
  content: string;
  status: string;
  likeCount: number;
  ipRegion: string | null;
  createdAt: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

const filters = ['all', 'visible', 'hidden', 'pending'] as const;

export default function StudioCommentsPage() {
  const t = useT();
  const [items, setItems] = useState<CommentRow[]>([]);
  const [status, setStatus] = useState<(typeof filters)[number]>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    const query = status === 'all' ? '' : `&status=${status}`;
    const data = await api.get<{ items: CommentRow[] }>(`/api/v1/studio/comments?limit=50${query}`);
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

  const moderate = async (comment: CommentRow, action: 'hide' | 'visible' | 'delete') => {
    if (action === 'delete' && !window.confirm(t('确定删除这条评论吗？'))) return;
    setError('');
    try {
      await api.post(`/api/v1/studio/comments/${comment.id}/moderate`, { action });
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
          <h2 className="text-base font-semibold">{t('评论管理')}</h2>
          <p className="mt-1 text-sm text-muted">{t('管理所有稿件下的评论。')}</p>
        </div>
        <div className="flex gap-1">
          {filters.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setStatus(item)}
              className={cn('chip', status === item && 'chip-active')}
            >
              {t(
                item === 'all'
                  ? '全部'
                  : item === 'visible'
                    ? '显示中'
                    : item === 'hidden'
                      ? '已隐藏'
                      : '待审核',
              )}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      <div className="space-y-3">
        {items.map((comment) => (
          <div key={comment.id} className="card p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="flex items-center gap-1 font-medium text-ink">
                <User className="h-3.5 w-3.5" />
                {comment.displayName}
              </span>
              <span>@{comment.username}</span>
              {comment.ipRegion && <span>{comment.ipRegion}</span>}
              <span>{relativeTime(comment.createdAt)}</span>
              <span className="chip">{t(comment.status)}</span>
            </div>
            <p className="mt-2 whitespace-pre-wrap break-words text-sm">{comment.content}</p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <Link
                href={`/video/${comment.videoId}`}
                target="_blank"
                className="truncate text-xs text-brand hover:underline"
              >
                {comment.videoTitle}
              </Link>
              <div className="flex items-center gap-2">
                {comment.status === 'visible' ? (
                  <button
                    type="button"
                    onClick={() => void moderate(comment, 'hide')}
                    className="btn-ghost px-2 py-1"
                  >
                    <EyeOff className="h-4 w-4" />
                    {t('隐藏')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void moderate(comment, 'visible')}
                    className="btn-ghost px-2 py-1"
                  >
                    <Eye className="h-4 w-4" />
                    {t('恢复显示')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void moderate(comment, 'delete')}
                  className="btn-ghost px-2 py-1 text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                  {t('删除')}
                </button>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="card p-10 text-center text-sm text-muted">{t('没有符合条件的评论')}</div>
        )}
      </div>
    </div>
  );
}
