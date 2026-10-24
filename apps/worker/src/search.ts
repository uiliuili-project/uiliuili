import type { Db } from '@uiliuili/db';
import { categories, tags, users, videoTags, videos } from '@uiliuili/db';
import { eq } from 'drizzle-orm';
import { getSearchConfig } from './storage';

let configured = false;

export async function indexVideo(db: Db, videoId: string): Promise<void> {
  const config = await getSearchConfig(db);
  if (config.driver !== 'meilisearch') return;
  const base = config.url.replace(/\/$/, '');
  const index = `${config.indexPrefix}_videos`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.key) headers.Authorization = `Bearer ${config.key}`;

  const rows = await db
    .select({ video: videos, uploader: users, category: categories })
    .from(videos)
    .innerJoin(users, eq(users.id, videos.uploaderId))
    .leftJoin(categories, eq(categories.id, videos.categoryId))
    .where(eq(videos.id, videoId))
    .limit(1);
  const row = rows[0];
  if (!row) return;

  if (!configured) {
    await fetch(`${base}/indexes`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ uid: index, primaryKey: 'id' }),
    }).catch(() => undefined);
    await fetch(`${base}/indexes/${index}/settings`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        searchableAttributes: ['title', 'description', 'tags', 'uploaderName', 'categoryName'],
        filterableAttributes: ['status', 'visibility', 'categorySlug', 'uploaderUsername', 'tags'],
        sortableAttributes: ['publishedAt', 'views', 'likes'],
        rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness'],
      }),
    }).catch(() => undefined);
    configured = true;
  }

  if (
    row.video.status !== 'published' ||
    row.video.visibility !== 'public' ||
    row.video.deletedAt
  ) {
    await fetch(`${base}/indexes/${index}/documents/${encodeURIComponent(videoId)}`, {
      method: 'DELETE',
      headers,
    }).catch(() => undefined);
    return;
  }

  const tagRows = await db
    .select({ name: tags.name })
    .from(videoTags)
    .innerJoin(tags, eq(tags.id, videoTags.tagId))
    .where(eq(videoTags.videoId, videoId));
  const document = {
    id: row.video.id,
    title: row.video.title,
    description: row.video.description,
    tags: tagRows.map((tag) => tag.name),
    categorySlug: row.category?.slug ?? '',
    categoryName: row.category?.name ?? '',
    uploaderUsername: row.uploader.username,
    uploaderName: row.uploader.displayName,
    status: row.video.status,
    visibility: row.video.visibility,
    views: row.video.viewCount,
    likes: row.video.likeCount,
    durationSeconds: row.video.durationSeconds,
    publishedAt: row.video.publishedAt?.toISOString() ?? row.video.createdAt.toISOString(),
  };
  const response = await fetch(`${base}/indexes/${index}/documents?primaryKey=id`, {
    method: 'POST',
    headers,
    body: JSON.stringify([document]),
  });
  if (!response.ok) {
    throw new Error(`Meilisearch indexing failed: ${response.status} ${await response.text()}`);
  }
}

export async function reindexAll(db: Db): Promise<number> {
  const rows = await db
    .select({ id: videos.id })
    .from(videos)
    .where(eq(videos.status, 'published'));
  for (const row of rows) await indexVideo(db, row.id);
  return rows.length;
}
