import { ArticleActions } from '@/components/ArticleActions';
import { ArticleComments } from '@/components/ArticleComments';
import { ApiError } from '@/lib/api';
import { formatCount, formatDate } from '@/lib/format';
import { getLocale, getT } from '@/lib/i18n-server';
import { serverFetch, serverFetchSafe } from '@/lib/server-api';
import { BookOpen, Eye, Heart, MessageSquare } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

interface ArticleDetail {
  id: string;
  title: string;
  summary: string;
  html: string;
  coverUrl: string | null;
  viewCount: number;
  likeCount: number;
  favoriteCount: number;
  commentCount: number;
  liked: boolean;
  favorited: boolean;
  allowComments: boolean;
  isOwner: boolean;
  publishedAt: string | null;
  createdAt: string;
  author: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    level: number;
  };
  category: { id: string; name: string; slug: string } | null;
  related: Array<{
    id: string;
    title: string;
    summary: string;
    coverUrl: string | null;
    viewCount: number;
    publishedAt: string | null;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const t = await getT();
  try {
    const article = await serverFetch<ArticleDetail>(`/api/v1/articles/${id}`);
    return { title: article.title, description: article.summary.slice(0, 160) };
  } catch {
    return { title: t('专栏') };
  }
}

export default async function ColumnDetailPage({ params }: PageProps) {
  const { id } = await params;
  const [t, locale] = await Promise.all([getT(), getLocale()]);
  let article: ArticleDetail;
  try {
    article = await serverFetch<ArticleDetail>(`/api/v1/articles/${id}`);
  } catch (error) {
    return (
      <div className="container-page py-16">
        <div className="card mx-auto max-w-xl p-10 text-center">
          <h1 className="text-xl font-semibold">{t('专栏不可用')}</h1>
          <p className="mt-2 text-sm text-muted">
            {error instanceof ApiError && error.status === 404
              ? t('专栏不存在或尚未公开')
              : error instanceof Error
                ? t(error.message)
                : t('加载失败')}
          </p>
          <Link href="/columns" className="btn-primary mt-6">
            {t('返回专栏列表')}
          </Link>
        </div>
      </div>
    );
  }

  const related = await serverFetchSafe<{ items: ArticleDetail['related'] }>(
    '/api/v1/articles?limit=6',
    { items: [] },
  );

  return (
    <div className="container-page py-6">
      <nav className="mb-3 flex items-center gap-2 text-xs text-muted">
        <Link href="/" className="hover:text-brand">
          {t('首页')}
        </Link>
        <span>/</span>
        <Link href="/columns" className="hover:text-brand">
          {t('专栏')}
        </Link>
        <span>/</span>
        <span className="truncate">{article.title}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <article className="card p-6 sm:p-8">
            {article.category && (
              <Link href="/columns" className="chip mb-3 inline-flex">
                {article.category.name}
              </Link>
            )}
            <h1 className="text-2xl font-semibold leading-snug">{article.title}</h1>
            {article.summary && <p className="mt-2 text-sm text-muted">{article.summary}</p>}

            <div className="mt-4 flex flex-wrap items-center gap-3 border-b border-[var(--border)] pb-4 text-xs text-muted">
              <Link href={`/space/${article.author.username}`} className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-brand-light text-xs font-semibold text-brand-dark">
                  {article.author.avatarUrl ? (
                    <img
                      src={article.author.avatarUrl}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    article.author.displayName.slice(0, 1).toUpperCase()
                  )}
                </span>
                <span className="font-medium text-ink">{article.author.displayName}</span>
              </Link>
              <span>{formatDate(article.publishedAt ?? article.createdAt, locale)}</span>
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" />
                {formatCount(article.viewCount, locale)}
              </span>
              <span className="inline-flex items-center gap-1">
                <Heart className="h-3.5 w-3.5" />
                {formatCount(article.likeCount, locale)}
              </span>
              <span className="inline-flex items-center gap-1">
                <MessageSquare className="h-3.5 w-3.5" />
                {formatCount(article.commentCount, locale)}
              </span>
            </div>

            {article.coverUrl && (
              <div className="mt-5 overflow-hidden rounded-xl">
                <img src={article.coverUrl} alt="" className="w-full object-cover" />
              </div>
            )}

            <div
              className="legal-content mt-5 text-[15px] leading-7"
              dangerouslySetInnerHTML={{ __html: article.html }}
            />

            <div className="mt-6 border-t border-[var(--border)] pt-4">
              <ArticleActions
                articleId={article.id}
                likeCount={article.likeCount}
                favoriteCount={article.favoriteCount}
                liked={article.liked}
                favorited={article.favorited}
              />
            </div>
          </article>

          {article.allowComments ? (
            <ArticleComments articleId={article.id} />
          ) : (
            <div className="card mt-5 p-5 text-sm text-muted">
              {t('作者已关闭这篇专栏的评论。')}
            </div>
          )}
        </div>

        <aside className="min-w-0">
          <section className="card p-4">
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
              <BookOpen className="h-4 w-4 text-brand" />
              {t('更多专栏')}
            </h2>
            <div className="space-y-3">
              {related.items
                .filter((item) => item.id !== article.id)
                .slice(0, 5)
                .map((item) => (
                  <Link
                    key={item.id}
                    href={`/columns/${item.id}`}
                    className="group flex gap-3 rounded-lg p-1 transition hover:bg-canvas"
                  >
                    <div className="h-12 w-20 shrink-0 overflow-hidden rounded bg-canvas">
                      {item.coverUrl && (
                        <img src={item.coverUrl} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="line-clamp-2 text-sm font-medium leading-snug group-hover:text-brand">
                        {item.title}
                      </div>
                      <div className="mt-0.5 text-xs text-muted">
                        {formatCount(item.viewCount, locale)} {t('阅读')}
                      </div>
                    </div>
                  </Link>
                ))}
              {related.items.filter((item) => item.id !== article.id).length === 0 && (
                <p className="text-sm text-muted">{t('暂无更多专栏')}</p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
