import { CommentSection } from '@/components/CommentSection';
import { DanmakuPlayer } from '@/components/DanmakuPlayer';
import { VideoActions } from '@/components/VideoActions';
import { formatCount, formatDate, relativeTime } from '@/lib/format';
import { serverFetch, serverFetchSafe } from '@/lib/server-api';
import type { SpaceProfile } from '@/lib/types';
import type { VideoCard, VideoDetail } from '@uiliuili/shared';
import { Calendar, Eye, MessageSquare } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  try {
    const video = await serverFetch<VideoDetail>(`/api/v1/videos/${id}`);
    return {
      title: video.title,
      description: video.description.slice(0, 160),
    };
  } catch {
    return { title: '视频' };
  }
}

export default async function VideoPage({ params }: PageProps) {
  const { id } = await params;
  let video: VideoDetail;
  try {
    video = await serverFetch<VideoDetail>(`/api/v1/videos/${id}`);
  } catch (error) {
    return (
      <div className="container-page py-16">
        <div className="card mx-auto max-w-xl p-10 text-center">
          <h1 className="text-xl font-semibold">视频不可用</h1>
          <p className="mt-2 text-sm text-muted">
            {error instanceof Error ? error.message : '视频不存在或暂时无法访问'}
          </p>
          <Link href="/" className="btn-primary mt-6">
            返回首页
          </Link>
        </div>
      </div>
    );
  }

  const [related, profile] = await Promise.all([
    serverFetchSafe<{ items: VideoCard[] }>(`/api/v1/videos/${id}/related`, { items: [] }),
    serverFetchSafe<SpaceProfile | null>(`/api/v1/users/${video.uploader.username}`, null),
  ]);

  return (
    <div className="container-page py-5">
      <nav className="mb-3 flex items-center gap-2 text-xs text-muted">
        <Link href="/" className="hover:text-brand">
          首页
        </Link>
        <span>/</span>
        {video.category && (
          <>
            <Link href={`/category/${video.category.slug}`} className="hover:text-brand">
              {video.category.name}
            </Link>
            <span>/</span>
          </>
        )}
        <span className="truncate">{video.title}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <DanmakuPlayer video={video} />

          <h1 className="mt-4 text-xl font-semibold leading-snug sm:text-2xl">{video.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" />
              {formatCount(video.views)} 播放
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" />
              {formatCount(video.danmaku)} 弹幕
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(video.publishedAt ?? video.createdAt)}
            </span>
            {video.featured && (
              <span className="rounded bg-brand-light px-2 py-0.5 text-brand-dark">推荐</span>
            )}
          </div>

          <VideoActions video={video} />

          <div className="mt-5 flex items-center justify-between gap-4 rounded-xl2 border border-line bg-white p-4">
            <Link
              href={`/space/${video.uploader.username}`}
              className="flex min-w-0 items-center gap-3"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-light text-sm font-semibold text-brand-dark">
                {video.uploader.avatarUrl ? (
                  <img
                    src={video.uploader.avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  video.uploader.displayName.slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{video.uploader.displayName}</div>
                <div className="truncate text-xs text-muted">
                  @{video.uploader.username}
                  {profile ? ` · ${formatCount(profile.stats.followers)} 粉丝` : ''}
                </div>
              </div>
            </Link>
            <Link href={`/space/${video.uploader.username}`} className="btn-ghost shrink-0">
              进入空间
            </Link>
          </div>

          {video.description && (
            <div className="mt-4 rounded-xl2 border border-line bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold">简介</h2>
              <p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted">
                {video.description}
              </p>
            </div>
          )}

          {video.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {video.tags.map((tag) => (
                <Link key={tag} href={`/search?q=${encodeURIComponent(tag)}`} className="chip">
                  #{tag}
                </Link>
              ))}
            </div>
          )}

          <CommentSection videoId={video.id} />
        </div>

        <aside className="min-w-0">
          <section className="card p-4">
            <h2 className="mb-3 text-sm font-semibold">相关推荐</h2>
            <div className="space-y-3">
              {related.items.map((item) => (
                <Link
                  key={item.id}
                  href={`/video/${item.id}`}
                  className="group flex gap-3 rounded-lg p-1 transition hover:bg-canvas"
                >
                  <div className="relative aspect-video w-32 shrink-0 overflow-hidden rounded-lg bg-canvas">
                    {item.coverUrl && (
                      <img src={item.coverUrl} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="line-clamp-2 text-sm font-medium leading-snug group-hover:text-brand">
                      {item.title}
                    </div>
                    <div className="mt-1 text-xs text-muted">{item.uploader.displayName}</div>
                    <div className="mt-0.5 text-xs text-muted">
                      {formatCount(item.views)} 播放 ·{' '}
                      {relativeTime(item.publishedAt ?? item.createdAt)}
                    </div>
                  </div>
                </Link>
              ))}
              {related.items.length === 0 && <p className="text-sm text-muted">暂无相关推荐</p>}
            </div>
          </section>

          <section className="card mt-4 p-4">
            <h2 className="mb-3 text-sm font-semibold">UP 主</h2>
            <Link
              href={`/space/${video.uploader.username}`}
              className="flex items-center gap-3 rounded-lg p-1 hover:bg-canvas"
            >
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-brand-light text-sm font-semibold text-brand-dark">
                {video.uploader.avatarUrl ? (
                  <img
                    src={video.uploader.avatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  video.uploader.displayName.slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{video.uploader.displayName}</div>
                <div className="text-xs text-muted">
                  {profile
                    ? `${formatCount(profile.stats.videos)} 投稿 · ${formatCount(profile.stats.followers)} 粉丝`
                    : `Lv.${video.uploader.level}`}
                </div>
              </div>
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}
