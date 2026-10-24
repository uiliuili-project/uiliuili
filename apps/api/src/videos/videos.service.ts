import path from 'node:path';
import { Injectable } from '@nestjs/common';
import {
  type DbUser,
  type DbVideo,
  categories,
  coinLedger,
  favoriteFolders,
  favoriteItems,
  follows,
  notifications,
  reports,
  tags,
  userFeedbacks,
  users,
  videoCoins,
  videoLikes,
  videoRenditions,
  videoSubtitles,
  videoTags,
  videos,
  watchEvents,
  watchHistories,
} from '@uiliuili/db';
import {
  AppError,
  ERROR_CODES,
  type VideoCreateInput,
  type VideoDetail,
  type VideoVisibility,
} from '@uiliuili/shared';
import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  lte,
  ne,
  notInArray,
  or,
  sql,
} from 'drizzle-orm';
import type { AuthUser } from '../common/auth-user';
import { DatabaseService } from '../common/database.service';
import { QueueService } from '../common/queue.service';
import { SettingsService } from '../common/settings.service';
import { StorageService } from '../common/storage.service';
import {
  type VideoJoinRow,
  categoryPayload,
  decodeCursor,
  encodeCursor,
  publicUser,
  videoCard,
} from './video.helpers';

@Injectable()
export class VideosService {
  constructor(
    private readonly database: DatabaseService,
    private readonly settings: SettingsService,
    private readonly storage: StorageService,
    private readonly queue: QueueService,
  ) {}

  async list(query: {
    cursor?: string;
    limit: number;
    category?: string;
    tag?: string;
    sort: 'new' | 'hot' | 'recommended';
    q?: string;
    excludeIds?: string[];
    excludeUploaderIds?: string[];
  }) {
    const offset = decodeCursor(query.cursor);
    const conditions = [
      eq(videos.status, 'published'),
      eq(videos.visibility, 'public'),
      isNull(videos.deletedAt),
      lte(videos.publishedAt, new Date()),
    ];
    if (query.category) conditions.push(eq(categories.slug, query.category));
    if (query.q) {
      const needle = `%${query.q}%`;
      conditions.push(or(ilike(videos.title, needle), ilike(videos.description, needle))!);
    }
    if (query.excludeIds?.length) conditions.push(notInArray(videos.id, query.excludeIds));
    if (query.excludeUploaderIds?.length) {
      conditions.push(notInArray(videos.uploaderId, query.excludeUploaderIds));
    }
    if (query.tag) {
      const tagged = this.database.db
        .select({ id: videoTags.videoId })
        .from(videoTags)
        .innerJoin(tags, eq(tags.id, videoTags.tagId))
        .where(eq(tags.name, query.tag));
      conditions.push(inArray(videos.id, tagged));
    }

    const recommendation = await this.settings.getRecommendationSettings();
    const weights = recommendation.weights as Record<string, number>;
    const weight = (key: string, fallback: number) => Math.max(0, Number(weights[key] ?? fallback));
    const freshness = Math.max(0.1, Number(weights.freshness ?? 1.2));
    const score = sql<number>`(
      ${videos.viewCount} * ${weight('views', 0.06)} +
      ${videos.likeCount} * ${weight('likes', 0.24)} +
      ${videos.coinCount} * ${weight('coins', 0.28)} +
      ${videos.favoriteCount} * ${weight('favorites', 0.22)} +
      ${videos.commentCount} * ${weight('comments', 0.12)} +
      ${videos.danmakuCount} * 0.04 +
      ${videos.completionRate} * ${weight('completion', 0.08)} +
      CASE WHEN ${videos.featured} THEN 0.5 ELSE 0 END
    ) / (1 + EXTRACT(EPOCH FROM (now() - COALESCE(${videos.publishedAt}, ${videos.createdAt}))) / 86400 / ${freshness * 30})`;

    const rows = await this.database.db
      .select({ video: videos, uploader: users, category: categories })
      .from(videos)
      .innerJoin(users, eq(users.id, videos.uploaderId))
      .leftJoin(categories, eq(categories.id, videos.categoryId))
      .where(and(...conditions))
      .orderBy(
        ...(query.sort === 'new'
          ? [desc(videos.publishedAt), desc(videos.id)]
          : [desc(score), desc(videos.publishedAt)]),
      )
      .limit(query.limit)
      .offset(offset);

    const tagsByVideo = await this.tagsFor(rows.map((row) => row.video.id));
    return {
      items: rows.map((row) => videoCard(row, tagsByVideo.get(row.video.id) ?? [])),
      nextCursor: rows.length === query.limit ? encodeCursor(offset + query.limit) : null,
    };
  }

  async byUploader(
    username: string,
    query: { cursor?: string; limit: number; sort: 'new' | 'hot' },
  ) {
    const offset = decodeCursor(query.cursor);
    const userRows = await this.database.db
      .select()
      .from(users)
      .where(sql`lower(${users.username}) = ${username.toLowerCase()}`)
      .limit(1);
    const uploader = userRows[0];
    if (!uploader) throw new AppError(ERROR_CODES.NOT_FOUND, '用户不存在', 404);
    const rows = await this.database.db
      .select({ video: videos, uploader: users, category: categories })
      .from(videos)
      .innerJoin(users, eq(users.id, videos.uploaderId))
      .leftJoin(categories, eq(categories.id, videos.categoryId))
      .where(
        and(
          eq(videos.uploaderId, uploader.id),
          eq(videos.status, 'published'),
          eq(videos.visibility, 'public'),
          isNull(videos.deletedAt),
          lte(videos.publishedAt, new Date()),
        ),
      )
      .orderBy(
        ...(query.sort === 'new'
          ? [desc(videos.publishedAt)]
          : [desc(videos.viewCount), desc(videos.publishedAt)]),
      )
      .limit(query.limit)
      .offset(offset);
    const tagsByVideo = await this.tagsFor(rows.map((row) => row.video.id));
    return {
      items: rows.map((row) => videoCard(row, tagsByVideo.get(row.video.id) ?? [])),
      nextCursor: rows.length === query.limit ? encodeCursor(offset + query.limit) : null,
    };
  }

  async detail(id: string, viewer?: AuthUser): Promise<VideoDetail> {
    const row = await this.getRow(id);
    this.assertCanView(row.video, viewer);
    const tagsByVideo = await this.tagsFor([id]);
    const tagNames = tagsByVideo.get(id) ?? [];
    const [liked, coin, favorited, following, history, renditions, subtitles] = await Promise.all([
      viewer
        ? this.database.db
            .select({ userId: videoLikes.userId })
            .from(videoLikes)
            .where(and(eq(videoLikes.userId, viewer.id), eq(videoLikes.videoId, id)))
            .limit(1)
        : Promise.resolve([]),
      viewer
        ? this.database.db
            .select({ amount: videoCoins.amount })
            .from(videoCoins)
            .where(and(eq(videoCoins.userId, viewer.id), eq(videoCoins.videoId, id)))
            .limit(1)
        : Promise.resolve([]),
      viewer
        ? this.database.db
            .select({ videoId: favoriteItems.videoId })
            .from(favoriteItems)
            .innerJoin(favoriteFolders, eq(favoriteFolders.id, favoriteItems.folderId))
            .where(and(eq(favoriteFolders.userId, viewer.id), eq(favoriteItems.videoId, id)))
            .limit(1)
        : Promise.resolve([]),
      viewer
        ? this.database.db
            .select({ followerId: follows.followerId })
            .from(follows)
            .where(
              and(eq(follows.followerId, viewer.id), eq(follows.followingId, row.video.uploaderId)),
            )
            .limit(1)
        : Promise.resolve([]),
      viewer
        ? this.database.db
            .select()
            .from(watchHistories)
            .where(and(eq(watchHistories.userId, viewer.id), eq(watchHistories.videoId, id)))
            .limit(1)
        : Promise.resolve([]),
      this.database.db
        .select()
        .from(videoRenditions)
        .where(eq(videoRenditions.videoId, id))
        .orderBy(desc(videoRenditions.height)),
      this.database.db.select().from(videoSubtitles).where(eq(videoSubtitles.videoId, id)),
    ]);

    const base = videoCard(row, tagNames);
    const canPlay = ['ready', 'pending_review', 'published'].includes(row.video.status);
    const subtitlePayload = await Promise.all(
      subtitles.map(async (subtitle) => ({
        language: subtitle.language,
        label: subtitle.label,
        url: await this.storage.signedUrl(subtitle.storageKey, 3600),
      })),
    );
    return {
      ...base,
      description: row.video.description,
      status: row.video.status,
      visibility: row.video.visibility,
      featured: row.video.featured,
      playlistUrl: row.video.playlistKey && canPlay ? `/api/v1/videos/${id}/hls/master.m3u8` : null,
      renditions: renditions.map((rendition) => ({
        quality: rendition.quality,
        width: rendition.width,
        height: rendition.height,
        bitrate: rendition.bitrate,
        playlistUrl: `/api/v1/videos/${id}/hls/${rendition.quality}/index.m3u8`,
      })),
      subtitles: subtitlePayload,
      liked: liked.length > 0,
      coinCount: Number(coin[0]?.amount ?? 0),
      favorited: favorited.length > 0,
      following: following.length > 0,
      progressMs: history[0]?.positionMs ?? 0,
    };
  }

  async related(id: string, limit = 12) {
    const row = await this.getRow(id);
    const conditions = [
      eq(videos.status, 'published'),
      eq(videos.visibility, 'public'),
      isNull(videos.deletedAt),
      ne(videos.id, id),
    ];
    if (row.video.categoryId) conditions.push(eq(videos.categoryId, row.video.categoryId));
    const rows = await this.database.db
      .select({ video: videos, uploader: users, category: categories })
      .from(videos)
      .innerJoin(users, eq(users.id, videos.uploaderId))
      .leftJoin(categories, eq(categories.id, videos.categoryId))
      .where(and(...conditions))
      .orderBy(desc(videos.viewCount), desc(videos.publishedAt))
      .limit(limit);
    if (rows.length < limit) {
      const seen = new Set(rows.map((item) => item.video.id));
      seen.add(id);
      const fallback = await this.database.db
        .select({ video: videos, uploader: users, category: categories })
        .from(videos)
        .innerJoin(users, eq(users.id, videos.uploaderId))
        .leftJoin(categories, eq(categories.id, videos.categoryId))
        .where(
          and(
            eq(videos.status, 'published'),
            eq(videos.visibility, 'public'),
            isNull(videos.deletedAt),
          ),
        )
        .orderBy(desc(videos.viewCount))
        .limit(limit * 2);
      for (const item of fallback) {
        if (rows.length >= limit) break;
        if (!seen.has(item.video.id)) {
          rows.push(item);
          seen.add(item.video.id);
        }
      }
    }
    const tagsByVideo = await this.tagsFor(rows.map((item) => item.video.id));
    return {
      items: rows.map((item) => videoCard(item, tagsByVideo.get(item.video.id) ?? [])),
    };
  }

  async playlist(id: string, viewer?: AuthUser) {
    const row = await this.getRow(id);
    this.assertCanView(row.video, viewer);
    if (!row.video.playlistKey) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '视频尚未完成转码', 400);
    }
    await this.database.db
      .update(videos)
      .set({ viewCount: sql`${videos.viewCount} + 1` })
      .where(eq(videos.id, id));
    await this.database.db.insert(watchEvents).values({
      userId: viewer?.id ?? null,
      videoId: id,
      eventType: 'view',
    });
    const [renditions, subtitles] = await Promise.all([
      this.database.db
        .select()
        .from(videoRenditions)
        .where(eq(videoRenditions.videoId, id))
        .orderBy(desc(videoRenditions.height)),
      this.database.db.select().from(videoSubtitles).where(eq(videoSubtitles.videoId, id)),
    ]);
    return {
      playlistUrl: `/api/v1/videos/${id}/hls/master.m3u8`,
      renditions: renditions.map((rendition) => ({
        quality: rendition.quality,
        width: rendition.width,
        height: rendition.height,
        bitrate: rendition.bitrate,
        playlistUrl: `/api/v1/videos/${id}/hls/${rendition.quality}/index.m3u8`,
      })),
      subtitles: await Promise.all(
        subtitles.map(async (subtitle) => ({
          language: subtitle.language,
          label: subtitle.label,
          url: await this.storage.signedUrl(subtitle.storageKey, 3600),
        })),
      ),
    };
  }

  async hlsKey(id: string, filePath: string, viewer?: AuthUser) {
    const row = await this.getRow(id);
    this.assertCanView(row.video, viewer);
    if (!row.video.playlistKey) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '视频尚未完成转码', 400);
    }
    const base = path.posix.dirname(row.video.playlistKey);
    const normalized = path.posix.normalize(decodeURIComponent(filePath)).replace(/^\/+/, '');
    if (normalized.startsWith('..') || normalized.includes('/../')) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '非法路径', 400);
    }
    return { key: `${base}/${normalized}`, video: row.video };
  }

  async toggleLike(id: string, viewer: AuthUser, desired?: boolean) {
    const row = await this.getRow(id);
    this.assertCanView(row.video, viewer);
    let liked = false;
    await this.database.db.transaction(async (tx) => {
      const existing = await tx
        .select({ userId: videoLikes.userId })
        .from(videoLikes)
        .where(and(eq(videoLikes.userId, viewer.id), eq(videoLikes.videoId, id)))
        .limit(1);
      const shouldLike = desired === undefined ? existing.length === 0 : desired;
      if (!shouldLike && existing.length > 0) {
        await tx
          .delete(videoLikes)
          .where(and(eq(videoLikes.userId, viewer.id), eq(videoLikes.videoId, id)));
        await tx
          .update(videos)
          .set({ likeCount: sql`GREATEST(0, ${videos.likeCount} - 1)` })
          .where(eq(videos.id, id));
      } else if (shouldLike && existing.length === 0) {
        await tx.insert(videoLikes).values({ userId: viewer.id, videoId: id });
        await tx
          .update(videos)
          .set({ likeCount: sql`${videos.likeCount} + 1` })
          .where(eq(videos.id, id));
        liked = true;
      }
    });
    if (liked && row.video.uploaderId !== viewer.id) {
      await this.database.db.insert(notifications).values({
        userId: row.video.uploaderId,
        actorId: viewer.id,
        type: 'like',
        title: `${viewer.displayName} 赞了你的视频`,
        body: row.video.title,
        link: `/video/${row.video.id}`,
      });
    }
    const [countRow] = await this.database.db
      .select({ value: count() })
      .from(videoLikes)
      .where(eq(videoLikes.videoId, id));
    return { liked, count: Number(countRow?.value ?? 0) };
  }

  async addCoin(id: string, viewer: AuthUser, amount: number) {
    const row = await this.getRow(id);
    this.assertCanView(row.video, viewer);
    const social = await this.settings.getSocialSettings();
    if (amount < 1 || amount > social.maxCoinPerVideo) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '投币数量不合法', 400);
    }
    const result = await this.database.db.transaction(async (tx) => {
      const [freshUser] = await tx.select().from(users).where(eq(users.id, viewer.id)).limit(1);
      if (!freshUser) throw new AppError(ERROR_CODES.NOT_FOUND, '用户不存在', 404);
      const [existing] = await tx
        .select()
        .from(videoCoins)
        .where(and(eq(videoCoins.userId, viewer.id), eq(videoCoins.videoId, id)))
        .limit(1);
      if ((existing?.amount ?? 0) + amount > social.maxCoinPerVideo) {
        throw new AppError(ERROR_CODES.BAD_REQUEST, '每个视频最多投 2 枚硬币', 400);
      }
      if (freshUser.coinBalance < amount) {
        throw new AppError(ERROR_CODES.BAD_REQUEST, '硬币不足', 400);
      }
      if (existing) {
        await tx
          .update(videoCoins)
          .set({ amount: existing.amount + amount })
          .where(and(eq(videoCoins.userId, viewer.id), eq(videoCoins.videoId, id)));
      } else {
        await tx.insert(videoCoins).values({ userId: viewer.id, videoId: id, amount });
      }
      await tx
        .update(users)
        .set({ coinBalance: sql`${users.coinBalance} - ${amount}` })
        .where(eq(users.id, viewer.id));
      await tx
        .update(videos)
        .set({ coinCount: sql`${videos.coinCount} + ${amount}` })
        .where(eq(videos.id, id));
      await tx.insert(coinLedger).values({
        userId: viewer.id,
        amount: -amount,
        reason: 'video_coin',
        videoId: id,
      });
      return (existing?.amount ?? 0) + amount;
    });
    if (row.video.uploaderId !== viewer.id) {
      await this.database.db.insert(notifications).values({
        userId: row.video.uploaderId,
        actorId: viewer.id,
        type: 'coin',
        title: `${viewer.displayName} 给你的视频投了 ${amount} 枚硬币`,
        body: row.video.title,
        link: `/video/${row.video.id}`,
      });
    }
    return { count: result };
  }

  async toggleFavorite(id: string, viewer: AuthUser, desired?: boolean) {
    const row = await this.getRow(id);
    this.assertCanView(row.video, viewer);
    let folder = (
      await this.database.db
        .select()
        .from(favoriteFolders)
        .where(eq(favoriteFolders.userId, viewer.id))
        .orderBy(desc(favoriteFolders.isDefault))
        .limit(1)
    )[0];
    if (!folder) {
      const created = await this.database.db
        .insert(favoriteFolders)
        .values({ userId: viewer.id, name: '默认收藏夹', isDefault: true })
        .returning();
      folder = created[0];
    }
    if (!folder) throw new AppError(ERROR_CODES.INTERNAL_ERROR, '无法创建收藏夹', 500);
    let favorited = false;
    await this.database.db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(favoriteItems)
        .where(and(eq(favoriteItems.folderId, folder!.id), eq(favoriteItems.videoId, id)))
        .limit(1);
      const shouldFavorite = desired === undefined ? existing.length === 0 : desired;
      if (!shouldFavorite && existing.length > 0) {
        await tx
          .delete(favoriteItems)
          .where(and(eq(favoriteItems.folderId, folder!.id), eq(favoriteItems.videoId, id)));
        await tx
          .update(videos)
          .set({ favoriteCount: sql`GREATEST(0, ${videos.favoriteCount} - 1)` })
          .where(eq(videos.id, id));
      } else if (shouldFavorite && existing.length === 0) {
        await tx.insert(favoriteItems).values({ folderId: folder!.id, videoId: id });
        await tx
          .update(videos)
          .set({ favoriteCount: sql`${videos.favoriteCount} + 1` })
          .where(eq(videos.id, id));
        favorited = true;
      }
    });
    if (favorited && row.video.uploaderId !== viewer.id) {
      await this.database.db.insert(notifications).values({
        userId: row.video.uploaderId,
        actorId: viewer.id,
        type: 'favorite',
        title: `${viewer.displayName} 收藏了你的视频`,
        body: row.video.title,
        link: `/video/${row.video.id}`,
      });
    }
    return { favorited };
  }

  async saveProgress(
    id: string,
    viewer: AuthUser,
    input: { positionMs: number; durationMs?: number; completed?: boolean },
  ) {
    const row = await this.getRow(id);
    this.assertCanView(row.video, viewer);
    await this.database.db
      .insert(watchHistories)
      .values({
        userId: viewer.id,
        videoId: id,
        positionMs: input.positionMs,
        durationMs: input.durationMs ?? 0,
        completed: input.completed ?? false,
      })
      .onConflictDoUpdate({
        target: [watchHistories.userId, watchHistories.videoId],
        set: {
          positionMs: input.positionMs,
          durationMs: input.durationMs ?? 0,
          completed: input.completed ?? false,
          updatedAt: new Date(),
        },
      });
    await this.database.db.insert(watchEvents).values({
      userId: viewer.id,
      videoId: id,
      positionMs: input.positionMs,
      durationMs: input.durationMs ?? 0,
      eventType: input.completed ? 'complete' : 'progress',
    });
    if (input.completed) {
      await this.database.db
        .update(videos)
        .set({ completionRate: sql`(${videos.completionRate} * 0.9) + 0.1` })
        .where(eq(videos.id, id));
    }
    return { ok: true };
  }

  async report(
    viewer: AuthUser,
    input: { targetType: string; targetId: string; reason: string; detail?: string },
  ) {
    await this.database.db.insert(reports).values({
      reporterId: viewer.id,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      detail: input.detail ?? '',
    });
    return { ok: true };
  }

  async feedback(viewer: AuthUser, input: { videoId: string; action: string }) {
    await this.database.db
      .insert(userFeedbacks)
      .values({ userId: viewer.id, videoId: input.videoId, action: input.action })
      .onConflictDoNothing();
    return { ok: true };
  }

  async getCategories() {
    return this.database.db.select().from(categories).orderBy(categories.sort);
  }

  async enqueueIndex(videoId: string): Promise<void> {
    await this.queue.enqueue('search-index', { videoId }, { idempotencyKey: `search:${videoId}` });
  }

  async getRow(id: string): Promise<VideoJoinRow> {
    const rows = await this.database.db
      .select({ video: videos, uploader: users, category: categories })
      .from(videos)
      .innerJoin(users, eq(users.id, videos.uploaderId))
      .leftJoin(categories, eq(categories.id, videos.categoryId))
      .where(eq(videos.id, id))
      .limit(1);
    const row = rows[0];
    if (!row || row.video.deletedAt) {
      throw new AppError(ERROR_CODES.NOT_FOUND, '视频不存在', 404);
    }
    return row;
  }

  assertCanView(video: DbVideo, viewer?: AuthUser): void {
    const privileged =
      viewer && (viewer.id === video.uploaderId || viewer.permissions.includes('video:manage_any'));
    if (video.visibility === 'private' && !privileged) {
      throw new AppError(ERROR_CODES.NOT_FOUND, '视频不存在', 404);
    }
    if (video.status !== 'published' && !privileged) {
      throw new AppError(ERROR_CODES.NOT_FOUND, '视频不存在', 404);
    }
  }

  async tagsFor(videoIds: string[]): Promise<Map<string, string[]>> {
    const result = new Map<string, string[]>();
    if (videoIds.length === 0) return result;
    const rows = await this.database.db
      .select({ videoId: videoTags.videoId, name: tags.name })
      .from(videoTags)
      .innerJoin(tags, eq(tags.id, videoTags.tagId))
      .where(inArray(videoTags.videoId, videoIds));
    for (const row of rows) {
      const list = result.get(row.videoId) ?? [];
      list.push(row.name);
      result.set(row.videoId, list);
    }
    return result;
  }
}
