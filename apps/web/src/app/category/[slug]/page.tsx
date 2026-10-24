import { SectionHeader } from '@/components/SectionHeader';
import { VideoCard } from '@/components/VideoCard';
import { serverFetchSafe } from '@/lib/server-api';
import type { VideoCard as VideoCardType } from '@uiliuili/shared';
import type { Metadata } from 'next';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  return { title: `${slug} 分区` };
}

export default async function CategoryPage({ params }: PageProps) {
  const { slug } = await params;
  const [data, categories] = await Promise.all([
    serverFetchSafe<{ items: VideoCardType[] }>(
      `/api/v1/videos?category=${encodeURIComponent(slug)}&sort=hot&limit=24`,
      {
        items: [],
      },
    ),
    serverFetchSafe<{ items: Array<{ id: string; slug: string; name: string }> }>(
      '/api/v1/categories',
      { items: [] },
    ),
  ]);
  const current = categories.items.find((item) => item.slug === slug);
  return (
    <div className="container-page py-6">
      <div className="mb-5 flex flex-wrap gap-2">
        {categories.items.map((category) => (
          <Link
            key={category.id}
            href={`/category/${category.slug}`}
            className={category.slug === slug ? 'chip chip-active' : 'chip'}
          >
            {category.name}
          </Link>
        ))}
      </div>
      <SectionHeader title={current?.name ?? '分区'} description="该分区下最受欢迎的视频" />
      {data.items.length > 0 ? (
        <div className="video-grid">
          {data.items.map((video) => (
            <VideoCard key={video.id} video={video} />
          ))}
        </div>
      ) : (
        <div className="card py-16 text-center text-sm text-muted">该分区暂无视频</div>
      )}
    </div>
  );
}
