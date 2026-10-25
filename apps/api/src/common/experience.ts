import {
  comments,
  danmaku,
  favoriteFolders,
  favoriteItems,
  userBadges,
  users,
  videos,
} from '@uiliuili/db';
import { BADGES, type BadgeCode, type UserBadge, levelForExperience } from '@uiliuili/shared';
import { and, count, eq, isNull, sum } from 'drizzle-orm';
import type { DatabaseService } from './database.service';

type Db = DatabaseService['db'];

/**
 * Adds experience to a user and recalculates their level. Levels are derived
 * from experience, so the legacy manually assigned level is kept in sync.
 */
export async function grantExperience(
  db: Db,
  userId: string,
  amount: number,
): Promise<{ experience: number; level: number }> {
  const [user] = await db
    .select({ experience: users.experience })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return { experience: 0, level: 0 };
  const experience = Math.max(0, user.experience + Math.max(0, Math.round(amount)));
  const level = levelForExperience(experience);
  await db.update(users).set({ experience, level }).where(eq(users.id, userId));
  await syncBadges(db, userId);
  return { experience, level };
}

/** Recalculates which static badges a user should hold. */
export async function syncBadges(db: Db, userId: string): Promise<void> {
  const [user] = await db
    .select({ level: users.level, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) return;

  const [videoRows, danmakuRows, commentRows, favoriteRows] = await Promise.all([
    db
      .select({ value: count(), views: sum(videos.viewCount) })
      .from(videos)
      .where(
        and(
          eq(videos.uploaderId, userId),
          eq(videos.status, 'published'),
          isNull(videos.deletedAt),
        ),
      ),
    db
      .select({ value: count() })
      .from(danmaku)
      .where(and(eq(danmaku.userId, userId), eq(danmaku.status, 'visible'))),
    db
      .select({ value: count() })
      .from(comments)
      .where(and(eq(comments.userId, userId), eq(comments.status, 'visible'))),
    db
      .select({ value: count() })
      .from(favoriteItems)
      .innerJoin(favoriteFolders, eq(favoriteFolders.id, favoriteItems.folderId))
      .where(eq(favoriteFolders.userId, userId)),
  ]);

  const published = Number(videoRows[0]?.value ?? 0);
  const totalViews = Number(videoRows[0]?.views ?? 0);
  const danmakuCount = Number(danmakuRows[0]?.value ?? 0);
  const commentCount = Number(commentRows[0]?.value ?? 0);
  const favoriteCount = Number(favoriteRows[0]?.value ?? 0);

  const codes: BadgeCode[] = [];
  if (published > 0) codes.push('creator');
  if (totalViews >= 10_000) codes.push('popular');
  if (danmakuCount >= 100) codes.push('danmaku_star');
  if (commentCount >= 50) codes.push('commenter');
  if (favoriteCount >= 50) codes.push('collector');
  if (user.level >= 5) codes.push('level_5');
  if (user.level >= 6) codes.push('level_6');
  if (user.createdAt.getTime() < Date.now() - 365 * 24 * 60 * 60 * 1000) {
    codes.push('early_adopter');
  }

  if (codes.length === 0) return;
  await db
    .insert(userBadges)
    .values(codes.map((code) => ({ userId, code })))
    .onConflictDoNothing();
}

/** Resolves awarded badges into their public label and description. */
export async function badgesForUser(db: Db, userId: string): Promise<UserBadge[]> {
  const rows = await db.select().from(userBadges).where(eq(userBadges.userId, userId));
  const awarded = new Map(rows.map((row) => [row.code, row]));
  return BADGES.filter((badge) => awarded.has(badge.code)).map((badge) => ({
    code: badge.code,
    label: badge.label,
    description: badge.description,
    awardedAt: awarded.get(badge.code)?.awardedAt.toISOString(),
  }));
}
