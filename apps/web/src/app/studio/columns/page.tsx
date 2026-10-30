'use client';

import { useT } from '@/components/I18nProvider';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatCount, relativeTime } from '@/lib/format';
import type { StudioArticle } from '@/lib/types';
import { Eye, Pencil, Plus, Trash2, UploadCloud } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

const filters = ['all', 'draft', 'pending_review', 'published', 'blocked'] as const;

export default function StudioColumnsPage() {
  const t = useT();
  const [items, setItems] = useState<StudioArticle[]>([]);
  const [status, setStatus] = useState<(typeof filters)[number]>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    const data = await api.get<{ items: StudioArticle[] }>('/api/v1/studio/articles?limit=50');
    setItems(data.items);
  };

  useEffect(() => {
    void load()
      .catch((loadError) =>
        setError(loadError instanceof Error ? loadError.message : t('加载失败')),
      )
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const publish = async (article: StudioArticle) => {
    setError('');
    try {
      await api.post(`/api/v1/studio/articles/${article.id}/publish`);
      await load();
    } catch (publishError) {
      setError(publishError instanceof Error ? publishError.message : t('发布失败'));
    }
  };

  const remove = async (article: StudioArticle) => {
    if (!window.confirm(t('确定删除专栏「{0}」吗？', { 0: article.title }))) return;
    await api
      .delete(`/api/v1/studio/articles/${article.id}`)
      .then(load)
      .catch(() => undefined);
  };

  const filtered = status === 'all' ? items : items.filter((item) => item.status === status);

  if (loading) return <div className="card p-10 text-sm text-muted">{t('加载中…')}</div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{t('专栏')}</h2>
          <p className="mt-1 text-sm text-muted">{t('用长文分享你的想法与创作笔记。')}</p>
        </div>
        <Link href="/studio/columns/new" className="btn-primary">
          <Plus className="h-4 w-4" />
          {t('写专栏')}
        </Link>
      </div>

      {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">{error}</div>}

      <div className="flex flex-wrap gap-1">
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
                : item === 'draft'
                  ? '草稿'
                  : item === 'pending_review'
                    ? '审核中'
                    : item === 'published'
                      ? '已发布'
                      : '已下架',
            )}
          </button>
        ))}
      </div>

      <div className="card divide-y divide-[var(--border)]">
        {filtered.map((article) => (
          <div key={article.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="h-14 w-20 shrink-0 overflow-hidden rounded bg-black/10">
              {article.coverUrl ? (
                <img src={article.coverUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-muted">
                  <UploadCloud className="h-4 w-4" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <Link
                href={`/studio/columns/${article.id}`}
                className="truncate text-sm font-medium hover:text-brand"
              >
                {article.title}
              </Link>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted">
                <span className="chip">{t(article.status)}</span>
                <span>
                  {formatCount(article.viewCount)} {t('阅读')} · {formatCount(article.likeCount)}{' '}
                  {t('赞')}
                </span>
                <span>{relativeTime(article.updatedAt)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {article.status === 'published' && (
                <Link
                  href={`/columns/${article.id}`}
                  target="_blank"
                  className="btn-ghost px-2 py-1"
                  title={t('查看')}
                >
                  <Eye className="h-4 w-4" />
                </Link>
              )}
              {(article.status === 'draft' || article.status === 'pending_review') && (
                <button
                  type="button"
                  onClick={() => void publish(article)}
                  className="btn-soft px-2 py-1"
                >
                  {t('发布')}
                </button>
              )}
              <Link
                href={`/studio/columns/${article.id}`}
                className="btn-ghost px-2 py-1"
                title={t('编辑')}
              >
                <Pencil className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={() => void remove(article)}
                className="btn-ghost px-2 py-1 text-red-600"
                title={t('删除')}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="p-10 text-center text-sm text-muted">{t('还没有专栏文章')}</p>
        )}
      </div>
    </div>
  );
}
