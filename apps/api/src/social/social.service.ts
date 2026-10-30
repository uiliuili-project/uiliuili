import { Injectable } from '@nestjs/common';
import {
  type DbDynamic,
  type DbUser,
  blocks,
  categories,
  conversations,
  directMessages,
  dynamicLikes,
  dynamics,
  follows,
  pushSubscriptions,
  topics,
  users,
  videoTopics,
  videos,
  watchEvents,
} from '@uiliuili/db';
import {
  AppError,
  type DirectMessageItem,
  type DynamicItem,
  ERROR_CODES,
  type RankingItem,
  type TopicInfo,
  type VideoCard,
} from '@uiliuili/shared';
import { and, count, desc, eq, gte, inArray, isNull, lte, notInArray, or, sql } from 'drizzle-orm';
import type { AuthUser } from '../common/auth-user';
import { DatabaseService } from '../common/database.service';
import { currentRegionContext, videoRegionCondition } from '../common/region-context';
import { decodeCursor, encodeCursor, publicUser, videoCard } from '../videos/video.helpers';
import { VideosService } from '../videos/videos.service';

@Injectable()
export class SocialService {
  constructor(
    private readonly database: DatabaseService,
    private readonly videos: VideosService,
  ) {}

  async dynamicList(
    viewer: AuthUser | undefined,
    query: {
      cursor?: string;
      limit: number;
      feed: 'all' | 'following' | 'user' | 'topic';
      username?: string;
      topicId?: string;
    },
  ) {
    const offset = decodeCursor(query.cursor);
    const conditions = [eq(dynamics.visibility, 'public')];
    if (query.feed === 'following') {
      if (!viewer) return { items: [], nextCursor: null };
      const followingRows = await this.database.db
        .select({ id: follows.followingId })
        .from(follows)
        .where(eq(follows.followerId, viewer.id));
      const ids = followingRows.map((row) => row.id);
      if (ids.length === 0) return { items: [], nextCursor: null };
      conditions.push(inArray(dynamics.userId, ids));
    }
    if (query.feed === 'user' || query.username) {
      const needle = (query.username ?? viewer?.username ?? '').toLowerCase();
      if (!needle) return { items: [], nextCursor: null };
      const owner = await this.database.db
        .select({ id: users.id })
        .from(users)
        .where(sql`lower(${users.username}) = ${needle}`)
        .limit(1);
      if (!owner[0]) return { items: [], nextCursor: null };
      if (viewer?.id !== owner[0].id) conditions.push(eq(dynamics.visibility, 'public'));
      conditions.push(eq(dynamics.userId, owner[0].id));
    }
    if (query.feed === 'topic') {
      if (!query.topicId) return { items: [], nextCursor: null };
      conditions.push(eq(dynamics.topicId, query.topicId));
    }
    const rows = await this.database.db
      .select({ dynamic: dynamics, user: users, topic: topics })
      .from(dynamics)
      .innerJoin(users, eq(users.id, dynamics.userId))
      .leftJoin(topics, eq(topics.id, dynamics.topicId))
      .where(and(...conditions))
      .orderBy(desc(dynamics.createdAt))
      .limit(query.limit)
      .offset(offset);
    const likedSet = viewer
      ? await this.likedDynamics(
          viewer.id,
          rows.map((row) => row.dynamic.id),
        )
      : new Set<string>();
    const videoMap = await this.videoCardsFor(
      rows.map((row) => row.dynamic.videoId).filter((id): id is string => Boolean(id)),
    );
    return {
      items: rows.map((row) =>
        this.toDynamic(
          row.dynamic,
          row.user,
          row.topic,
          row.dynamic.videoId ? (videoMap.get(row.dynamic.videoId) ?? null) : null,
          likedSet.has(row.dynamic.id),
        ),
      ),
      nextCursor: rows.length === query.limit ? encodeCursor(offset + query.limit) : null,
    };
  }

  /** Image-only dynamics for the home waterfall mode. */
  async moments(
    viewer: AuthUser | undefined,
    query: { cursor?: string; limit: number; sort: 'latest' | 'hot' },
  ) {
    const offset = decodeCursor(query.cursor);
    const conditions = [
      eq(dynamics.visibility, 'public'),
      eq(users.banned, false),
      sql`jsonb_array_length(${dynamics.images}) > 0`,
    ];
    if (viewer) {
      const blockedRows = await this.database.db
        .select({ id: blocks.blockedUserId })
        .from(blocks)
        .where(eq(blocks.userId, viewer.id));
      const blockedIds = blockedRows.map((row) => row.id);
      if (blockedIds.length > 0) conditions.push(notInArray(dynamics.userId, blockedIds));
    }
    const rows = await this.database.db
      .select({ dynamic: dynamics, user: users, topic: topics })
      .from(dynamics)
      .innerJoin(users, eq(users.id, dynamics.userId))
      .leftJoin(topics, eq(topics.id, dynamics.topicId))
      .where(and(...conditions))
      .orderBy(
        ...(query.sort === 'hot'
          ? [desc(dynamics.likeCount), desc(dynamics.createdAt)]
          : [desc(dynamics.createdAt)]),
      )
      .limit(query.limit)
      .offset(offset);
    const likedSet = viewer
      ? await this.likedDynamics(
          viewer.id,
          rows.map((row) => row.dynamic.id),
        )
      : new Set<string>();
    const videoMap = await this.videoCardsFor(
      rows.map((row) => row.dynamic.videoId).filter((id): id is string => Boolean(id)),
    );
    return {
      items: rows.map((row) =>
        this.toDynamic(
          row.dynamic,
          row.user,
          row.topic,
          row.dynamic.videoId ? (videoMap.get(row.dynamic.videoId) ?? null) : null,
          likedSet.has(row.dynamic.id),
        ),
      ),
      nextCursor: rows.length === query.limit ? encodeCursor(offset + query.limit) : null,
    };
  }

  async createDynamic(
    viewer: AuthUser,
    input: {
      content: string;
      images: string[];
      videoId?: string;
      topicId?: string;
      visibility: string;
    },
  ) {
    if (input.videoId) {
      const row = await this.videos.getRow(input.videoId);
      this.videos.assertCanView(row.video, viewer);
    }
    if (input.topicId) {
      const topicRows = await this.database.db
        .select({ id: topics.id })
        .from(topics)
        .where(eq(topics.id, input.topicId))
        .limit(1);
      if (!topicRows[0]) throw new AppError(ERROR_CODES.BAD_REQUEST, '话题不存在', 400);
    }
    const [created] = await this.database.db
      .insert(dynamics)
      .values({
        userId: viewer.id,
        content: input.content.trim().slice(0, 2000),
        images: input.images.slice(0, 9),
        ipRegion: currentRegionContext().ipLocationEnabled
          ? currentRegionContext().networkCode || null
          : null,
        videoId: input.videoId ?? null,
        topicId: input.topicId ?? null,
        visibility: input.visibility,
      })
      .returning();
    if (!created) throw new AppError(ERROR_CODES.INTERNAL_ERROR, '发布动态失败', 500);
    if (input.videoId && input.topicId) {
      await this.database.db
        .insert(videoTopics)
        .values({ videoId: input.videoId, topicId: input.topicId })
        .onConflictDoNothing();
    }
    const user = (
      await this.database.db.select().from(users).where(eq(users.id, viewer.id)).limit(1)
    )[0];
    const topic = input.topicId
      ? ((
          await this.database.db.select().from(topics).where(eq(topics.id, input.topicId)).limit(1)
        )[0] ?? null)
      : null;
    const videoMap = await this.videoCardsFor(input.videoId ? [input.videoId] : []);
    return this.toDynamic(
      created,
      user as DbUser,
      topic,
      input.videoId ? (videoMap.get(input.videoId) ?? null) : null,
      false,
    );
  }

  async removeDynamic(viewer: AuthUser, id: string) {
    const rows = await this.database.db.select().from(dynamics).where(eq(dynamics.id, id)).limit(1);
    const dynamic = rows[0];
    if (!dynamic) throw new AppError(ERROR_CODES.NOT_FOUND, '动态不存在', 404);
    if (dynamic.userId !== viewer.id && !viewer.permissions.includes('user:moderate')) {
      throw new AppError(ERROR_CODES.FORBIDDEN, '没有权限删除此动态', 403);
    }
    await this.database.db.delete(dynamics).where(eq(dynamics.id, id));
    return { ok: true };
  }

  async toggleDynamicLike(viewer: AuthUser, id: string, desired: boolean) {
    let liked = false;
    await this.database.db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(dynamicLikes)
        .where(and(eq(dynamicLikes.dynamicId, id), eq(dynamicLikes.userId, viewer.id)))
        .limit(1);
      if (!desired && existing.length > 0) {
        await tx
          .delete(dynamicLikes)
          .where(and(eq(dynamicLikes.dynamicId, id), eq(dynamicLikes.userId, viewer.id)));
        await tx
          .update(dynamics)
          .set({ likeCount: sql`GREATEST(0, ${dynamics.likeCount} - 1)` })
          .where(eq(dynamics.id, id));
      } else if (desired && existing.length === 0) {
        await tx.insert(dynamicLikes).values({ dynamicId: id, userId: viewer.id });
        await tx
          .update(dynamics)
          .set({ likeCount: sql`${dynamics.likeCount} + 1` })
          .where(eq(dynamics.id, id));
        liked = true;
      } else {
        liked = existing.length > 0;
      }
    });
    const [countRow] = await this.database.db
      .select({ value: count() })
      .from(dynamicLikes)
      .where(eq(dynamicLikes.dynamicId, id));
    return { liked, count: Number(countRow?.value ?? 0) };
  }

  async topicsList(query: { limit: number; kind?: string }) {
    const rows = await this.database.db
      .select({
        topic: topics,
        dynamicCount: count(dynamics.id),
      })
      .from(topics)
      .leftJoin(dynamics, eq(dynamics.topicId, topics.id))
      .where(query.kind ? eq(topics.kind, query.kind) : undefined)
      .groupBy(topics.id)
      .orderBy(desc(topics.createdAt))
      .limit(query.limit);
    return {
      items: rows.map((row) => ({
        ...this.toTopic(row.topic),
        dynamicCount: Number(row.dynamicCount),
      })),
    };
  }

  async topicBySlug(slug: string) {
    const rows = await this.database.db
      .select({ topic: topics, dynamicCount: count(dynamics.id) })
      .from(topics)
      .leftJoin(dynamics, eq(dynamics.topicId, topics.id))
      .where(eq(topics.slug, slug))
      .groupBy(topics.id)
      .limit(1);
    const row = rows[0];
    if (!row) throw new AppError(ERROR_CODES.NOT_FOUND, '话题不存在', 404);
    return { ...this.toTopic(row.topic), dynamicCount: Number(row.dynamicCount) };
  }

  async createTopic(input: {
    title: string;
    description: string;
    kind: string;
    coverUrl?: string | null;
    startsAt?: string | null;
    endsAt?: string | null;
  }) {
    const slugBase = input.title
      .trim()
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);
    const slug = `${slugBase || 'topic'}-${Math.random().toString(36).slice(2, 7)}`;
    const [created] = await this.database.db
      .insert(topics)
      .values({
        slug,
        title: input.title.trim().slice(0, 60),
        description: input.description.slice(0, 2000),
        kind: input.kind,
        coverUrl: input.coverUrl ?? null,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
      })
      .returning();
    if (!created) throw new AppError(ERROR_CODES.INTERNAL_ERROR, '创建话题失败', 500);
    return this.toTopic(created);
  }

  async updateTopic(
    id: string,
    input: {
      title?: string;
      description?: string;
      kind?: string;
      coverUrl?: string | null;
      startsAt?: string | null;
      endsAt?: string | null;
    },
  ) {
    const [updated] = await this.database.db
      .update(topics)
      .set({
        title: input.title?.trim().slice(0, 60),
        description: input.description,
        kind: input.kind,
        coverUrl: input.coverUrl,
        startsAt: input.startsAt
          ? new Date(input.startsAt)
          : input.startsAt === null
            ? null
            : undefined,
        endsAt: input.endsAt ? new Date(input.endsAt) : input.endsAt === null ? null : undefined,
      })
      .where(eq(topics.id, id))
      .returning();
    if (!updated) throw new AppError(ERROR_CODES.NOT_FOUND, '话题不存在', 404);
    return this.toTopic(updated);
  }

  async removeTopic(id: string) {
    await this.database.db.delete(topics).where(eq(topics.id, id));
    return { ok: true };
  }

  async conversations(viewer: AuthUser) {
    const rows = await this.database.db
      .select({ conversation: conversations })
      .from(conversations)
      .where(or(eq(conversations.userAId, viewer.id), eq(conversations.userBId, viewer.id)))
      .orderBy(desc(conversations.lastMessageAt))
      .limit(50);
    const items = await Promise.all(
      rows.map(async ({ conversation }) => {
        const otherId =
          conversation.userAId === viewer.id ? conversation.userBId : conversation.userAId;
        const [other] = await this.database.db
          .select()
          .from(users)
          .where(eq(users.id, otherId))
          .limit(1);
        const [last] = await this.database.db
          .select()
          .from(directMessages)
          .where(eq(directMessages.conversationId, conversation.id))
          .orderBy(desc(directMessages.createdAt))
          .limit(1);
        const [unread] = await this.database.db
          .select({ value: count() })
          .from(directMessages)
          .where(
            and(
              eq(directMessages.conversationId, conversation.id),
              eq(directMessages.senderId, otherId),
              isNull(directMessages.readAt),
            ),
          );
        return {
          id: conversation.id,
          user: publicUser(other as DbUser),
          lastMessage: last?.content ?? '',
          lastMessageAt: conversation.lastMessageAt.toISOString(),
          unread: Number(unread?.value ?? 0),
        };
      }),
    );
    return { items };
  }

  async messages(viewer: AuthUser, conversationId: string) {
    const conversation = await this.getConversation(viewer.id, conversationId);
    const otherId =
      conversation.userAId === viewer.id ? conversation.userBId : conversation.userAId;
    const rows = await this.database.db
      .select({ message: directMessages, sender: users })
      .from(directMessages)
      .innerJoin(users, eq(users.id, directMessages.senderId))
      .where(eq(directMessages.conversationId, conversationId))
      .orderBy(directMessages.createdAt)
      .limit(200);
    await this.database.db
      .update(directMessages)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(directMessages.conversationId, conversationId),
          eq(directMessages.senderId, otherId),
          isNull(directMessages.readAt),
        ),
      );
    return {
      conversationId,
      items: rows.map(
        (row): DirectMessageItem => ({
          id: row.message.id,
          content: row.message.content,
          mine: row.message.senderId === viewer.id,
          readAt: row.message.readAt?.toISOString() ?? null,
          createdAt: row.message.createdAt.toISOString(),
          sender: publicUser(row.sender),
        }),
      ),
    };
  }

  async sendMessage(
    viewer: AuthUser,
    input: { content: string; recipientId?: string; conversationId?: string },
  ) {
    let conversationId = input.conversationId;
    let otherId = input.recipientId;
    if (!conversationId) {
      if (!otherId) throw new AppError(ERROR_CODES.BAD_REQUEST, '缺少收件人', 400);
      if (otherId === viewer.id) {
        throw new AppError(ERROR_CODES.BAD_REQUEST, '不能给自己发送私信', 400);
      }
      const existing = await this.database.db
        .select()
        .from(conversations)
        .where(
          or(
            and(eq(conversations.userAId, viewer.id), eq(conversations.userBId, otherId)),
            and(eq(conversations.userAId, otherId), eq(conversations.userBId, viewer.id)),
          ),
        )
        .limit(1);
      if (existing[0]) {
        conversationId = existing[0].id;
      } else {
        const [created] = await this.database.db
          .insert(conversations)
          .values({ userAId: viewer.id, userBId: otherId })
          .returning();
        if (!created) throw new AppError(ERROR_CODES.INTERNAL_ERROR, '创建会话失败', 500);
        conversationId = created.id;
      }
    } else {
      const conversation = await this.getConversation(viewer.id, conversationId);
      otherId = conversation.userAId === viewer.id ? conversation.userBId : conversation.userAId;
    }
    const [created] = await this.database.db
      .insert(directMessages)
      .values({
        conversationId,
        senderId: viewer.id,
        content: input.content.trim().slice(0, 2000),
      })
      .returning();
    if (!created) throw new AppError(ERROR_CODES.INTERNAL_ERROR, '发送私信失败', 500);
    await this.database.db
      .update(conversations)
      .set({ lastMessageAt: new Date() })
      .where(eq(conversations.id, conversationId));
    return {
      conversationId,
      recipientId: otherId,
      message: {
        id: created.id,
        content: created.content,
        mine: true,
        readAt: null,
        createdAt: created.createdAt.toISOString(),
        sender: publicUser({
          id: viewer.id,
          username: viewer.username,
          displayName: viewer.displayName,
          avatarUrl: viewer.avatarUrl,
          bio: viewer.bio ?? '',
          roles: viewer.roles,
          level: viewer.level,
          createdAt: new Date(),
        } as unknown as DbUser),
      } satisfies DirectMessageItem,
    };
  }

  async rankings(
    period: 'day' | 'week' | 'month' | 'all',
    limit = 20,
  ): Promise<{ items: RankingItem[] }> {
    const days = period === 'day' ? 1 : period === 'week' ? 7 : period === 'month' ? 30 : 0;
    if (days === 0) {
      const list = await this.videos.list({ limit, sort: 'hot' });
      return {
        items: list.items.map((video, index) => ({
          video,
          score: video.views + video.likes * 10,
          periodViews: video.views,
          rank: index + 1,
        })),
      };
    }
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await this.database.db
      .select({
        video: videos,
        uploader: users,
        category: categories,
        periodViews: count(watchEvents.id),
      })
      .from(watchEvents)
      .innerJoin(videos, eq(videos.id, watchEvents.videoId))
      .innerJoin(users, eq(users.id, videos.uploaderId))
      .leftJoin(categories, eq(categories.id, videos.categoryId))
      .where(
        and(
          eq(watchEvents.eventType, 'view'),
          gte(watchEvents.createdAt, since),
          eq(videos.status, 'published'),
          eq(videos.visibility, 'public'),
          isNull(videos.deletedAt),
          lte(videos.publishedAt, new Date()),
          videoRegionCondition(),
        ),
      )
      .groupBy(videos.id, users.id, categories.id)
      .orderBy(desc(count(watchEvents.id)))
      .limit(limit);
    const tagsByVideo = await this.videos.tagsFor(rows.map((row) => row.video.id));
    return {
      items: rows.map((row, index) => ({
        video: videoCard(row, tagsByVideo.get(row.video.id) ?? []),
        score: Number(row.periodViews),
        periodViews: Number(row.periodViews),
        rank: index + 1,
      })),
    };
  }

  async registerPush(
    viewer: AuthUser,
    input: { endpoint: string; keys: { p256dh: string; auth: string } },
  ) {
    await this.database.db
      .insert(pushSubscriptions)
      .values({
        userId: viewer.id,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: { userId: viewer.id, p256dh: input.keys.p256dh, auth: input.keys.auth },
      });
    return { ok: true };
  }

  async removePush(viewer: AuthUser, endpoint: string) {
    await this.database.db
      .delete(pushSubscriptions)
      .where(
        and(eq(pushSubscriptions.userId, viewer.id), eq(pushSubscriptions.endpoint, endpoint)),
      );
    return { ok: true };
  }

  private async getConversation(userId: string, id: string) {
    const rows = await this.database.db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.id, id),
          or(eq(conversations.userAId, userId), eq(conversations.userBId, userId)),
        ),
      )
      .limit(1);
    if (!rows[0]) throw new AppError(ERROR_CODES.NOT_FOUND, '会话不存在', 404);
    return rows[0];
  }

  private async likedDynamics(userId: string, ids: string[]) {
    if (ids.length === 0) return new Set<string>();
    const rows = await this.database.db
      .select({ dynamicId: dynamicLikes.dynamicId })
      .from(dynamicLikes)
      .where(and(eq(dynamicLikes.userId, userId), inArray(dynamicLikes.dynamicId, ids)));
    return new Set(rows.map((row) => row.dynamicId));
  }

  private async videoCardsFor(ids: string[]) {
    const map = new Map<string, VideoCard>();
    if (ids.length === 0) return map;
    const rows = await this.database.db
      .select({ video: videos, uploader: users, category: categories })
      .from(videos)
      .innerJoin(users, eq(users.id, videos.uploaderId))
      .leftJoin(categories, eq(categories.id, videos.categoryId))
      .where(
        and(
          inArray(videos.id, ids),
          isNull(videos.deletedAt),
          eq(videos.status, 'published'),
          eq(videos.visibility, 'public'),
          videoRegionCondition(),
        ),
      );
    const tagsByVideo = await this.videos.tagsFor(rows.map((row) => row.video.id));
    for (const row of rows) {
      map.set(row.video.id, videoCard(row, tagsByVideo.get(row.video.id) ?? []));
    }
    return map;
  }

  private toDynamic(
    dynamic: DbDynamic,
    user: DbUser,
    topic: typeof topics.$inferSelect | null,
    video: VideoCard | null,
    liked: boolean,
  ): DynamicItem {
    return {
      id: dynamic.id,
      content: dynamic.content,
      images: dynamic.images,
      createdAt: dynamic.createdAt.toISOString(),
      likeCount: dynamic.likeCount,
      liked,
      ipRegion: currentRegionContext().ipLocationEnabled ? dynamic.ipRegion : null,
      user: publicUser(user),
      video,
      topic: topic ? this.toTopic(topic) : null,
    };
  }

  private toTopic(topic: typeof topics.$inferSelect): TopicInfo {
    return {
      id: topic.id,
      slug: topic.slug,
      title: topic.title,
      description: topic.description,
      coverUrl: topic.coverUrl,
      kind: topic.kind,
      startsAt: topic.startsAt?.toISOString() ?? null,
      endsAt: topic.endsAt?.toISOString() ?? null,
    };
  }
}
