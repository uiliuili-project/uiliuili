import { formatCount, relativeTime } from '@/lib/format';
import { getLocale, getT } from '@/lib/i18n-server';
import { serverFetch, serverFetchSafe } from '@/lib/server-api';
import type { DynamicItem, TopicInfo } from '@uiliuili/shared';
import { CalendarDays, Hash } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const t = await getT();
  try {
    const topic = await serverFetch<TopicInfo>(`/api/v1/topics/${slug}`);
    return { title: `#${topic.title}`, description: topic.description.slice(0, 160) };
  } catch {
    return { title: t('话题') };
  }
}

export default async function TopicPage({ params }: PageProps) {
  const { slug } = await params;
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  let topic: TopicInfo;
  try {
    topic = await serverFetch<TopicInfo>(`/api/v1/topics/${slug}`);
  } catch {
    return (
      <div className="container-page py-16">
        <div className="card mx-auto max-w-xl p-10 text-center">
          <h1 className="text-xl font-semibold">{t('话题不存在')}</h1>
          <Link href="/topics" className="btn-primary mt-6">
            {t('返回话题列表')}
          </Link>
        </div>
      </div>
    );
  }
  const dynamics = await serverFetchSafe<{ items: DynamicItem[]; nextCursor: string | null }>(
    `/api/v1/dynamics?feed=topic&topicId=${topic.id}&limit=30`,
    { items: [], nextCursor: null },
  );

  return (
    <div className="container-page py-6">
      <div className="card overflow-hidden">
        <div className="relative h-40 bg-gradient-to-r from-brand to-[#ffd9e4]">
          {topic.coverUrl && (
            <img src={topic.coverUrl} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="p-5">
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <Hash className="h-5 w-5 text-brand" />
            {topic.title}
          </h1>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">
            {topic.description}
          </p>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted">
            <span>
              {topic.dynamicCount ?? 0} {t('条讨论')}
            </span>
            {(topic.startsAt || topic.endsAt) && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {topic.startsAt ? new Date(topic.startsAt).toLocaleDateString(locale) : '—'}
                {' — '}
                {topic.endsAt ? new Date(topic.endsAt).toLocaleDateString(locale) : '—'}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto mt-6 max-w-3xl space-y-4">
        {dynamics.items.map((dynamic) => (
          <article key={dynamic.id} className="card p-4">
            <div className="flex items-center gap-3">
              <Link
                href={`/space/${dynamic.user.username}`}
                className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-brand-light text-sm font-semibold text-brand-dark"
              >
                {dynamic.user.avatarUrl ? (
                  <img src={dynamic.user.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  dynamic.user.displayName.slice(0, 1).toUpperCase()
                )}
              </Link>
              <div>
                <div className="text-sm font-medium">{dynamic.user.displayName}</div>
                <div className="text-xs text-muted">{relativeTime(dynamic.createdAt, locale)}</div>
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
            <div className="mt-3 text-xs text-muted">
              {formatCount(dynamic.likeCount, locale)} {t('点赞')}
            </div>
          </article>
        ))}
        {dynamics.items.length === 0 && (
          <div className="card py-16 text-center text-sm text-muted">{t('话题下还没有讨论')}</div>
        )}
      </div>
    </div>
  );
}
