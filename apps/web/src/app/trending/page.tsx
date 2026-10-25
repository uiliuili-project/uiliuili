import { SectionHeader } from '@/components/SectionHeader';
import { VideoCard } from '@/components/VideoCard';
import { getT } from '@/lib/i18n-server';
import { serverFetchSafe } from '@/lib/server-api';
import type { VideoCard as VideoCardType } from '@uiliuili/shared';

export const dynamic = 'force-dynamic';

export default async function TrendingPage() {
  const [t, data] = await Promise.all([
    getT(),
    serverFetchSafe<{ items: VideoCardType[] }>('/api/v1/feed/popular', {
      items: [],
    }),
  ]);
  return (
    <div className="container-page py-6">
      <SectionHeader title={t('热门')} description={t('近期最受欢迎的视频')} />
      {data.items.length > 0 ? (
        <div className="video-grid">
          {data.items.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      ) : (
        <div className="card py-16 text-center text-sm text-muted">{t('暂无热门视频')}</div>
      )}
    </div>
  );
}
