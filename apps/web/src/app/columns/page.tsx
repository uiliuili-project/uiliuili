import { formatCount, formatDate } from '@/lib/format';
import { getLocale, getT } from '@/lib/i18n-server';
import { serverFetchSafe } from '@/lib/server-api';
import { BookOpen, Eye } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t('专栏') };
}

interface ArticleCard {
  id: string;
  title: string;
  summary: string;
  coverUrl: string | null;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  publishedAt: string | null;
  createdAt: string;
  author: { username: string; displayName: string; avatarUrl: string | null };
  category: { id: string; name: string; slug: string } | null;
}

export default async function ColumnsPage() {
  const [t, locale, data] = await Promise.all([
    getT(),
    getLocale(),
    serverFetchSafe<{ items: ArticleCard[] }>('/api/v1/articles?limit=30', { items: [] }),
  ]);

  return (
    <div className="container-page py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold">
            <BookOpen className="h-5 w-5 text-brand" />
            {t('专栏')}
          </h1>
          <p className="mt-1 text-sm text-muted">{t('创作者的长文与笔记')}</p>
        </div>
        <Link href="/studio/columns/new" className="btn-soft">
          {t('写专栏')}
        </Link>
      </div>

      {data.items.length === 0 ? (
        <div className="card p-12 text-center text-sm text-muted">{t('还没有专栏文章')}</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.items.map((article) => (
            <Link
              key={article.id}
              href={`/columns/${article.id}`}
              className="card group overflow-hidden transition hover:-translate-y-0.5 hover:shadow-float"
            >
              <div className="aspect-[16/9] overflow-hidden bg-canvas">
                {article.coverUrl ? (
                  <img
                    src={article.coverUrl}
                    alt=""
                    className="h-full w-full object-cover transition group-hover:scale-[1.02]"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted">
                    <BookOpen className="h-6 w-6" />
                  </div>
                )}
              </div>
              <div className="p-4">
                {article.category && (
                  <span className="chip mb-2 inline-flex">{article.category.name}</span>
                )}
                <h2 className="line-clamp-2 text-base font-semibold leading-snug group-hover:text-brand">
                  {article.title}
                </h2>
                {article.summary && (
                  <p className="mt-1.5 line-clamp-2 text-sm text-muted">{article.summary}</p>
                )}
                <div className="mt-3 flex items-center justify-between text-xs text-muted">
                  <span className="truncate">@{article.author.displayName}</span>
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" />
                    {formatCount(article.viewCount, locale)}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted">
                  {formatDate(article.publishedAt ?? article.createdAt, locale)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
