import { VideoCard } from '@/components/VideoCard';
import { formatDate } from '@/lib/format';
import { getLocale, getT } from '@/lib/i18n-server';
import { serverFetch } from '@/lib/server-api';
import type { CollectionDetail } from '@uiliuili/shared';
import { CalendarDays, Layers, ListVideo, User } from 'lucide-react';
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
    const collection = await serverFetch<CollectionDetail>(`/api/v1/collections/${id}`);
    return { title: collection.title, description: collection.description.slice(0, 160) };
  } catch {
    return { title: t('合集') };
  }
}

export default async function CollectionPage({ params }: PageProps) {
  const { id } = await params;
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  let collection: CollectionDetail;
  try {
    collection = await serverFetch<CollectionDetail>(`/api/v1/collections/${id}`);
  } catch {
    return (
      <div className="container-page py-16">
        <div className="card mx-auto max-w-xl p-10 text-center">
          <h1 className="text-xl font-semibold">{t('合集不存在或不可见')}</h1>
          <Link href="/" className="btn-primary mt-6">
            {t('返回首页')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-page py-6">
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
        <div className="grid gap-5 p-5 sm:grid-cols-[220px_minmax(0,1fr)] sm:p-6">
          <div className="relative aspect-video overflow-hidden rounded-xl bg-canvas sm:aspect-[4/3]">
            {collection.coverUrl ? (
              <img src={collection.coverUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-muted">
                <Layers className="h-10 w-10" />
              </div>
            )}
          </div>
          <div className="min-w-0">
            <span className="rounded-full bg-brand-light px-2.5 py-1 text-xs font-medium text-brand-dark">
              {collection.kind === 'series' ? t('系列') : t('合集')}
            </span>
            <h1 className="mt-3 text-xl font-semibold sm:text-2xl">{collection.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted">
              <span className="inline-flex items-center gap-1">
                <ListVideo className="h-3.5 w-3.5" />
                {collection.itemCount} {t('个视频')}
              </span>
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDate(collection.createdAt, locale)}
              </span>
              <span className="inline-flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                <Link href={`/space/${collection.owner.username}`} className="hover:text-brand">
                  {collection.owner.displayName}
                </Link>
              </span>
            </div>
            {collection.description && (
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-muted">
                {collection.description}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h2 className="mb-3 text-base font-semibold">{t('合集内容')}</h2>
        {collection.items.length > 0 ? (
          <div className="video-grid">
            {collection.items.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        ) : (
          <div className="card py-16 text-center text-sm text-muted">{t('合集里还没有视频')}</div>
        )}
      </div>
    </div>
  );
}
