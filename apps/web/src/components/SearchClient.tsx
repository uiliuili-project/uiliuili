'use client';

import { VideoCard as VideoCardView } from '@/components/VideoCard';
import { api } from '@/lib/api';
import { cn } from '@/lib/cn';
import { formatCount, relativeTime } from '@/lib/format';
import type { Category, PublicUser, VideoCard } from '@uiliuili/shared';
import { Search, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

type SearchType = 'videos' | 'users' | 'tags';

interface SearchResponse {
  type: SearchType;
  items: unknown[];
  nextCursor?: string | null;
  engine?: string;
}

interface TagResult {
  name: string;
  slug: string;
  count: number;
}

export function SearchClient() {
  const router = useRouter();
  const params = useSearchParams();
  const initialQuery = params.get('q') ?? '';
  const [query, setQuery] = useState(initialQuery);
  const [type, setType] = useState<SearchType>('videos');
  const [sort, setSort] = useState<'hot' | 'new'>('hot');
  const [category, setCategory] = useState('');
  const [duration, setDuration] = useState('');
  const [date, setDate] = useState('');
  const [response, setResponse] = useState<SearchResponse | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [hot, setHot] = useState<Array<{ query: string; count: number }>>([]);
  const [history, setHistory] = useState<Array<{ query: string; createdAt: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    void api
      .get<{ items: Category[] }>('/api/v1/categories')
      .then((data) => setCategories(data.items))
      .catch(() => undefined);
    void api
      .get<{ items: Array<{ query: string; count: number }> }>('/api/v1/search/hot')
      .then((data) => setHot(data.items))
      .catch(() => undefined);
    void api
      .get<{ items: Array<{ query: string; createdAt: string }> }>('/api/v1/search/history')
      .then((data) => setHistory(data.items))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setQuery(initialQuery);
    if (initialQuery.trim()) void runSearch(initialQuery, type, true);
  }, [initialQuery]);

  const buildUrl = (value: string, nextType = type) => {
    const search = new URLSearchParams();
    search.set('q', value);
    search.set('type', nextType);
    if (nextType === 'videos') {
      search.set('sort', sort);
      if (category) search.set('category', category);
      if (duration) search.set('duration', duration);
      if (date) search.set('date', date);
    }
    return `/api/v1/search?${search.toString()}`;
  };

  const runSearch = async (value: string, nextType = type, replaceUrl = false) => {
    const trimmed = value.trim();
    if (!trimmed) {
      setResponse(null);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await api.get<SearchResponse>(buildUrl(trimmed, nextType));
      setResponse(data);
      if (replaceUrl) router.replace(`/search?q=${encodeURIComponent(trimmed)}`);
      void api
        .get<{ items: Array<{ query: string; createdAt: string }> }>('/api/v1/search/history')
        .then((result) => setHistory(result.items))
        .catch(() => undefined);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : '搜索失败');
    } finally {
      setLoading(false);
    }
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    void runSearch(query, type, true);
  };

  const switchType = (nextType: SearchType) => {
    setType(nextType);
    if (query.trim()) void runSearch(query, nextType);
  };

  const applyFilter = (next: {
    sort?: typeof sort;
    category?: string;
    duration?: string;
    date?: string;
  }) => {
    if (next.sort !== undefined) setSort(next.sort);
    if (next.category !== undefined) setCategory(next.category);
    if (next.duration !== undefined) setDuration(next.duration);
    if (next.date !== undefined) setDate(next.date);
    const search = new URLSearchParams();
    search.set('q', query);
    search.set('type', 'videos');
    search.set('sort', next.sort ?? sort);
    const nextCategory = next.category ?? category;
    const nextDuration = next.duration ?? duration;
    const nextDate = next.date ?? date;
    if (nextCategory) search.set('category', nextCategory);
    if (nextDuration) search.set('duration', nextDuration);
    if (nextDate) search.set('date', nextDate);
    setLoading(true);
    void api
      .get<SearchResponse>(`/api/v1/search?${search.toString()}`)
      .then(setResponse)
      .catch(() => setError('搜索失败'))
      .finally(() => setLoading(false));
  };

  const clearHistory = async () => {
    await api.delete('/api/v1/search/history').catch(() => undefined);
    setHistory([]);
  };

  const videos = (response?.items ?? []) as VideoCard[];
  const users = (response?.items ?? []) as PublicUser[];
  const tags = (response?.items ?? []) as TagResult[];

  return (
    <div className="container-page py-6">
      <form onSubmit={submit} className="card flex items-center gap-2 p-2">
        <Search className="ml-2 h-5 w-5 text-muted" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索视频、用户或标签"
          className="min-w-0 flex-1 bg-transparent px-1 text-sm outline-none"
          autoFocus
        />
        <button type="submit" className="btn-primary">
          搜索
        </button>
      </form>

      <div className="mt-5 flex items-center gap-2 border-b border-line">
        {(
          [
            ['videos', '视频'],
            ['users', '用户'],
            ['tags', '标签'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => switchType(value)}
            className={cn(
              'border-b-2 px-4 py-2 text-sm font-medium transition',
              type === value
                ? 'border-brand text-brand'
                : 'border-transparent text-muted hover:text-ink',
            )}
          >
            {label}
          </button>
        ))}
        {response?.engine && (
          <span className="ml-auto text-xs text-muted">搜索：{response.engine}</span>
        )}
      </div>

      {type === 'videos' && query.trim() && (
        <div className="mt-4 flex flex-wrap gap-2">
          <select
            value={sort}
            onChange={(event) => applyFilter({ sort: event.target.value as 'hot' | 'new' })}
            className="chip bg-white"
          >
            <option value="hot">最热</option>
            <option value="new">最新</option>
          </select>
          <select
            value={category}
            onChange={(event) => applyFilter({ category: event.target.value })}
            className="chip bg-white"
          >
            <option value="">全部分区</option>
            {categories.map((item) => (
              <option key={item.id} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            value={duration}
            onChange={(event) => applyFilter({ duration: event.target.value })}
            className="chip bg-white"
          >
            <option value="">全部时长</option>
            <option value="short">1 分钟以下</option>
            <option value="medium">1–10 分钟</option>
            <option value="long">10 分钟以上</option>
          </select>
          <select
            value={date}
            onChange={(event) => applyFilter({ date: event.target.value })}
            className="chip bg-white"
          >
            <option value="">全部时间</option>
            <option value="week">最近一周</option>
            <option value="month">最近一月</option>
            <option value="year">最近一年</option>
          </select>
        </div>
      )}

      {error && <p className="mt-6 text-sm text-red-500">{error}</p>}

      {!query.trim() && (
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <section className="card p-5">
            <h2 className="mb-3 text-sm font-semibold">热门搜索</h2>
            <div className="flex flex-wrap gap-2">
              {hot.map((item, index) => (
                <button
                  key={item.query}
                  type="button"
                  onClick={() => {
                    setQuery(item.query);
                    void runSearch(item.query, 'videos', true);
                  }}
                  className="chip"
                >
                  {index + 1}. {item.query} <span className="text-muted">{item.count}</span>
                </button>
              ))}
              {hot.length === 0 && <p className="text-sm text-muted">暂无热门搜索</p>}
            </div>
          </section>
          <section className="card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold">搜索历史</h2>
              <button
                type="button"
                onClick={() => void clearHistory()}
                className="inline-flex items-center gap-1 text-xs text-muted hover:text-red-500"
              >
                <Trash2 className="h-3.5 w-3.5" />
                清空
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {history.map((item) => (
                <button
                  key={item.query}
                  type="button"
                  onClick={() => {
                    setQuery(item.query);
                    void runSearch(item.query, 'videos', true);
                  }}
                  className="chip"
                >
                  {item.query}
                </button>
              ))}
              {history.length === 0 && <p className="text-sm text-muted">暂无搜索历史</p>}
            </div>
          </section>
        </div>
      )}

      {loading && <p className="mt-8 text-sm text-muted">搜索中…</p>}

      {!loading && response && (
        <div className="mt-6">
          {videos.length > 0 && type === 'videos' && (
            <div className="video-grid">
              {videos.map((video) => (
                <VideoCardView key={video.id} video={video} />
              ))}
            </div>
          )}
          {users.length > 0 && type === 'users' && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {users.map((user) => (
                <Link
                  key={user.id}
                  href={`/space/${user.username}`}
                  className="card flex items-center gap-3 p-4 hover:border-brand"
                >
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-brand-light font-semibold text-brand-dark">
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      user.displayName.slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium">{user.displayName}</div>
                    <div className="truncate text-xs text-muted">@{user.username}</div>
                    <div className="truncate text-xs text-muted">{user.bio || '这个人很懒…'}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {tags.length > 0 && type === 'tags' && (
            <div className="flex flex-wrap gap-3">
              {tags.map((tag) => (
                <button
                  key={tag.slug}
                  type="button"
                  onClick={() => {
                    setQuery(tag.name);
                    void runSearch(tag.name, 'videos', true);
                  }}
                  className="card px-4 py-3 text-sm hover:border-brand"
                >
                  #{tag.name}{' '}
                  <span className="ml-2 text-xs text-muted">{formatCount(tag.count)}</span>
                </button>
              ))}
            </div>
          )}
          {response.items.length === 0 && (
            <div className="card py-16 text-center text-sm text-muted">没有找到相关内容</div>
          )}
          {response.engine === 'postgres' && type === 'videos' && (
            <p className="mt-4 text-xs text-muted">
              当前未启用 Meilisearch，使用 PostgreSQL 模糊搜索。
            </p>
          )}
          {history[0] && (
            <p className="mt-4 text-xs text-muted">
              最近搜索：{history[0].query} · {relativeTime(history[0].createdAt)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
