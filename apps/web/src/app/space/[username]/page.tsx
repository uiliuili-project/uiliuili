import { BlockButton } from '@/components/BlockButton';
import { FollowButton } from '@/components/FollowButton';
import { VideoCard } from '@/components/VideoCard';
import { formatCount, formatDate, relativeTime } from '@/lib/format';
import { getLocale, getT } from '@/lib/i18n-server';
import { serverFetch, serverFetchSafe } from '@/lib/server-api';
import type { FavoritesResponse, SpaceProfile } from '@/lib/types';
import { regionLabel } from '@uiliuili/shared';
import type { CollectionInfo, DynamicItem, VideoCard as VideoCardType } from '@uiliuili/shared';
import { Award, CalendarDays, Heart, Layers, MapPin, MessageSquare, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string; folder?: string }>;
}

const TABS = [
  { key: 'videos', label: '投稿' },
  { key: 'collections', label: '合集' },
  { key: 'favorites', label: '收藏' },
  { key: 'dynamics', label: '动态' },
  { key: 'about', label: '关于' },
] as const;

type Tab = (typeof TABS)[number]['key'];

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  const t = await getT();
  const profile = await serverFetchSafe<SpaceProfile | null>(`/api/v1/users/${username}`, null);
  return { title: profile ? `${profile.user.displayName}${t('的空间')}` : t('个人空间') };
}

export default async function SpacePage({ params, searchParams }: PageProps) {
  const { username } = await params;
  const { tab: rawTab, folder } = await searchParams;
  const tab: Tab = TABS.some((item) => item.key === rawTab) ? (rawTab as Tab) : 'videos';
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  let profile: SpaceProfile;
  try {
    profile = await serverFetch<SpaceProfile>(`/api/v1/users/${username}`);
  } catch {
    return (
      <div className="container-page py-16 text-center">
        <h1 className="text-xl font-semibold">{t('用户不存在')}</h1>
        <Link href="/" className="btn-primary mt-6">
          {t('返回首页')}
        </Link>
      </div>
    );
  }

  const videos = await serverFetchSafe<{ items: VideoCardType[] }>(
    `/api/v1/users/${username}/videos?limit=24&sort=new`,
    { items: [] },
  );
  const collections = await serverFetchSafe<{ items: CollectionInfo[] }>(
    `/api/v1/users/${username}/collections`,
    { items: [] },
  );
  const dynamics = await serverFetchSafe<{ items: DynamicItem[] }>(
    `/api/v1/dynamics?feed=user&username=${encodeURIComponent(username)}&limit=20`,
    { items: [] },
  );
  const favorites = await serverFetchSafe<FavoritesResponse>(
    `/api/v1/users/${username}/favorites${folder ? `?folderId=${encodeURIComponent(folder)}` : ''}`,
    { folders: [], folderId: null, items: [] },
  );

  return (
    <div className="container-page py-6">
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
        <div className="relative h-44 bg-gradient-to-r from-brand via-[#ff9db5] to-[#ffd9e4] sm:h-56">
          {profile.user.coverUrl && (
            <img src={profile.user.coverUrl} alt="" className="h-full w-full object-cover" />
          )}
          {profile.isSelf && (
            <Link
              href="/settings"
              className="absolute right-3 top-3 rounded-full bg-black/45 px-3 py-1.5 text-xs text-white backdrop-blur transition hover:bg-black/60"
            >
              {t('更换头图')}
            </Link>
          )}
        </div>
        <div className="px-5 pb-6 sm:px-8">
          <div className="relative z-10 -mt-10 flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-brand-light text-2xl font-semibold text-brand-dark shadow-card">
                {profile.user.avatarUrl ? (
                  <img src={profile.user.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  profile.user.displayName.slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="pb-1">
                <h1 className="flex items-center gap-2 text-xl font-semibold">
                  {profile.user.displayName}
                  <span className="rounded bg-brand-light px-1.5 py-0.5 text-[11px] font-medium text-brand-dark">
                    Lv.{profile.user.level}
                  </span>
                </h1>
                <p className="mt-0.5 text-sm text-muted">@{profile.user.username}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 pb-1">
              {profile.isSelf && (
                <Link href="/settings" className="btn-ghost h-9 rounded-full">
                  {t('编辑资料')}
                </Link>
              )}
              <FollowButton
                userId={profile.user.id}
                initialFollowing={profile.following}
                isSelf={profile.isSelf}
              />
              <BlockButton
                userId={profile.user.id}
                initialBlocked={Boolean(profile.blocked)}
                isSelf={profile.isSelf}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-5 text-sm">
            <span className="inline-flex items-center gap-1.5 text-muted">
              <Users className="h-4 w-4" />
              <strong className="text-ink">{formatCount(profile.stats.followers, locale)}</strong>{' '}
              {t('粉丝')}
            </span>
            <span className="text-muted">
              <strong className="text-ink">{formatCount(profile.stats.following, locale)}</strong>{' '}
              {t('关注')}
            </span>
            <span className="text-muted">
              <strong className="text-ink">{formatCount(profile.stats.videos, locale)}</strong>{' '}
              {t('投稿')}
            </span>
            <span className="inline-flex items-center gap-1.5 text-muted">
              <CalendarDays className="h-4 w-4" />
              {t('common.joinDate', { date: formatDate(profile.user.createdAt, locale) })}
            </span>
            {profile.user.lastRegion && (
              <span className="inline-flex items-center gap-1.5 text-muted">
                <MapPin className="h-4 w-4" />
                {t('IP 属地：{0}', { 0: regionLabel(profile.user.lastRegion, locale) })}
              </span>
            )}
          </div>
          {profile.user.bio && (
            <p className="mt-3 text-sm leading-6 text-muted">{profile.user.bio}</p>
          )}
          {profile.user.badges && profile.user.badges.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {profile.user.badges.map((badge) => (
                <span
                  key={badge.code}
                  title={badge.description}
                  className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[11px] text-muted"
                >
                  <Award className="h-3 w-3 text-brand" />
                  {badge.label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-7">
        <div className="mb-5 flex flex-wrap items-center gap-1 border-b border-line pb-2">
          {TABS.map((item) => (
            <Link
              key={item.key}
              href={`/space/${username}?tab=${item.key}`}
              className={
                tab === item.key
                  ? 'border-b-2 border-brand px-3 pb-2 text-sm font-medium text-brand'
                  : 'px-3 pb-2 text-sm text-muted hover:text-ink'
              }
            >
              {t(item.label)}
            </Link>
          ))}
        </div>

        {tab === 'videos' &&
          (videos.items.length > 0 ? (
            <div className="video-grid">
              {videos.items.map((video) => (
                <VideoCard key={video.id} video={video} />
              ))}
            </div>
          ) : (
            <div className="card py-16 text-center text-sm text-muted">{t('还没有公开投稿')}</div>
          ))}

        {tab === 'collections' && (
          <div>
            {collections.items.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {collections.items.map((collection) => (
                  <Link
                    key={collection.id}
                    href={`/collection/${collection.id}`}
                    className="card overflow-hidden transition hover:border-brand"
                  >
                    <div className="aspect-video bg-canvas">
                      {collection.coverUrl ? (
                        <img
                          src={collection.coverUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-muted">
                          <Layers className="h-8 w-8" />
                        </div>
                      )}
                    </div>
                    <div className="p-3">
                      <div className="line-clamp-1 text-sm font-medium">{collection.title}</div>
                      <div className="mt-1 text-xs text-muted">
                        {collection.kind === 'series' ? t('系列') : t('合集')} ·{' '}
                        {collection.itemCount} {t('个视频')}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="card py-16 text-center text-sm text-muted">{t('还没有公开合集')}</div>
            )}
          </div>
        )}

        {tab === 'favorites' && (
          <div>
            {favorites.folders.length > 0 && (
              <div className="mb-4 flex flex-wrap gap-2">
                {favorites.folders.map((item) => (
                  <Link
                    key={item.id}
                    href={`/space/${username}?tab=favorites&folder=${item.id}`}
                    className={favorites.folderId === item.id ? 'chip chip-active' : 'chip'}
                  >
                    {item.name}
                    <span className="ml-1 opacity-70">{item.count}</span>
                  </Link>
                ))}
              </div>
            )}
            {favorites.items.length > 0 ? (
              <div className="video-grid">
                {favorites.items.map((video) => (
                  <VideoCard key={video.id} video={video} />
                ))}
              </div>
            ) : (
              <div className="card py-16 text-center text-sm text-muted">{t('还没有公开收藏')}</div>
            )}
          </div>
        )}

        {tab === 'dynamics' && (
          <div className="mx-auto max-w-3xl space-y-4">
            {dynamics.items.map((dynamic) => (
              <article key={dynamic.id} className="card p-4">
                <div className="flex items-center gap-3">
                  <Link
                    href={`/space/${dynamic.user.username}`}
                    className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-brand-light text-sm font-semibold text-brand-dark"
                  >
                    {dynamic.user.avatarUrl ? (
                      <img
                        src={dynamic.user.avatarUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      dynamic.user.displayName.slice(0, 1).toUpperCase()
                    )}
                  </Link>
                  <div>
                    <div className="text-sm font-medium">{dynamic.user.displayName}</div>
                    <div className="text-xs text-muted">
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
                    </div>
                  </div>
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
                    <div className="aspect-video w-28 shrink-0 overflow-hidden rounded-lg bg-canvas">
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
                  <span className="inline-flex items-center gap-1">
                    <Heart className="h-3.5 w-3.5" />
                    {formatCount(dynamic.likeCount, locale)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5" />0
                  </span>
                </div>
              </article>
            ))}
            {dynamics.items.length === 0 && (
              <div className="card py-16 text-center text-sm text-muted">{t('还没有动态')}</div>
            )}
          </div>
        )}

        {tab === 'about' && (
          <div className="card max-w-2xl p-6">
            <h2 className="mb-3 text-base font-semibold">{t('关于')}</h2>
            <p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted">
              {profile.user.bio || t('这个人很神秘，什么都没有写')}
            </p>
            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted">{t('加入时间')}</dt>
                <dd className="mt-1 text-sm">{formatDate(profile.user.createdAt, locale)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">{t('等级')}</dt>
                <dd className="mt-1 text-sm">
                  Lv.{profile.user.level}
                  {typeof profile.user.experience === 'number' && (
                    <span className="ml-2 text-xs text-muted">
                      {profile.user.experience} {t('经验')}
                    </span>
                  )}
                </dd>
              </div>
            </dl>
            {profile.user.badges && profile.user.badges.length > 0 && (
              <>
                <h3 className="mt-6 text-sm font-semibold">{t('勋章')}</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {profile.user.badges.map((badge) => (
                    <span
                      key={badge.code}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs"
                    >
                      <Award className="h-3.5 w-3.5 text-brand" />
                      <span className="font-medium">{badge.label}</span>
                      <span className="text-muted">{badge.description}</span>
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
