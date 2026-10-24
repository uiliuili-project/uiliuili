import { SectionHeader } from '@/components/SectionHeader';
import { VideoCard } from '@/components/VideoCard';
import { serverFetchSafe } from '@/lib/server-api';
import type { VideoCard as VideoCardType } from '@uiliuili/shared';

export const dynamic = 'force-dynamic';

export default async function TrendingPage() {
  const data = await serverFetchSafe<{ items: VideoCardType[] }>('/api/v1/feed/popular', {
    items: [],
  });
  return (
    <div className="container-page py-6">
      <SectionHeader title="热门" description="近期最受欢迎的视频" />
      {data.items.length > 0 ? (
        <div className="video-grid">
          {data.items.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      ) : (
        <div className="card py-16 text-center text-sm text-muted">暂无热门视频</div>
      )}
    </div>
  );
}
