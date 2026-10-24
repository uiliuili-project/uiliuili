import { Injectable } from '@nestjs/common';
import { follows, notifications, users, videos } from '@uiliuili/db';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import type { AuthUser } from '../common/auth-user';
import { DatabaseService } from '../common/database.service';

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  coverUrl: string | null;
  bio: string;
  level: number;
  createdAt: string;
  roles: string[];
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
    const [videoCount, followerCount, followingCount, following] = await Promise.all([
      this.database.db
        .select({ value: count() })
        .from(videos)
        .where(
          and(
            eq(videos.uploaderId, user.id),
            eq(videos.status, 'published'),
            eq(videos.visibility, 'public'),
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
    ]);
    return {
      user,
      stats: {
        videos: Number(videoCount[0]?.value ?? 0),
        followers: Number(followerCount[0]?.value ?? 0),
        following: Number(followingCount[0]?.value ?? 0),
      },
      following: following.length > 0,
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
    await this.database.db
      .insert(follows)
      .values({ followerId: viewer.id, followingId: targetId })
      .onConflictDoNothing();
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
    await this.database.db
      .delete(follows)
      .where(and(eq(follows.followerId, viewer.id), eq(follows.followingId, targetId)));
    return { following: false };
  }

  private toProfile(user: typeof users.$inferSelect): UserProfile {
    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      coverUrl: user.coverUrl,
      bio: user.bio,
      level: user.level,
      createdAt: user.createdAt.toISOString(),
      roles: user.roles,
    };
  }
}
