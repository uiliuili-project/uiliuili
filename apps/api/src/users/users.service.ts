import { Injectable } from '@nestjs/common';
import {
  blocks,
  categories,
  favoriteFolders,
  favoriteItems,
  followEvents,
  follows,
  notifications,
  tags,
  users,
  videoTags,
  videos,
} from '@uiliuili/db';
import { AppError, ERROR_CODES } from '@uiliuili/shared';
import { and, count, desc, eq, inArray, isNull, lte, sql } from 'drizzle-orm';
import type { AuthUser } from '../common/auth-user';
import { DatabaseService } from '../common/database.service';
import { badgesForUser } from '../common/experience';
import { currentRegionContext, videoRegionCondition } from '../common/region-context';
import { videoCard } from '../videos/video.helpers';

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string;
  level: number;
  experience: number;
  badges?: Awaited<ReturnType<typeof badgesForUser>>;
  createdAt: string;
  roles: string[];
  /** Latest network country, shown as the profile IP location. */
  lastRegion: string | null;
}

@Injectable()
export class UsersService {
  constructor(private readonly database: DatabaseService) {}

  async byUsername(username: string): Promise<UserProfile | null> {
    const rows = await this.database.db
      .select()
      .from(users)
      .where(sql`lower(${users.username}) = ${username.toLowerCase()}`)
      .limit(1);
    const user = rows[0];
    if (!user) return null;
    return this.toProfile(user);
  }

  async byId(id: string): Promise<UserProfile | null> {
    const rows = await this.database.db.select().from(users).where(eq(users.id, id)).limit(1);
    const user = rows[0];
    return user ? this.toProfile(user) : null;
  }

  async profile(username: string, viewer?: AuthUser) {
    const user = await this.byUsername(username);
    if (!user) return null;
    const [videoCount, followerCount, followingCount, following, blocked] = await Promise.all([
      this.database.db
        .select({ value: count() })
        .from(videos)
        .where(
          and(
            eq(videos.uploaderId, user.id),
            eq(videos.status, 'published'),
            eq(videos.visibility, 'public'),
            lte(videos.publishedAt, new Date()),
            videoRegionCondition(),
          ),
        ),
      this.database.db
        .select({ value: count() })
        .from(follows)
        .where(eq(follows.followingId, user.id)),
      this.database.db
        .select({ value: count() })
        .from(follows)
        .where(eq(follows.followerId, user.id)),
      viewer
        ? this.database.db
            .select({ followerId: follows.followerId })
            .from(follows)
            .where(and(eq(follows.followerId, viewer.id), eq(follows.followingId, user.id)))
            .limit(1)
        : Promise.resolve([]),
      viewer
        ? this.database.db
            .select({ userId: blocks.userId })
            .from(blocks)
            .where(and(eq(blocks.userId, viewer.id), eq(blocks.blockedUserId, user.id)))
            .limit(1)
        : Promise.resolve([]),
    ]);
    return {
      user,
      stats: {
        videos: Number(videoCount[0]?.value ?? 0),
        followers: Number(followerCount[0]?.value ?? 0),
        following: Number(followingCount[0]?.value ?? 0),
      },
      following: following.length > 0,
      blocked: blocked.length > 0,
      isSelf: viewer?.id === user.id,
    };
  }

  async followers(username: string, page = 1, limit = 20) {
    const user = await this.byUsername(username);
    if (!user) return { items: [], total: 0 };
    const offset = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.database.db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          bio: users.bio,
          level: users.level,
          createdAt: users.createdAt,
        })
        .from(follows)
        .innerJoin(users, eq(users.id, follows.followerId))
        .where(eq(follows.followingId, user.id))
        .orderBy(desc(follows.createdAt))
        .limit(limit)
        .offset(offset),
      this.database.db
        .select({ value: count() })
        .from(follows)
        .where(eq(follows.followingId, user.id)),
    ]);
    return {
      items: items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
      total: Number(total[0]?.value ?? 0),
    };
  }

  async following(username: string, page = 1, limit = 20) {
    const user = await this.byUsername(username);
    if (!user) return { items: [], total: 0 };
    const offset = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.database.db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          bio: users.bio,
          level: users.level,
          createdAt: users.createdAt,
        })
        .from(follows)
        .innerJoin(users, eq(users.id, follows.followingId))
        .where(eq(follows.followerId, user.id))
        .orderBy(desc(follows.createdAt))
        .limit(limit)
        .offset(offset),
      this.database.db
        .select({ value: count() })
        .from(follows)
        .where(eq(follows.followerId, user.id)),
    ]);
    return {
      items: items.map((item) => ({ ...item, createdAt: item.createdAt.toISOString() })),
      total: Number(total[0]?.value ?? 0),
    };
  }

  async follow(viewer: AuthUser, targetId: string) {
    if (viewer.id === targetId) throw new Error('不能关注自己');
    const target = await this.byId(targetId);
    if (!target) throw new Error('用户不存在');
    const inserted = await this.database.db
      .insert(follows)
      .values({ followerId: viewer.id, followingId: targetId })
      .onConflictDoNothing()
      .returning({ followerId: follows.followerId });
    if (inserted.length > 0) {
      await this.database.db.insert(followEvents).values({
        followerId: viewer.id,
        followingId: targetId,
        eventType: 'follow',
      });
    }
    if (viewer.id !== targetId) {
      await this.database.db.insert(notifications).values({
        userId: targetId,
        actorId: viewer.id,
        type: 'follow',
        title: `${viewer.displayName} 关注了你`,
        body: '',
        link: `/space/${viewer.username}`,
      });
    }
    return { following: true };
  }

  async unfollow(viewer: AuthUser, targetId: string) {
    const removed = await this.database.db
      .delete(follows)
      .where(and(eq(follows.followerId, viewer.id), eq(follows.followingId, targetId)))
      .returning({ followerId: follows.followerId });
    if (removed.length > 0) {
      await this.database.db.insert(followEvents).values({
        followerId: viewer.id,
        followingId: targetId,
        eventType: 'unfollow',
      });
    }
    return { following: false };
  }

  private async toProfile(user: typeof users.$inferSelect): Promise<UserProfile> {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      coverUrl: user.coverUrl,
      bio: user.bio,
      level: user.level,
      experience: user.experience,
      badges: await badgesForUser(this.database.db, user.id),
      createdAt: user.createdAt.toISOString(),
      roles: user.roles,
      lastRegion: currentRegionContext().ipLocationEnabled ? user.lastRegion : null,
    };
  }

  async publicFavorites(username: string, folderId?: string) {
    const rows = await this.database.db
      .select()
      .from(users)
      .where(sql`lower(${users.username}) = ${username.toLowerCase()}`)
      .limit(1);
    const owner = rows[0];
    if (!owner) throw new AppError(ERROR_CODES.NOT_FOUND, '用户不存在', 404);
    const folders = await this.database.db
      .select({
        id: favoriteFolders.id,
        name: favoriteFolders.name,
        description: favoriteFolders.description,
        count: count(favoriteItems.videoId),
      })
      .from(favoriteFolders)
      .leftJoin(favoriteItems, eq(favoriteItems.folderId, favoriteFolders.id))
      .where(and(eq(favoriteFolders.userId, owner.id), eq(favoriteFolders.isPublic, true)))
      .groupBy(favoriteFolders.id)
      .orderBy(desc(favoriteFolders.createdAt));
    const active = folderId ? folders.find((folder) => folder.id === folderId) : folders[0];
    if (!active) return { folders: [], folderId: null, items: [] };
    const itemRows = await this.database.db
      .select({ video: videos, uploader: users, category: categories })
      .from(favoriteItems)
      .innerJoin(videos, eq(videos.id, favoriteItems.videoId))
      .innerJoin(users, eq(users.id, videos.uploaderId))
      .leftJoin(categories, eq(categories.id, videos.categoryId))
      .where(
        and(
          eq(favoriteItems.folderId, active.id),
          eq(videos.status, 'published'),
          eq(videos.visibility, 'public'),
          isNull(videos.deletedAt),
          lte(videos.publishedAt, new Date()),
          videoRegionCondition(),
        ),
      )
      .orderBy(desc(favoriteItems.createdAt))
      .limit(100);
    const tagsByVideo = new Map<string, string[]>();
    const ids = itemRows.map((row) => row.video.id);
    if (ids.length > 0) {
      const tagRows = await this.database.db
        .select({ videoId: videoTags.videoId, name: tags.name })
        .from(videoTags)
        .innerJoin(tags, eq(tags.id, videoTags.tagId))
        .where(inArray(videoTags.videoId, ids));
      for (const row of tagRows) {
        const list = tagsByVideo.get(row.videoId) ?? [];
        list.push(row.name);
        tagsByVideo.set(row.videoId, list);
      }
    }
    return {
      folders: folders.map((folder) => ({ ...folder, count: Number(folder.count) })),
      folderId: active.id,
      items: itemRows.map((row) => videoCard(row, tagsByVideo.get(row.video.id) ?? [])),
    };
  }
}
