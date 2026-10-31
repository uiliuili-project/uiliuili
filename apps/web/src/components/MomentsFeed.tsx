'use client';
import { useLocale, useT } from './I18nProvider';

import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatCount, relativeTime } from '@/lib/format';
import type { DynamicItem } from '@uiliuili/shared';
import { Heart, ImageIcon, Loader2, X } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

interface MomentResponse {
  items: DynamicItem[];
  nextCursor: string | null;
}

/**
 * Image-only waterfall built from public dynamics. The home page switches to it
 * with `/?mode=moments`; it stays a query mode so links and sharing keep working.
 */
export function MomentsFeed() {
  const t = useT();
  const locale = useLocale();
  const [items, setItems] = useState<DynamicItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [active, setActive] = useState<DynamicItem | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(
    async (cursor?: string) => {
      if (cursor) setLoadingMore(true);
      else setLoading(true);
      setError('');
      try {
        const data = await api.get<MomentResponse>(
          `/api/v1/feed/moments?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
        );
        setItems((current) => (cursor ? [...current, ...data.items] : data.items));
        setNextCursor(data.nextCursor);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : t('加载失败'));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [t],
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !nextCursor || loading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !loadingMore) void load(nextCursor);
      },
      { rootMargin: '400px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [nextCursor, loading, loadingMore, load]);

  useEffect(() => {
    if (!active) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setActive(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active]);

  const toggleLike = async (dynamic: DynamicItem, event?: React.MouseEvent) => {
    event?.stopPropagation();
    try {
      const data = dynamic.liked
        ? await api.delete<{ liked: boolean; count: number }>(`/api/v1/dynamics/${dynamic.id}/like`)
        : await api.post<{ liked: boolean; count: number }>(`/api/v1/dynamics/${dynamic.id}/like`);
      const patch = (item: DynamicItem) =>
        item.id === dynamic.id ? { ...item, liked: data.liked, likeCount: data.count } : item;
      setItems((current) => current.map(patch));
      setActive((current) => (current ? patch(current) : current));
    } catch (likeError) {
      setError(likeError instanceof Error ? likeError.message : t('操作失败'));
    }
  };

  if (loading && items.length === 0) {
    return (
      <div className="flex min-h-[320px] items-center justify-center text-sm text-muted">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {t('加载中…')}
      </div>
    );
  }

  if (!loading && items.length === 0) {
    return (
      <div className="card flex min-h-[320px] flex-col items-center justify-center p-10 text-center">
        <ImageIcon className="mb-3 h-10 w-10 text-brand" />
        <h2 className="text-base font-semibold">{t('还没有图文动态')}</h2>
        <p className="mt-1 max-w-md text-sm text-muted">
          {t('发布带图片的动态后，会出现在这里的图文瀑布流中。')}
        </p>
        <Link href="/dynamics" className="btn-primary mt-5">
          {t('去发布动态')}
        </Link>
      </div>
    );
  }

  return (
    <div className="motion-rise-in">
      {error && (
        <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>
      )}
      <div className="columns-2 gap-3 sm:columns-3 lg:columns-4">
        {items.map((dynamic) => (
          <article
            key={dynamic.id}
            className="relative mb-3 break-inside-avoid overflow-hidden rounded-xl border border-line bg-canvas"
          >
            <img
              src={dynamic.images[0]}
              alt={dynamic.content.slice(0, 80)}
              loading="lazy"
              className="w-full object-cover"
            />
            <button
              type="button"
              onClick={() => setActive(dynamic)}
              className="absolute inset-0 z-10"
              aria-label={t('查看图文详情')}
            />
            {dynamic.images.length > 1 && (
              <span className="pointer-events-none absolute right-2 top-2 z-20 rounded-full bg-black/55 px-2 py-0.5 text-[11px] text-white">
                {dynamic.images.length} {t('张')}
              </span>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/75 via-black/25 to-transparent p-2.5 text-white">
              <div className="line-clamp-2 text-xs leading-5">{dynamic.content}</div>
              <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-white/80">
                <span className="inline-flex min-w-0 items-center gap-1">
                  {dynamic.user.avatarUrl && (
                    <img
                      src={dynamic.user.avatarUrl}
                      alt=""
                      className="h-4 w-4 rounded-full object-cover"
                    />
                  )}
                  <span className="truncate">{dynamic.user.displayName}</span>
                </span>
                <button
                  type="button"
                  onClick={(event) => void toggleLike(dynamic, event)}
                  className={cn(
                    'pointer-events-auto inline-flex shrink-0 items-center gap-1 hover:text-white',
                    dynamic.liked && 'text-brand',
                  )}
                  aria-label={t('点赞')}
                >
                  <Heart className={cn('h-3 w-3', dynamic.liked && 'fill-current')} />
                  {formatCount(dynamic.likeCount, locale)}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div ref={sentinelRef} className="h-10" />
      {loadingMore && (
        <div className="flex items-center justify-center py-4 text-sm text-muted">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {t('加载更多…')}
        </div>
      )}
      {!loadingMore && !nextCursor && items.length > 0 && (
        <p className="py-6 text-center text-xs text-muted">{t('已经到底了')}</p>
      )}

      {active && (
        <div
          className="motion-fade-in fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:items-center"
          onClick={() => setActive(null)}
        >
          <div
            className="motion-pop-in relative w-full max-w-3xl rounded-2xl bg-white p-4 shadow-float sm:p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActive(null)}
              className="absolute right-3 top-3 z-10 rounded-full bg-black/50 p-1.5 text-white hover:bg-black/70"
              aria-label={t('关闭')}
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-3 pr-8">
              <Link
                href={`/space/${active.user.username}`}
                className="flex min-w-0 items-center gap-2 text-sm font-medium hover:text-brand"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-light text-xs font-semibold text-brand-dark">
                  {active.user.avatarUrl ? (
                    <img
                      src={active.user.avatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    active.user.displayName.slice(0, 1).toUpperCase()
                  )}
                </span>
                <span className="truncate">{active.user.displayName}</span>
              </Link>
              <span className="text-xs text-muted">{relativeTime(active.createdAt, locale)}</span>
            </div>
            {active.content && (
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">
                {active.content}
              </p>
            )}
            <div className="mt-3 space-y-2">
              {active.images.map((image, index) => (
                <img
                  key={image}
                  src={image}
                  alt={t('图片 {0}', { 0: index + 1 })}
                  className="w-full rounded-xl bg-canvas object-contain"
                />
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
              <button
                type="button"
                onClick={() => void toggleLike(active)}
                className={cn(
                  'inline-flex items-center gap-1.5 text-muted hover:text-brand',
                  active.liked && 'text-brand',
                )}
              >
                <Heart className={cn('h-4 w-4', active.liked && 'fill-current')} />
                {formatCount(active.likeCount, locale)}
              </button>
              {active.topic && (
                <Link href={`/topics/${active.topic.slug}`} className="text-brand hover:underline">
                  #{active.topic.title}
                </Link>
              )}
              <Link
                href={`/space/${active.user.username}`}
                className="ml-auto text-xs text-muted hover:text-brand"
              >
                {t('查看主页')} →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
