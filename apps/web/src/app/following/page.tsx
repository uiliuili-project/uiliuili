import { SectionHeader } from '@/components/SectionHeader';
import { VideoCard } from '@/components/VideoCard';
import { getT } from '@/lib/i18n-server';
import { serverFetchSafe } from '@/lib/server-api';
import type { VideoCard as VideoCardType } from '@uiliuili/shared';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function FollowingPage() {
  const [t, data] = await Promise.all([
    getT(),
    serverFetchSafe<{ items: VideoCardType[]; hasMore?: boolean }>(
      '/api/v1/feed/following?limit=30',
      { items: [] },
    ),
  ]);
  if (data.items.length === 0) {
    return (
      <div className="container-page py-16">
        <div className="card mx-auto max-w-lg p-10 text-center">
          <h1 className="text-xl font-semibold">{t('关注动态')}</h1>
          <p className="mt-2 text-sm text-muted">
            {t('登录并关注喜欢的 UP 主后，他们的新视频会出现在这里。')}
          </p>
          <Link href="/login" className="btn-primary mt-6">
            {t('去登录')}
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="container-page py-6">
      <SectionHeader title={t('关注动态')} description={t('你关注的 UP 主的最新投稿')} />
      <div className="video-grid">
        {data.items.map((video) => (
          <VideoCard key={video.id} video={video} />
        ))}
      </div>
    </div>
  );
}
