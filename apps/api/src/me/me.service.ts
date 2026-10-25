import { Injectable } from '@nestjs/common';
import {
  blocks,
  categories,
  coinLedger,
  favoriteFolders,
  favoriteItems,
  followGroups,
  follows,
  users,
  videos,
  watchHistories,
  watchLater,
} from '@uiliuili/db';
import { AppError, ERROR_CODES } from '@uiliuili/shared';
import { and, count, desc, eq, isNull, lte, sql } from 'drizzle-orm';
import type { AuthUser } from '../common/auth-user';
import { DatabaseService } from '../common/database.service';
import { SettingsService } from '../common/settings.service';
import { publicUser, videoCard } from '../videos/video.helpers';
import { VideosService } from '../videos/videos.service';

@Injectable()
export class MeService {
  constructor(
    private readonly database: DatabaseService,
    private readonly settings: SettingsService,
    private readonly videos: VideosService,
  ) {}

  async history(userId: string, page: number, limit: number) {
    const offset = (page - 1) * limit;
    const rows = await this.database.db
      .select({
        video: videos,
        uploader: users,
        category: categories,
        progressMs: watchHistories.positionMs,
        durationMs: watchHistories.durationMs,
        completed: watchHistories.completed,
        watchedAt: watchHistories.updatedAt,
      })
      .from(watchHistories)
      .innerJoin(videos, eq(videos.id, watchHistories.videoId))
      .innerJoin(users, eq(users.id, videos.uploaderId))
      .leftJoin(categories, eq(categories.id, videos.categoryId))
      .where(
        and(
          eq(watchHistories.userId, userId),
          eq(videos.status, 'published'),
          isNull(videos.deletedAt),
          eq(videos.visibility, 'public'),
        ),
      )
      .orderBy(desc(watchHistories.updatedAt))
      .limit(limit)
      .offset(offset);
    const tagsByVideo = await this.videos.tagsFor(rows.map((row) => row.video.id));
    return {
      items: rows.map((row) => ({
        video: videoCard(row, tagsByVideo.get(row.video.id) ?? []),
        progressMs: row.progressMs,
        durationMs: row.durationMs,
        completed: row.completed,
        watchedAt: row.watchedAt.toISOString(),
      })),
      page,
      limit,
    };
  }

  async favorites(userId: string, folderId?: string) {
    const folders = await this.folderList(userId);
    const requested = folderId ? folders.find((folder) => folder.id === folderId) : undefined;
    const active =
      requested?.id ?? folders.find((folder) => folder.isDefault)?.id ?? folders[0]?.id;
    if (!active) return { folders, folderId: null, items: [] };
    const rows = await this.database.db
      .select({ video: videos, uploader: users, category: categories })
      .from(favoriteItems)
      .innerJoin(videos, eq(videos.id, favoriteItems.videoId))
      .innerJoin(users, eq(users.id, videos.uploaderId))
      .leftJoin(categories, eq(categories.id, videos.categoryId))
      .where(
        and(
          eq(favoriteItems.folderId, active),
          eq(videos.status, 'published'),
          isNull(videos.deletedAt),
          eq(videos.visibility, 'public'),
        ),
      )
      .orderBy(desc(favoriteItems.createdAt))
      .limit(100);
    const tagsByVideo = await this.videos.tagsFor(rows.map((row) => row.video.id));
    return {
      folders,
      folderId: active,
      items: rows.map((row) => videoCard(row, tagsByVideo.get(row.video.id) ?? [])),
    };
  }

  async createFolder(
    userId: string,
    input: { name: string; description?: string; isPublic?: boolean },
  ) {
    const social = await this.settings.getSocialSettings();
    const [row] = await this.database.db
      .select({ value: count() })
      .from(favoriteFolders)
      .where(eq(favoriteFolders.userId, userId));
    if (Number(row?.value ?? 0) >= Number(social.maxFavoriteFolders ?? 20)) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '收藏夹数量已达上限', 400);
    }
    const [created] = await this.database.db
      .insert(favoriteFolders)
      .values({
        userId,
        name: input.name.trim().slice(0, 40),
        description: (input.description ?? '').slice(0, 500),
        isPublic: input.isPublic ?? false,
        isDefault: false,
      })
      .returning();
    return created;
  }

  async updateFolder(
    userId: string,
    folderId: string,
    input: { name?: string; description?: string; isPublic?: boolean },
  ) {
    const rows = await this.database.db
      .select()
      .from(favoriteFolders)
      .where(and(eq(favoriteFolders.id, folderId), eq(favoriteFolders.userId, userId)))
      .limit(1);
    if (!rows[0]) throw new AppError(ERROR_CODES.NOT_FOUND, '收藏夹不存在', 404);
    const [updated] = await this.database.db
      .update(favoriteFolders)
      .set({
        name: input.name?.trim().slice(0, 40),
        description: input.description?.slice(0, 500),
        isPublic: input.isPublic,
      })
      .where(eq(favoriteFolders.id, folderId))
      .returning();
    return updated;
  }

  async watchLater(userId: string) {
    const rows = await this.database.db
      .select({ video: videos, uploader: users, category: categories })
      .from(watchLater)
      .innerJoin(videos, eq(videos.id, watchLater.videoId))
      .innerJoin(users, eq(users.id, videos.uploaderId))
      .leftJoin(categories, eq(categories.id, videos.categoryId))
      .where(
        and(
          eq(watchLater.userId, userId),
          eq(videos.status, 'published'),
          eq(videos.visibility, 'public'),
          isNull(videos.deletedAt),
        ),
      )
      .orderBy(desc(watchLater.createdAt))
      .limit(100);
    const tagsByVideo = await this.videos.tagsFor(rows.map((row) => row.video.id));
    return {
      items: rows.map((row) => videoCard(row, tagsByVideo.get(row.video.id) ?? [])),
    };
  }

  async followGroups(userId: string) {
    const [groups, followRows] = await Promise.all([
      this.database.db
        .select()
        .from(followGroups)
        .where(eq(followGroups.userId, userId))
        .orderBy(followGroups.sort, followGroups.createdAt),
      this.database.db
        .select({ user: users, groupId: follows.groupId, followedAt: follows.createdAt })
        .from(follows)
        .innerJoin(users, eq(users.id, follows.followingId))
        .where(eq(follows.followerId, userId))
        .orderBy(desc(follows.createdAt)),
    ]);
    const countMap = new Map<string, number>();
    for (const row of followRows) {
      if (row.groupId) countMap.set(row.groupId, (countMap.get(row.groupId) ?? 0) + 1);
    }
    return {
      groups: groups.map((group) => ({
        id: group.id,
        name: group.name,
        sort: group.sort,
        count: countMap.get(group.id) ?? 0,
        createdAt: group.createdAt.toISOString(),
      })),
      items: followRows.map((row) => ({
        user: publicUser(row.user),
        groupId: row.groupId,
        followedAt: row.followedAt.toISOString(),
      })),
    };
  }

  async createFollowGroup(userId: string, input: { name: string; sort?: number }) {
    const [row] = await this.database.db
      .select({ value: count() })
      .from(followGroups)
      .where(eq(followGroups.userId, userId));
    if (Number(row?.value ?? 0) >= 20) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '分组数量已达上限', 400);
    }
    const [created] = await this.database.db
      .insert(followGroups)
      .values({ userId, name: input.name.trim().slice(0, 20), sort: input.sort ?? 0 })
      .returning();
    return created;
  }

  async deleteFollowGroup(userId: string, groupId: string) {
    await this.database.db
      .delete(followGroups)
      .where(and(eq(followGroups.id, groupId), eq(followGroups.userId, userId)));
    return { ok: true };
  }

  async assignFollowGroup(userId: string, targetId: string, groupId?: string | null) {
    if (groupId) {
      const rows = await this.database.db
        .select({ id: followGroups.id })
        .from(followGroups)
        .where(and(eq(followGroups.id, groupId), eq(followGroups.userId, userId)))
        .limit(1);
      if (!rows[0]) throw new AppError(ERROR_CODES.NOT_FOUND, '分组不存在', 404);
    }
    await this.database.db
      .update(follows)
      .set({ groupId: groupId ?? null })
      .where(and(eq(follows.followerId, userId), eq(follows.followingId, targetId)));
    return { ok: true };
  }

  async deleteFolder(userId: string, folderId: string) {
    const rows = await this.database.db
      .select()
      .from(favoriteFolders)
      .where(and(eq(favoriteFolders.id, folderId), eq(favoriteFolders.userId, userId)))
      .limit(1);
    const folder = rows[0];
    if (!folder) throw new AppError(ERROR_CODES.NOT_FOUND, '收藏夹不存在', 404);
    if (folder.isDefault) throw new AppError(ERROR_CODES.BAD_REQUEST, '默认收藏夹不能删除', 400);
    await this.database.db.delete(favoriteFolders).where(eq(favoriteFolders.id, folderId));
    return { ok: true };
  }

  async addFavorite(userId: string, folderId: string, videoId: string) {
    const rows = await this.database.db
      .select()
      .from(favoriteFolders)
      .where(and(eq(favoriteFolders.id, folderId), eq(favoriteFolders.userId, userId)))
      .limit(1);
    if (!rows[0]) throw new AppError(ERROR_CODES.NOT_FOUND, '收藏夹不存在', 404);
    const inserted = await this.database.db
      .insert(favoriteItems)
      .values({ folderId, videoId })
      .onConflictDoNothing()
      .returning({ videoId: favoriteItems.videoId });
    if (inserted.length > 0) {
      await this.database.db
        .update(videos)
        .set({ favoriteCount: sql`${videos.favoriteCount} + 1` })
        .where(eq(videos.id, videoId));
    }
    return { ok: true };
  }

  async removeFavorite(userId: string, folderId: string, videoId: string) {
    const rows = await this.database.db
      .select()
      .from(favoriteFolders)
      .where(and(eq(favoriteFolders.id, folderId), eq(favoriteFolders.userId, userId)))
      .limit(1);
    if (!rows[0]) throw new AppError(ERROR_CODES.NOT_FOUND, '收藏夹不存在', 404);
    const deleted = await this.database.db
      .delete(favoriteItems)
      .where(and(eq(favoriteItems.folderId, folderId), eq(favoriteItems.videoId, videoId)))
      .returning({ videoId: favoriteItems.videoId });
    if (deleted.length > 0) {
      await this.database.db
        .update(videos)
        .set({ favoriteCount: sql`GREATEST(0, ${videos.favoriteCount} - 1)` })
        .where(eq(videos.id, videoId));
    }
    return { ok: true };
  }

  async followingUsers(userId: string) {
    const rows = await this.database.db
      .select({ user: users })
      .from(follows)
      .innerJoin(users, eq(users.id, follows.followingId))
      .where(eq(follows.followerId, userId))
      .orderBy(desc(follows.createdAt));
    return { items: rows.map((row) => publicUser(row.user)) };
  }

  async blocked(userId: string) {
    const rows = await this.database.db
      .select({ user: users })
      .from(blocks)
      .innerJoin(users, eq(users.id, blocks.blockedUserId))
      .where(eq(blocks.userId, userId))
      .orderBy(desc(blocks.createdAt));
    return { items: rows.map((row) => publicUser(row.user)) };
  }

  async block(user: AuthUser, targetId: string) {
    if (user.id === targetId) throw new AppError(ERROR_CODES.BAD_REQUEST, '不能屏蔽自己', 400);
    await this.database.db
      .insert(blocks)
      .values({ userId: user.id, blockedUserId: targetId })
      .onConflictDoNothing();
    return { blocked: true };
  }

  async unblock(user: AuthUser, targetId: string) {
    await this.database.db
      .delete(blocks)
      .where(and(eq(blocks.userId, user.id), eq(blocks.blockedUserId, targetId)));
    return { blocked: false };
  }

  async coinLedger(userId: string, page: number, limit: number) {
    const offset = (page - 1) * limit;
    const rows = await this.database.db
      .select()
      .from(coinLedger)
      .where(eq(coinLedger.userId, userId))
      .orderBy(desc(coinLedger.createdAt))
      .limit(limit)
      .offset(offset);
    return {
      items: rows.map((row) => ({
        id: row.id,
        amount: row.amount,
        reason: row.reason,
        videoId: row.videoId,
        createdAt: row.createdAt.toISOString(),
      })),
      page,
      limit,
    };
  }

  private async folderList(userId: string) {
    const rows = await this.database.db
      .select({
        id: favoriteFolders.id,
        name: favoriteFolders.name,
        description: favoriteFolders.description,
        isPublic: favoriteFolders.isPublic,
        isDefault: favoriteFolders.isDefault,
        createdAt: favoriteFolders.createdAt,
      })
      .from(favoriteFolders)
      .where(eq(favoriteFolders.userId, userId))
      .orderBy(desc(favoriteFolders.isDefault), favoriteFolders.createdAt);
    const counts = await this.database.db
      .select({ folderId: favoriteItems.folderId, value: count() })
      .from(favoriteItems)
      .innerJoin(favoriteFolders, eq(favoriteFolders.id, favoriteItems.folderId))
      .where(eq(favoriteFolders.userId, userId))
      .groupBy(favoriteItems.folderId);
    const countMap = new Map(counts.map((item) => [item.folderId, Number(item.value)]));
    return rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      count: countMap.get(row.id) ?? 0,
    }));
  }
}
