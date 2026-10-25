import { getLocale, getT } from '@/lib/i18n-server';
import { serverFetchSafe } from '@/lib/server-api';
import type { TopicInfo } from '@uiliuili/shared';
import { Hash, Sparkles } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('话题') };
}

export default async function TopicsPage() {
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  const data = await serverFetchSafe<{ items: TopicInfo[] }>('/api/v1/topics?limit=50', {
    items: [],
  });
  return (
    <div className="container-page py-6">
      <div className="mb-5 flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-xl font-semibold">
          <Hash className="h-5 w-5 text-brand" />
          {t('话题与活动')}
        </h1>
        <Link href="/dynamics" className="btn-ghost">
          <Sparkles className="h-4 w-4" />
          {t('去发动态')}
        </Link>
      </div>
      {data.items.length === 0 ? (
        <div className="card py-16 text-center text-sm text-muted">{t('还没有话题')}</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((topic) => (
            <Link
              key={topic.id}
              href={`/topics/${topic.slug}`}
              className="card overflow-hidden transition hover:border-brand"
            >
              <div className="aspect-[16/7] bg-gradient-to-br from-brand/80 to-[#ffd9e4]">
                {topic.coverUrl && (
                  <img src={topic.coverUrl} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">#{topic.title}</span>
                  <span className="rounded-full bg-canvas px-2 py-0.5 text-[10px] text-muted">
                    {topic.kind === 'activity' ? t('活动') : t('话题')}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted">{topic.description}</p>
                <p className="mt-2 text-xs text-muted">
                  {topic.dynamicCount ?? 0} {t('条讨论')}
                  {topic.endsAt
                    ? ` · ${t('截止')} ${new Date(topic.endsAt).toLocaleDateString(locale)}`
                    : ''}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
