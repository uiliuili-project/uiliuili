import { FollowButton } from '@/components/FollowButton';
import { VideoCard } from '@/components/VideoCard';
import { formatCount, formatDate } from '@/lib/format';
import { serverFetch, serverFetchSafe } from '@/lib/server-api';
import type { SpaceProfile } from '@/lib/types';
import type { VideoCard as VideoCardType } from '@uiliuili/shared';
import { CalendarDays, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { username } = await params;
  const profile = await serverFetchSafe<SpaceProfile | null>(`/api/v1/users/${username}`, null);
  return { title: profile ? `${profile.user.displayName} 的空间` : '个人空间' };
}

export default async function SpacePage({ params }: PageProps) {
  const { username } = await params;
  let profile: SpaceProfile;
  try {
    profile = await serverFetch<SpaceProfile>(`/api/v1/users/${username}`);
  } catch {
    return (
      <div className="container-page py-16 text-center">
        <h1 className="text-xl font-semibold">用户不存在</h1>
        <Link href="/" className="btn-primary mt-6">
          返回首页
        </Link>
      </div>
    );
  }
  const videos = await serverFetchSafe<{ items: VideoCardType[] }>(
    `/api/v1/users/${username}/videos?limit=24&sort=new`,
    { items: [] },
  );

  return (
    <div className="container-page py-6">
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
        <div className="relative h-36 bg-gradient-to-r from-brand via-[#ff9db5] to-[#ffd9e4]">
          {profile.user.coverUrl && (
            <img src={profile.user.coverUrl} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="px-5 pb-6 sm:px-8">
          <div className="-mt-10 flex flex-wrap items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full border-4 border-white bg-brand-light text-2xl font-semibold text-brand-dark shadow-card">
                {profile.user.avatarUrl ? (
                  <img src={profile.user.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  profile.user.displayName.slice(0, 1).toUpperCase()
                )}
              </div>
              <div className="pb-1">
                <h1 className="text-xl font-semibold">{profile.user.displayName}</h1>
                <p className="mt-0.5 text-sm text-muted">@{profile.user.username}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 pb-1">
              {profile.isSelf && (
                <Link href="/settings" className="btn-ghost h-9 rounded-full">
                  编辑资料
                </Link>
              )}
              <FollowButton
                userId={profile.user.id}
                initialFollowing={profile.following}
                isSelf={profile.isSelf}
              />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-5 text-sm">
            <span className="inline-flex items-center gap-1.5 text-muted">
              <Users className="h-4 w-4" />
              <strong className="text-ink">{formatCount(profile.stats.followers)}</strong> 粉丝
            </span>
            <span className="text-muted">
              <strong className="text-ink">{formatCount(profile.stats.following)}</strong> 关注
            </span>
            <span className="text-muted">
              <strong className="text-ink">{formatCount(profile.stats.videos)}</strong> 投稿
            </span>
            <span className="inline-flex items-center gap-1.5 text-muted">
              <CalendarDays className="h-4 w-4" />
              加入于 {formatDate(profile.user.createdAt)}
            </span>
          </div>
          {profile.user.bio && (
            <p className="mt-3 text-sm leading-6 text-muted">{profile.user.bio}</p>
          )}
        </div>
      </div>

      <div className="mt-7">
        <div className="mb-4 flex items-center gap-4 border-b border-line pb-2">
          <span className="border-b-2 border-brand px-2 pb-2 text-sm font-medium text-brand">
            投稿
          </span>
        </div>
        {videos.items.length > 0 ? (
          <div className="video-grid">
            {videos.items.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        ) : (
          <div className="card py-16 text-center text-sm text-muted">还没有公开投稿</div>
        )}
      </div>
    </div>
  );
}
