import { Injectable } from '@nestjs/common';
import {
  blocks,
  categories,
  follows,
  userFeedbacks,
  users,
  videos,
  watchHistories,
} from '@uiliuili/db';
import { and, desc, eq, isNull, lte, ne } from 'drizzle-orm';
import type { AuthUser } from '../common/auth-user';
import { DatabaseService } from '../common/database.service';
import { SettingsService } from '../common/settings.service';
import { videoCard } from '../videos/video.helpers';
import { VideosService } from '../videos/videos.service';

@Injectable()
export class FeedsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly videos: VideosService,
    private readonly settings: SettingsService,
  ) {}

  async home(viewer?: AuthUser) {
    const [trending, newest, categoryRows] = await Promise.all([
      this.videos.list({ limit: 12, sort: 'hot' }),
      this.videos.list({ limit: 12, sort: 'new' }),
      this.videos.getCategories(),
    ]);
    let recommended = trending;
    let continueWatching: Awaited<ReturnType<FeedsService['continueWatching']>> = {
      items: [],
    };
    if (viewer) {
      const [watched, blocked, feedback, latest] = await Promise.all([
        this.database.db
          .select({ videoId: watchHistories.videoId })
          .from(watchHistories)
          .where(eq(watchHistories.userId, viewer.id))
          .orderBy(desc(watchHistories.updatedAt))
          .limit(100),
        this.database.db
          .select({ userId: blocks.blockedUserId })
          .from(blocks)
          .where(eq(blocks.userId, viewer.id)),
        this.database.db
          .select({ videoId: userFeedbacks.videoId })
          .from(userFeedbacks)
          .where(eq(userFeedbacks.userId, viewer.id)),
        this.database.db
          .select({ slug: categories.slug })
          .from(watchHistories)
          .innerJoin(videos, eq(videos.id, watchHistories.videoId))
          .leftJoin(categories, eq(categories.id, videos.categoryId))
          .where(eq(watchHistories.userId, viewer.id))
          .orderBy(desc(watchHistories.updatedAt))
          .limit(1),
      ]);
      const excluded = [
        ...new Set([
          ...watched.map((item) => item.videoId),
          ...feedback.map((item) => item.videoId),
        ]),
      ];
      const excludeUploaderIds = blocked.map((item) => item.userId);
      const category = latest[0]?.slug ?? undefined;
      const personalized = await this.videos.list({
        limit: 12,
        sort: 'recommended',
        category,
        excludeIds: excluded,
        excludeUploaderIds,
      });
      if (personalized.items.length > 0) recommended = personalized;
      continueWatching = await this.continueWatching(viewer.id);
    }
    return {
      sections: {
        recommended,
        trending,
        newest,
        continueWatching,
      },
      categories: categoryRows,
      explorationRatio: (await this.settings.getRecommendationSettings()).explorationRatio,
    };
  }

  async following(user: AuthUser, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const rows = await this.database.db
      .select({ video: videos, uploader: users, category: categories })
      .from(follows)
      .innerJoin(videos, eq(videos.uploaderId, follows.followingId))
      .innerJoin(users, eq(users.id, videos.uploaderId))
      .leftJoin(categories, eq(categories.id, videos.categoryId))
      .where(
        and(
          eq(follows.followerId, user.id),
          eq(videos.status, 'published'),
          eq(videos.visibility, 'public'),
          isNull(videos.deletedAt),
          lte(videos.publishedAt, new Date()),
        ),
      )
      .orderBy(desc(videos.publishedAt))
      .limit(limit)
      .offset(offset);
    const tagsByVideo = await this.videos.tagsFor(rows.map((row) => row.video.id));
    return {
      items: rows.map((row) => videoCard(row, tagsByVideo.get(row.video.id) ?? [])),
      page,
      limit,
      hasMore: rows.length === limit,
    };
  }

  async continueWatching(userId: string) {
    const rows = await this.database.db
      .select({ video: videos, uploader: users, category: categories })
      .from(watchHistories)
      .innerJoin(videos, eq(videos.id, watchHistories.videoId))
      .innerJoin(users, eq(users.id, videos.uploaderId))
      .leftJoin(categories, eq(categories.id, videos.categoryId))
      .where(
        and(
          eq(watchHistories.userId, userId),
          eq(watchHistories.completed, false),
          eq(videos.status, 'published'),
          eq(videos.visibility, 'public'),
          isNull(videos.deletedAt),
        ),
      )
      .orderBy(desc(watchHistories.updatedAt))
      .limit(8);
    const tagsByVideo = await this.videos.tagsFor(rows.map((row) => row.video.id));
    return {
      items: rows.map((row) => videoCard(row, tagsByVideo.get(row.video.id) ?? [])),
    };
  }

  async popular() {
    return this.videos.list({ limit: 24, sort: 'hot' });
  }
}
