import { SectionHeader } from '@/components/SectionHeader';
import { VideoCard } from '@/components/VideoCard';
import { formatCount, formatDate, formatDuration } from '@/lib/format';
import { serverFetchSafe } from '@/lib/server-api';
import type { Announcement, HomeFeed } from '@/lib/types';
import { Play, Sparkles, TrendingUp } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const emptyFeed: HomeFeed = {
  sections: {
    recommended: { items: [], nextCursor: null },
    trending: { items: [], nextCursor: null },
    newest: { items: [], nextCursor: null },
    continueWatching: { items: [] },
  },
  categories: [],
  explorationRatio: 0,
};

export default async function HomePage() {
  const [feed, announcements] = await Promise.all([
    serverFetchSafe<HomeFeed>('/api/v1/feed/home', emptyFeed),
    serverFetchSafe<{ items: Announcement[] }>('/api/v1/announcements', { items: [] }),
  ]);
  const hero = feed.sections.recommended.items[0];
  const recommended = feed.sections.recommended.items.slice(hero ? 1 : 0, 8);
  const isEmpty = feed.sections.trending.items.length === 0 && !hero;

  return (
    <div className="container-page py-6">
      {announcements.items.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2 rounded-xl2 border border-brand/20 bg-brand-light/50 px-4 py-3 text-sm text-brand-dark">
          <span className="font-semibold">公告</span>
          <span className="text-ink">{announcements.items[0]?.title}</span>
          <span className="text-muted">{announcements.items[0]?.content}</span>
        </div>
      )}

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Link href="/" className="chip chip-active">
          推荐
        </Link>
        <Link href="/trending" className="chip">
          热门
        </Link>
        {feed.categories.slice(0, 8).map((category) => (
          <Link key={category.id} href={`/category/${category.slug}`} className="chip">
            {category.name}
          </Link>
        ))}
        {feed.categories.length === 0 && (
          <>
            <span className="chip">动画</span>
            <span className="chip">音乐</span>
            <span className="chip">游戏</span>
            <span className="chip">知识</span>
          </>
        )}
      </div>

      {isEmpty ? (
        <div className="card flex min-h-[360px] flex-col items-center justify-center p-10 text-center">
          <Sparkles className="mb-4 h-10 w-10 text-brand" />
          <h1 className="text-2xl font-semibold">欢迎来到 uiliuili</h1>
          <p className="mt-2 max-w-lg text-sm text-muted">
            还没有已发布的视频。完成安装并上传第一支视频后，这里会自动出现推荐内容。
          </p>
          <div className="mt-6 flex gap-3">
            <Link href="/studio" className="btn-primary">
              去投稿
            </Link>
            <a href="/admin/install" className="btn-ghost">
              打开安装器
            </a>
          </div>
        </div>
      ) : (
        <>
          {hero && (
            <section className="mb-8 grid gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
              <Link
                href={`/video/${hero.id}`}
                className="group relative overflow-hidden rounded-2xl bg-black"
              >
                <div className="aspect-[16/9]">
                  {hero.coverUrl ? (
                    <img
                      src={hero.coverUrl}
                      alt={hero.title}
                      className="h-full w-full object-cover opacity-90 transition duration-500 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-br from-slate-700 to-slate-900" />
                  )}
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent p-5 text-white sm:p-7">
                  <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-[11px] font-semibold">
                    <Sparkles className="h-3 w-3" />
                    今日推荐
                  </div>
                  <h1 className="line-clamp-2 text-xl font-semibold sm:text-2xl">{hero.title}</h1>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-white/75">
                    <span>{hero.uploader.displayName}</span>
                    <span className="inline-flex items-center gap-1">
                      <Play className="h-3 w-3" />
                      {formatCount(hero.views)}
                    </span>
                    <span>{formatDuration(hero.durationSeconds)}</span>
                    <span>{formatDate(hero.publishedAt)}</span>
                  </div>
                </div>
              </Link>

              <div className="card p-5">
                <div className="mb-4 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-brand" />
                  <h2 className="text-lg font-semibold">正在流行</h2>
                </div>
                <div className="space-y-3">
                  {feed.sections.trending.items.slice(0, 5).map((video, index) => (
                    <Link
                      key={video.id}
                      href={`/video/${video.id}`}
                      className="flex gap-3 rounded-lg p-1.5 transition hover:bg-canvas"
                    >
                      <span className="w-4 pt-1 text-sm font-semibold text-brand">{index + 1}</span>
                      <div className="relative aspect-video w-28 shrink-0 overflow-hidden rounded-lg bg-canvas">
                        {video.coverUrl && (
                          <img src={video.coverUrl} alt="" className="h-full w-full object-cover" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 text-sm font-medium leading-snug">
                          {video.title}
                        </div>
                        <div className="mt-1 text-xs text-muted">
                          {video.uploader.displayName} · {formatCount(video.views)} 播放
                        </div>
                      </div>
                    </Link>
                  ))}
                  {feed.sections.trending.items.length === 0 && (
                    <p className="text-sm text-muted">暂无热门内容</p>
                  )}
                </div>
              </div>
            </section>
          )}

          {feed.sections.continueWatching.items.length > 0 && (
            <section className="mb-9">
              <SectionHeader title="继续观看" description="接着上次的进度继续" href="/history" />
              <div className="video-grid">
                {feed.sections.continueWatching.items.map((video) => (
                  <VideoCard key={video.id} video={video} />
                ))}
              </div>
            </section>
          )}

          {recommended.length > 0 && (
            <section className="mb-9">
              <SectionHeader title="为你推荐" description="根据你的观看与互动生成" />
              <div className="video-grid">
                {recommended.map((video) => (
                  <VideoCard key={video.id} video={video} />
                ))}
              </div>
            </section>
          )}

          <section className="mb-9">
            <SectionHeader title="最新投稿" href="/trending" />
            <div className="video-grid">
              {feed.sections.newest.items.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
