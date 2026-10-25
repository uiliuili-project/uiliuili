import { Injectable } from '@nestjs/common';
import { categories, searchQueries, tags, users, videoTags, videos } from '@uiliuili/db';
import type { VideoCard } from '@uiliuili/shared';
import { and, count, desc, eq, ilike, inArray, isNull, lte, or, sql } from 'drizzle-orm';
import type { AuthUser } from '../common/auth-user';
import { DatabaseService } from '../common/database.service';
import { SettingsService } from '../common/settings.service';
import { publicUser, videoCard } from '../videos/video.helpers';
import { VideosService } from '../videos/videos.service';

interface SearchQuery {
  q: string;
  type: 'videos' | 'users' | 'tags';
  limit: number;
  category?: string;
  sort: 'new' | 'hot';
  duration?: 'short' | 'medium' | 'long';
  date?: 'week' | 'month' | 'year';
  author?: string;
  tag?: string;
}

@Injectable()
export class SearchService {
  constructor(
    private readonly database: DatabaseService,
    private readonly videos: VideosService,
    private readonly settings: SettingsService,
  ) {}

  async search(query: SearchQuery, viewer?: AuthUser) {
    if (query.q.trim()) {
      await this.database.db
        .insert(searchQueries)
        .values({ userId: viewer?.id ?? null, query: query.q.trim().slice(0, 100) })
        .catch(() => undefined);
    }
    if (query.type === 'users') return this.searchUsers(query);
    if (query.type === 'tags') return this.searchTags(query);
    const meili = await this.tryMeili(query);
    if (meili) return meili;
    const result = await this.videos.list({
      q: query.q,
      limit: query.limit,
      category: query.category,
      sort: query.sort,
      author: query.author,
      tag: query.tag,
    });
    return {
      type: 'videos' as const,
      items: this.applyFilters(result.items, query),
      nextCursor: result.nextCursor,
      engine: 'postgres',
    };
  }

  async suggest(q: string) {
    const needle = `%${q.trim()}%`;
    if (!q.trim()) return { items: [] };
    const [videoRows, userRows, tagRows] = await Promise.all([
      this.database.db
        .select({ id: videos.id, title: videos.title })
        .from(videos)
        .where(
          and(
            eq(videos.status, 'published'),
            eq(videos.visibility, 'public'),
            isNull(videos.deletedAt),
            lte(videos.publishedAt, new Date()),
            ilike(videos.title, needle),
          ),
        )
        .orderBy(desc(videos.viewCount))
        .limit(5),
      this.database.db
        .select({ id: users.id, username: users.username, displayName: users.displayName })
        .from(users)
        .where(or(ilike(users.username, needle), ilike(users.displayName, needle)))
        .limit(3),
      this.database.db
        .select({ name: tags.name })
        .from(tags)
        .where(ilike(tags.name, needle))
        .limit(3),
    ]);
    return {
      items: [
        ...videoRows.map((row) => ({ type: 'video', id: row.id, text: row.title })),
        ...userRows.map((row) => ({
          type: 'user',
          id: row.id,
          text: `${row.displayName} (@${row.username})`,
        })),
        ...tagRows.map((row) => ({ type: 'tag', id: row.name, text: row.name })),
      ],
    };
  }

  async hot() {
    const rows = await this.database.db
      .select({ query: searchQueries.query, value: count() })
      .from(searchQueries)
      .where(sql`${searchQueries.createdAt} > now() - interval '7 days'`)
      .groupBy(searchQueries.query)
      .orderBy(desc(count()))
      .limit(10);
    return { items: rows.map((row) => ({ query: row.query, count: Number(row.value) })) };
  }

  async history(userId: string) {
    const rows = await this.database.db
      .select({ query: searchQueries.query, createdAt: sql<Date>`MAX(${searchQueries.createdAt})` })
      .from(searchQueries)
      .where(eq(searchQueries.userId, userId))
      .groupBy(searchQueries.query)
      .orderBy(desc(sql`MAX(${searchQueries.createdAt})`))
      .limit(10);
    return {
      items: rows.map((row) => ({
        query: row.query,
        createdAt: new Date(row.createdAt).toISOString(),
      })),
    };
  }

  async clearHistory(userId: string) {
    await this.database.db.delete(searchQueries).where(eq(searchQueries.userId, userId));
    return { ok: true };
  }

  private async searchUsers(query: SearchQuery) {
    const needle = `%${query.q}%`;
    const rows = await this.database.db
      .select()
      .from(users)
      .where(or(ilike(users.username, needle), ilike(users.displayName, needle)))
      .orderBy(desc(users.level))
      .limit(query.limit);
    return {
      type: 'users' as const,
      items: rows.map((row) => publicUser(row)),
      engine: 'postgres',
    };
  }

  private async searchTags(query: SearchQuery) {
    const sidebar = await this.database.db
      .select({
        name: tags.name,
        slug: tags.slug,
        count: count(videoTags.videoId),
      })
      .from(tags)
      .leftJoin(videoTags, eq(videoTags.tagId, tags.id))
      .where(ilike(tags.name, `%${query.q}%`))
      .groupBy(tags.id, tags.name, tags.slug)
      .orderBy(desc(count(videoTags.videoId)))
      .limit(query.limit);
    return {
      type: 'tags' as const,
      items: sidebar.map((row) => ({ ...row, count: Number(row.count) })),
      engine: 'postgres',
    };
  }

  private async tryMeili(query: SearchQuery) {
    const config = await this.settings.getSearchConfig();
    if (config.driver !== 'meilisearch' || !query.q.trim()) return null;
    try {
      const base = config.url.replace(/\/$/, '');
      const index = `${config.indexPrefix}_videos`;
      const filters = ['status = published', 'visibility = public'];
      if (query.category) filters.push(`categorySlug = "${query.category.replace(/"/g, '')}"`);
      const response = await fetch(`${base}/indexes/${index}/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.key ? { Authorization: `Bearer ${config.key}` } : {}),
        },
        body: JSON.stringify({
          q: query.q,
          limit: query.limit,
          filter: filters,
          sort: [query.sort === 'new' ? 'publishedAt:desc' : 'views:desc'],
        }),
      });
      if (!response.ok) return null;
      const data = (await response.json()) as { hits?: Array<{ id: string }> };
      const ids = (data.hits ?? []).map((hit) => hit.id);
      if (ids.length === 0) {
        return { type: 'videos' as const, items: [], nextCursor: null, engine: 'meilisearch' };
      }
      const rows = await this.database.db
        .select({ video: videos, uploader: users, category: categories })
        .from(videos)
        .innerJoin(users, eq(users.id, videos.uploaderId))
        .leftJoin(categories, eq(categories.id, videos.categoryId))
        .where(
          and(
            inArray(videos.id, ids),
            eq(videos.status, 'published'),
            eq(videos.visibility, 'public'),
            isNull(videos.deletedAt),
          ),
        );
      const tagsByVideo = await this.videos.tagsFor(rows.map((row) => row.video.id));
      const map = new Map(
        rows.map((row) => [row.video.id, videoCard(row, tagsByVideo.get(row.video.id) ?? [])]),
      );
      const items = ids.map((id) => map.get(id)).filter((item): item is VideoCard => Boolean(item));
      return {
        type: 'videos' as const,
        items: this.applyFilters(items, query),
        nextCursor: null,
        engine: 'meilisearch',
      };
    } catch {
      return null;
    }
  }

  private applyFilters<T extends { durationSeconds: number; publishedAt: string | null }>(
    items: T[],
    query: SearchQuery,
  ): T[] {
    let result = items;
    if (query.duration) {
      result = result.filter((item) => {
        if (query.duration === 'short') return item.durationSeconds < 60;
        if (query.duration === 'medium')
          return item.durationSeconds >= 60 && item.durationSeconds < 600;
        return item.durationSeconds >= 600;
      });
    }
    if (query.date) {
      const days = query.date === 'week' ? 7 : query.date === 'month' ? 30 : 365;
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      result = result.filter(
        (item) => item.publishedAt && new Date(item.publishedAt).getTime() >= cutoff,
      );
    }
    return result;
  }
}
