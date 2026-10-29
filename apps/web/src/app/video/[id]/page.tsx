import { AddToCollection } from '@/components/AddToCollection';
import { CommentSection } from '@/components/CommentSection';
import { DanmakuPlayer } from '@/components/DanmakuPlayer';
import { VideoActions } from '@/components/VideoActions';
import { ApiError } from '@/lib/api';
import { formatCount, formatDate, relativeTime } from '@/lib/format';
import { getLocale, getT } from '@/lib/i18n-server';
import { serverFetch, serverFetchSafe } from '@/lib/server-api';
import type { RegionContextInfo, SpaceProfile } from '@/lib/types';
import type { AuthUser, VideoCard, VideoDetail } from '@uiliuili/shared';
import { Calendar, Eye, Layers, MessageSquare, ShieldAlert } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const t = await getT();
  try {
    const video = await serverFetch<VideoDetail>(`/api/v1/videos/${id}`);
    return {
      title: video.title,
      description: video.description.slice(0, 160),
    };
  } catch {
    return { title: t('视频') };
  }
}

export default async function VideoPage({ params }: PageProps) {
  const { id } = await params;
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  let video: VideoDetail;
  try {
    video = await serverFetch<VideoDetail>(`/api/v1/videos/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 451) {
      const [context, session] = await Promise.all([
        serverFetchSafe<RegionContextInfo | null>('/api/v1/region/context', null),
        serverFetchSafe<{ user: AuthUser } | null>('/api/v1/auth/me', null),
      ]);
      return (
        <div className="container-page py-16">
          <div className="card mx-auto max-w-xl p-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h1 className="mt-4 text-xl font-semibold">{t('该内容在当前地区不可用')}</h1>
            <p className="mt-2 text-sm text-muted">{error.message}</p>
            {context?.region.code && (
              <p className="mt-2 text-xs text-muted">
                {t('当前地区：{0}（{1}）', {
                  0: locale === 'en-US' ? context.region.nameEn : context.region.name,
                  1: context.region.code,
                })}
              </p>
            )}
            {!session?.user && (
              <p className="mt-4 rounded-lg bg-canvas px-3 py-2 text-xs text-muted">
                {t('限制级内容需要登录后才能观看。')}
              </p>
            )}
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {!session?.user && (
                <Link href="/login" className="btn-primary">
                  {t('去登录')}
                </Link>
              )}
              <Link href="/" className="btn-ghost">
                {t('返回首页')}
              </Link>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="container-page py-16">
        <div className="card mx-auto max-w-xl p-10 text-center">
          <h1 className="text-xl font-semibold">{t('视频不可用')}</h1>
          <p className="mt-2 text-sm text-muted">
            {error instanceof Error ? t(error.message) : t('视频不存在或暂时无法访问')}
          </p>
          <Link href="/" className="btn-primary mt-6">
            {t('返回首页')}
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
          {t('首页')}
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
              {formatCount(video.views, locale)} {t('播放')}
            </span>
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5" />
              {formatCount(video.danmaku, locale)} {t('弹幕')}
            </span>
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(video.publishedAt ?? video.createdAt, locale)}
            </span>
            {video.featured && (
              <span className="rounded bg-brand-light px-2 py-0.5 text-brand-dark">
                {t('推荐')}
              </span>
            )}
          </div>

          <VideoActions video={video} />
          <div className="mt-3">
            <AddToCollection videoId={video.id} />
          </div>

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
                  <span className="mr-1 rounded bg-brand-light px-1 text-[10px] text-brand-dark">
                    Lv.{video.uploader.level}
                  </span>
                  @{video.uploader.username}
                  {profile ? ` · ${formatCount(profile.stats.followers, locale)} ${t('粉丝')}` : ''}
                </div>
              </div>
            </Link>
            <Link href={`/space/${video.uploader.username}`} className="btn-ghost shrink-0">
              {t('进入空间')}
            </Link>
          </div>

          {video.collections.length > 0 && (
            <div className="mt-4 rounded-xl2 border border-line bg-white p-4">
              <h2 className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <Layers className="h-4 w-4 text-brand" />
                {t('所属合集')}
              </h2>
              <div className="flex flex-wrap gap-2">
                {video.collections.map((collection) => (
                  <Link key={collection.id} href={`/collection/${collection.id}`} className="chip">
                    {collection.title}
                    <span className="ml-1 text-[10px] text-muted">
                      {collection.itemCount} {t('个视频')}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {video.description && (
            <div className="mt-4 rounded-xl2 border border-line bg-white p-4">
              <h2 className="mb-2 text-sm font-semibold">{t('简介')}</h2>
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

          <CommentSection videoId={video.id} uploaderId={video.uploader.id} />
        </div>

        <aside className="min-w-0">
          <section className="card p-4">
            <h2 className="mb-3 text-sm font-semibold">{t('相关推荐')}</h2>
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
                      {formatCount(item.views, locale)} {t('播放')} ·{' '}
                      {relativeTime(item.publishedAt ?? item.createdAt, locale)}
                    </div>
                  </div>
                </Link>
              ))}
              {related.items.length === 0 && (
                <p className="text-sm text-muted">{t('暂无相关推荐')}</p>
              )}
            </div>
          </section>

          <section className="card mt-4 p-4">
            <h2 className="mb-3 text-sm font-semibold">{t('UP 主')}</h2>
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
                    ? `${formatCount(profile.stats.videos, locale)} ${t('投稿')} · ${formatCount(
                        profile.stats.followers,
                        locale,
                      )} ${t('粉丝')}`
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
