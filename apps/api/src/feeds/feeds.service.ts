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
import { and, count, desc, eq, isNull, lte } from 'drizzle-orm';
import type { AuthUser } from '../common/auth-user';
import { DatabaseService } from '../common/database.service';
import { videoRegionCondition } from '../common/region-context';
import { SettingsService } from '../common/settings.service';
import { InterestsService } from '../interests/interests.service';
import { videoCard } from '../videos/video.helpers';
import { VideosService } from '../videos/videos.service';

@Injectable()
export class FeedsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly videos: VideosService,
    private readonly settings: SettingsService,
    private readonly interests: InterestsService,
  ) {}

  async home(viewer?: AuthUser) {
    const [trending, newest, categoryRows, recommendationSettings] = await Promise.all([
      this.videos.list({ limit: 12, sort: 'hot' }),
      this.videos.list({ limit: 12, sort: 'new' }),
      this.videos.getCategories(),
      this.settings.getRecommendationSettings(),
    ]);
    let recommended = trending;
    let continueWatching: Awaited<ReturnType<FeedsService['continueWatching']>> = {
      items: [],
    };
    if (viewer) {
      const [watched, blocked, feedback, interests] = await Promise.all([
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
          .select({ slug: categories.slug, value: count() })
          .from(watchHistories)
          .innerJoin(videos, eq(videos.id, watchHistories.videoId))
          .innerJoin(categories, eq(categories.id, videos.categoryId))
          .where(eq(watchHistories.userId, viewer.id))
          .groupBy(categories.slug)
          .orderBy(desc(count()))
          .limit(3),
      ]);
      const excluded = [
        ...new Set([
          ...watched.map((item) => item.videoId),
          ...feedback.map((item) => item.videoId),
        ]),
      ];
      const excludeUploaderIds = blocked.map((item) => item.userId);
      const slugs = interests.map((item) => item.slug).filter(Boolean);
      const tagConfig = (recommendationSettings.tagAffinity ?? {}) as Record<string, unknown>;
      const tagEnabled = tagConfig.enabled !== false;
      const tagRatio = Math.min(0.8, Math.max(0, Number(tagConfig.ratio ?? 0.35)));
      const tagWeight = Math.max(0, Number(tagConfig.weight ?? 0.6));
      const tagInterests = tagEnabled ? await this.interests.top(viewer.id, 8) : [];
      const tagIds = tagInterests.map((item) => item.tagId);
      const affinityOptions = {
        interestUserId: viewer.id,
        interestTagIds: tagIds,
        interestWeight: tagWeight,
      };
      const [pools, tagPools] = await Promise.all([
        Promise.all(
          slugs.map((slug) =>
            this.videos.list(
              {
                limit: 8,
                sort: 'recommended',
                category: slug,
                excludeIds: excluded,
                excludeUploaderIds,
              },
              affinityOptions,
            ),
          ),
        ),
        Promise.all(
          tagInterests.slice(0, 4).map((tag) =>
            this.videos.list(
              {
                limit: 6,
                sort: 'recommended',
                tag: tag.name,
                excludeIds: excluded,
                excludeUploaderIds,
              },
              affinityOptions,
            ),
          ),
        ),
      ]);
      const exploration = await this.videos.list({
        limit: 8,
        sort: 'hot',
        excludeIds: excluded,
        excludeUploaderIds,
      });
      const seen = new Set<string>();
      const blended: typeof recommended.items = [];
      const take = (items: typeof recommended.items, count = 1) => {
        let remaining = count;
        for (const item of items) {
          if (remaining <= 0) break;
          if (seen.has(item.id)) continue;
          seen.add(item.id);
          blended.push(item);
          remaining -= 1;
        }
      };
      const explorationRatio = Math.min(
        0.5,
        Math.max(0, Number(recommendationSettings.explorationRatio ?? 0.15)),
      );
      const explorationCount = Math.round(12 * explorationRatio);
      // Tag pools come first so learned interests shape the feed, then category
      // pools keep it from collapsing into one topic, and exploration stays last.
      const tagSlots = Math.round(12 * tagRatio);
      for (let round = 0; round < 6 && blended.length < tagSlots; round += 1) {
        for (const pool of tagPools) {
          if (blended.length >= tagSlots) break;
          take(pool.items.slice(round, round + 1));
        }
      }
      const categoryTarget = Math.max(0, 12 - explorationCount);
      for (let round = 0; round < 8 && blended.length < categoryTarget; round += 1) {
        for (const pool of pools) {
          if (blended.length >= categoryTarget) break;
          take(pool.items.slice(round, round + 1));
        }
      }
      take(exploration.items, explorationCount);
      take(exploration.items, Math.max(0, 12 - blended.length));
      if (blended.length > 0) recommended = { items: blended.slice(0, 12), nextCursor: null };
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
      explorationRatio: recommendationSettings.explorationRatio,
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
          videoRegionCondition(),
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
          lte(videos.publishedAt, new Date()),
          videoRegionCondition(),
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
