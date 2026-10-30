'use client';
import { useLocale, useT } from '@/components/I18nProvider';

import { api, getMe, uploadImage } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatCount, relativeTime } from '@/lib/format';
import { assertImageFile } from '@/lib/image';
import { regionLabel } from '@uiliuili/shared';
import type { DynamicItem, TopicInfo } from '@uiliuili/shared';
import { Heart, ImagePlus, Loader2, Send, Sparkles, Trash2, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

interface DynamicResponse {
  items: DynamicItem[];
  nextCursor: string | null;
}

export default function DynamicsPage() {
  const t = useT();
  const locale = useLocale();
  const [feed, setFeed] = useState<'all' | 'following'>('all');
  const [items, setItems] = useState<DynamicItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [topics, setTopics] = useState<TopicInfo[]>([]);
  const [meId, setMeId] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [topicId, setTopicId] = useState('');
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [message, setMessage] = useState('');

  const load = async (cursor?: string, append = false) => {
    setLoading(true);
    try {
      const data = await api.get<DynamicResponse>(
        `/api/v1/dynamics?feed=${feed}&limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
      );
      setItems((current) => (append ? [...current, ...data.items] : data.items));
      setNextCursor(data.nextCursor);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('加载失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [feed]);

  useEffect(() => {
    void getMe().then((user) => setMeId(user?.id ?? null));
    void api
      .get<{ items: TopicInfo[] }>('/api/v1/topics?limit=12')
      .then((data) => setTopics(data.items))
      .catch(() => undefined);
  }, []);

  const addImages = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setMessage('');
    setUploading(true);
    try {
      const remaining = Math.max(0, 9 - images.length);
      const chosen = Array.from(files).slice(0, remaining);
      for (const file of chosen) assertImageFile(file, 10);
      const uploaded = await Promise.all(chosen.map((file) => uploadImage(file)));
      setImages((current) => [...current, ...uploaded.map((item) => item.url)].slice(0, 9));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('上传失败'));
    } finally {
      setUploading(false);
      if (imageInputRef.current) imageInputRef.current.value = '';
    }
  };

  const publish = async () => {
    if (!content.trim() && images.length === 0) return;
    setPosting(true);
    setMessage('');
    try {
      await api.post('/api/v1/dynamics', {
        content: content.trim(),
        images,
        topicId: topicId || undefined,
        visibility: 'public',
      });
      setContent('');
      setImages([]);
      setTopicId('');
      await load();
      setMessage(t('动态已发布'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('发布失败'));
    } finally {
      setPosting(false);
    }
  };

  const toggleLike = async (dynamic: DynamicItem) => {
    try {
      const data = dynamic.liked
        ? await api.delete<{ liked: boolean; count: number }>(`/api/v1/dynamics/${dynamic.id}/like`)
        : await api.post<{ liked: boolean; count: number }>(`/api/v1/dynamics/${dynamic.id}/like`);
      setItems((current) =>
        current.map((item) =>
          item.id === dynamic.id ? { ...item, liked: data.liked, likeCount: data.count } : item,
        ),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : t('操作失败'));
    }
  };

  const remove = async (dynamic: DynamicItem) => {
    if (!window.confirm(t('确定删除这条动态吗？'))) return;
    await api.delete(`/api/v1/dynamics/${dynamic.id}`).catch(() => undefined);
    setItems((current) => current.filter((item) => item.id !== dynamic.id));
  };

  return (
    <div className="container-page py-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <div className="mb-4 flex items-center justify-between">
            <h1 className="flex items-center gap-2 text-xl font-semibold">
              <Sparkles className="h-5 w-5 text-brand" />
              {t('动态')}
            </h1>
            <div className="flex gap-1 rounded-lg bg-canvas p-1 text-xs">
              <button
                type="button"
                onClick={() => setFeed('all')}
                className={cn('rounded-md px-3 py-1.5', feed === 'all' && 'bg-white shadow-sm')}
              >
                {t('全部')}
              </button>
              <button
                type="button"
                onClick={() => setFeed('following')}
                className={cn(
                  'rounded-md px-3 py-1.5',
                  feed === 'following' && 'bg-white shadow-sm',
                )}
              >
                {t('关注')}
              </button>
            </div>
          </div>

          <div className="card p-4">
            <textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              maxLength={2000}
              rows={3}
              placeholder={t('分享此刻的想法…')}
              className="input resize-none"
            />
            {images.length > 0 && (
              <div className="mt-2 grid grid-cols-4 gap-1.5 sm:grid-cols-5">
                {images.map((image) => (
                  <div
                    key={image}
                    className="group relative aspect-square overflow-hidden rounded-lg bg-canvas"
                  >
                    <img src={image} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() =>
                        setImages((current) => current.filter((item) => item !== image))
                      }
                      className="absolute right-1 top-1 rounded-full bg-black/60 p-0.5 text-white"
                      aria-label={t('移除图片')}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(event) => void addImages(event.target.files)}
              />
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                disabled={uploading || images.length >= 9}
                className="inline-flex items-center gap-1 hover:text-brand disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImagePlus className="h-4 w-4" />
                )}
                {uploading ? t('上传中…') : t('添加图片')}
              </button>
              <span>{images.length}/9</span>
              <select
                value={topicId}
                onChange={(event) => setTopicId(event.target.value)}
                className="input ml-auto h-8 w-36 text-xs"
              >
                <option value="">{t('选择话题')}</option>
                {topics.map((topic) => (
                  <option key={topic.id} value={topic.id}>
                    #{topic.title}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void publish()}
                disabled={posting || uploading || (!content.trim() && images.length === 0)}
                className="btn-primary h-8 shrink-0 rounded-full px-3 text-xs"
              >
                <Send className="h-3.5 w-3.5" />
                {t('发布')}
              </button>
            </div>
            {message && <p className="mt-2 text-xs text-muted">{message}</p>}
          </div>

          <div className="mt-5 space-y-4">
            {items.map((dynamic) => (
              <article key={dynamic.id} className="card p-4">
                <div className="flex items-center justify-between gap-3">
                  <Link
                    href={`/space/${dynamic.user.username}`}
                    className="flex items-center gap-3"
                  >
                    <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-brand-light text-sm font-semibold text-brand-dark">
                      {dynamic.user.avatarUrl ? (
                        <img
                          src={dynamic.user.avatarUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        dynamic.user.displayName.slice(0, 1).toUpperCase()
                      )}
                    </span>
                    <span>
                      <span className="block text-sm font-medium">{dynamic.user.displayName}</span>
                      <span className="block text-xs text-muted">
                        {relativeTime(dynamic.createdAt, locale)}
                        {dynamic.topic && (
                          <>
                            {' · '}
                            <Link
                              href={`/topics/${dynamic.topic.slug}`}
                              className="text-brand hover:underline"
                            >
                              #{dynamic.topic.title}
                            </Link>
                          </>
                        )}
                        {dynamic.ipRegion && (
                          <>
                            {' · '}
                            {t('IP 属地：{0}', { 0: regionLabel(dynamic.ipRegion, locale) })}
                          </>
                        )}
                      </span>
                    </span>
                  </Link>
                  {meId === dynamic.user.id && (
                    <button
                      type="button"
                      onClick={() => void remove(dynamic)}
                      className="text-muted hover:text-red-500"
                      title={t('删除')}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {dynamic.content && (
                  <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">
                    {dynamic.content}
                  </p>
                )}
                {dynamic.images.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-1.5">
                    {dynamic.images.map((image) => (
                      <img
                        key={image}
                        src={image}
                        alt=""
                        className="aspect-square w-full rounded-lg object-cover"
                      />
                    ))}
                  </div>
                )}
                {dynamic.video && (
                  <Link
                    href={`/video/${dynamic.video.id}`}
                    className="mt-3 flex gap-3 rounded-xl border border-line p-2 transition hover:border-brand"
                  >
                    <div className="aspect-video w-32 shrink-0 overflow-hidden rounded-lg bg-canvas">
                      {dynamic.video.coverUrl && (
                        <img
                          src={dynamic.video.coverUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="line-clamp-2 text-sm font-medium">{dynamic.video.title}</div>
                      <div className="mt-1 text-xs text-muted">
                        {dynamic.video.uploader.displayName}
                      </div>
                    </div>
                  </Link>
                )}
                <div className="mt-3 flex items-center gap-4 text-xs text-muted">
                  <button
                    type="button"
                    onClick={() => void toggleLike(dynamic)}
                    className={cn(
                      'inline-flex items-center gap-1 hover:text-brand',
                      dynamic.liked && 'text-brand',
                    )}
                  >
                    <Heart className={cn('h-3.5 w-3.5', dynamic.liked && 'fill-current')} />
                    {formatCount(dynamic.likeCount, locale)}
                  </button>
                </div>
              </article>
            ))}
            {!loading && items.length === 0 && (
              <div className="card py-16 text-center text-sm text-muted">{t('还没有动态')}</div>
            )}
            {nextCursor && (
              <button
                type="button"
                onClick={() => void load(nextCursor, true)}
                className="btn-ghost w-full"
              >
                {t('加载更多')}
              </button>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <section className="card p-4">
            <h2 className="mb-3 text-sm font-semibold">{t('热门话题')}</h2>
            <div className="space-y-1">
              {topics.map((topic) => (
                <Link
                  key={topic.id}
                  href={`/topics/${topic.slug}`}
                  className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm hover:bg-canvas"
                >
                  <span className="min-w-0 truncate">#{topic.title}</span>
                  <span className="shrink-0 text-xs text-muted">{topic.dynamicCount ?? 0}</span>
                </Link>
              ))}
              {topics.length === 0 && <p className="text-xs text-muted">{t('还没有话题')}</p>}
            </div>
          </section>
          <section className="card p-4">
            <h2 className="mb-2 text-sm font-semibold">{t('排行榜')}</h2>
            <Link href="/rankings" className="text-sm text-brand hover:underline">
              {t('查看日/周/月排行')} →
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
