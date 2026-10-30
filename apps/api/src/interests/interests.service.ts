import { Injectable } from '@nestjs/common';
import { tags, userTagInterests, videoTags } from '@uiliuili/db';
import { type TagInterest } from '@uiliuili/shared';
import { desc, eq, sql } from 'drizzle-orm';
import { DatabaseService } from '../common/database.service';
import { SettingsService } from '../common/settings.service';

/**
 * Stores and reads the decayed tag affinity learned from a user's recent watch
 * history. Scores only exist for the owning user.
 */
@Injectable()
export class InterestsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly settings: SettingsService,
  ) {}

  async top(userId: string, limit?: number): Promise<TagInterest[]> {
    const recommendation = await this.settings.getRecommendationSettings();
    const config = (recommendation.tagAffinity ?? {}) as Record<string, unknown>;
    const configured = Number(config.maxTags ?? 8);
    const take = Math.min(50, Math.max(1, Number(limit ?? configured) || 8));
    const rows = await this.database.db
      .select({
        tagId: tags.id,
        name: tags.name,
        slug: tags.slug,
        score: userTagInterests.score,
        lastSeenAt: userTagInterests.lastSeenAt,
      })
      .from(userTagInterests)
      .innerJoin(tags, eq(tags.id, userTagInterests.tagId))
      .where(eq(userTagInterests.userId, userId))
      .orderBy(desc(userTagInterests.score))
      .limit(take);
    return rows.map((row) => ({
      tagId: row.tagId,
      name: row.name,
      slug: row.slug,
      score: Number(row.score),
      lastSeenAt: row.lastSeenAt.toISOString(),
    }));
  }

  /**
   * Adds one watch to every tag of the video. Older affinity for the same tag
   * decays per hit so recent interests dominate.
   */
  async recordWatch(userId: string, videoId: string, weight: number): Promise<void> {
    const rows = await this.database.db
      .select({ tagId: videoTags.tagId })
      .from(videoTags)
      .where(eq(videoTags.videoId, videoId));
    if (rows.length === 0) return;
    const score = Math.max(0.01, Math.min(5, weight));
    await this.database.db
      .insert(userTagInterests)
      .values(rows.map((row) => ({ userId, tagId: row.tagId, score, lastSeenAt: new Date() })))
      .onConflictDoUpdate({
        target: [userTagInterests.userId, userTagInterests.tagId],
        set: {
          score: sql`${userTagInterests.score} * 0.9 + excluded.score`,
          lastSeenAt: new Date(),
          updatedAt: new Date(),
        },
      });
  }

  async remove(userId: string, tagId: string): Promise<void> {
    await this.database.db
      .delete(userTagInterests)
      .where(sql`${userTagInterests.userId} = ${userId} AND ${userTagInterests.tagId} = ${tagId}`);
  }

  async clear(userId: string): Promise<void> {
    await this.database.db.delete(userTagInterests).where(eq(userTagInterests.userId, userId));
  }
}
