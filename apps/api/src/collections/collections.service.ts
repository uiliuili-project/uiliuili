import { Injectable } from '@nestjs/common';
import { categories, collectionItems, collections, users, videos } from '@uiliuili/db';
import {
  AppError,
  type CollectionDetail,
  type CollectionInfo,
  ERROR_CODES,
  type PublicUser,
} from '@uiliuili/shared';
import { and, asc, count, desc, eq, isNull, lte, sql } from 'drizzle-orm';
import type { AuthUser } from '../common/auth-user';
import { DatabaseService } from '../common/database.service';
import { publicUser, videoCard } from '../videos/video.helpers';
import { VideosService } from '../videos/videos.service';

@Injectable()
export class CollectionsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly videos: VideosService,
  ) {}

  async listForUser(username: string, viewer?: AuthUser) {
    const ownerRows = await this.database.db
      .select()
      .from(users)
      .where(sql`lower(${users.username}) = ${username.toLowerCase()}`)
      .limit(1);
    const owner = ownerRows[0];
    if (!owner) throw new AppError(ERROR_CODES.NOT_FOUND, '用户不存在', 404);
    return this.listForOwner(owner.id, owner, viewer);
  }

  async listMine(viewer: AuthUser) {
    const ownerRows = await this.database.db
      .select()
      .from(users)
      .where(eq(users.id, viewer.id))
      .limit(1);
    const owner = ownerRows[0];
    if (!owner) throw new AppError(ERROR_CODES.NOT_FOUND, '用户不存在', 404);
    return this.listForOwner(owner.id, owner, viewer, true);
  }

  async detail(id: string, viewer?: AuthUser): Promise<CollectionDetail> {
    const rows = await this.database.db
      .select({ collection: collections, owner: users })
      .from(collections)
      .innerJoin(users, eq(users.id, collections.userId))
      .where(eq(collections.id, id))
      .limit(1);
    const row = rows[0];
    if (!row) throw new AppError(ERROR_CODES.NOT_FOUND, '合集不存在', 404);
    const privileged = viewer?.id === row.collection.userId;
    if (row.collection.visibility !== 'public' && !privileged) {
      throw new AppError(ERROR_CODES.NOT_FOUND, '合集不存在', 404);
    }
    const itemRows = await this.database.db
      .select({ video: videos, uploader: users, category: categories })
      .from(collectionItems)
      .innerJoin(videos, eq(videos.id, collectionItems.videoId))
      .innerJoin(users, eq(users.id, videos.uploaderId))
      .leftJoin(categories, eq(categories.id, videos.categoryId))
      .where(
        and(
          eq(collectionItems.collectionId, id),
          eq(videos.status, 'published'),
          isNull(videos.deletedAt),
          lte(videos.publishedAt, new Date()),
        ),
      )
      .orderBy(asc(collectionItems.sort), asc(collectionItems.createdAt));
    const tagsByVideo = await this.videos.tagsFor(itemRows.map((item) => item.video.id));
    const items = itemRows.map((item) => videoCard(item, tagsByVideo.get(item.video.id) ?? []));
    return {
      ...this.info(row.collection, publicUser(row.owner), items.length),
      coverUrl: row.collection.coverUrl ?? items[0]?.coverUrl ?? null,
      items,
    };
  }

  async create(
    viewer: AuthUser,
    input: { title: string; description: string; kind: string; visibility: string },
  ): Promise<CollectionInfo> {
    const [created] = await this.database.db
      .insert(collections)
      .values({
        userId: viewer.id,
        title: input.title.trim(),
        description: input.description,
        kind: input.kind,
        visibility: input.visibility,
      })
      .returning();
    if (!created) throw new AppError(ERROR_CODES.INTERNAL_ERROR, '创建合集失败', 500);
    return this.info(created, toPublicUser(viewer), 0);
  }

  async update(
    viewer: AuthUser,
    id: string,
    input: {
      title?: string;
      description?: string;
      kind?: string;
      visibility?: string;
      coverUrl?: string | null;
    },
  ) {
    await this.getOwn(viewer.id, id);
    const [updated] = await this.database.db
      .update(collections)
      .set({
        title: input.title?.trim(),
        description: input.description,
        kind: input.kind,
        visibility: input.visibility,
        coverUrl: input.coverUrl,
        updatedAt: new Date(),
      })
      .where(eq(collections.id, id))
      .returning();
    if (!updated) throw new AppError(ERROR_CODES.NOT_FOUND, '合集不存在', 404);
    return this.info(updated, toPublicUser(viewer), 0);
  }

  async remove(viewer: AuthUser, id: string) {
    await this.getOwn(viewer.id, id);
    await this.database.db.delete(collections).where(eq(collections.id, id));
    return { ok: true };
  }

  async addItem(viewer: AuthUser, id: string, videoId: string, sort?: number) {
    await this.getOwn(viewer.id, id);
    const videoRows = await this.database.db
      .select({ id: videos.id })
      .from(videos)
      .where(and(eq(videos.id, videoId), isNull(videos.deletedAt), eq(videos.status, 'published')))
      .limit(1);
    if (videoRows.length === 0) throw new AppError(ERROR_CODES.NOT_FOUND, '视频不存在', 404);
    const [maxRow] = await this.database.db
      .select({ value: sql<number>`COALESCE(MAX(${collectionItems.sort}), 0)` })
      .from(collectionItems)
      .where(eq(collectionItems.collectionId, id));
    await this.database.db
      .insert(collectionItems)
      .values({ collectionId: id, videoId, sort: sort ?? Number(maxRow?.value ?? 0) + 1 })
      .onConflictDoUpdate({
        target: [collectionItems.collectionId, collectionItems.videoId],
        set: { sort: sort ?? Number(maxRow?.value ?? 0) + 1 },
      });
    await this.touch(id);
    return { ok: true };
  }

  async removeItem(viewer: AuthUser, id: string, videoId: string) {
    await this.getOwn(viewer.id, id);
    await this.database.db
      .delete(collectionItems)
      .where(and(eq(collectionItems.collectionId, id), eq(collectionItems.videoId, videoId)));
    await this.touch(id);
    return { ok: true };
  }

  private async listForOwner(
    ownerId: string,
    owner: typeof users.$inferSelect,
    _viewer?: AuthUser,
    includePrivate = false,
  ): Promise<{ items: CollectionInfo[] }> {
    const rows = await this.database.db
      .select({
        collection: collections,
        value: count(collectionItems.videoId),
      })
      .from(collections)
      .leftJoin(collectionItems, eq(collectionItems.collectionId, collections.id))
      .where(
        and(
          eq(collections.userId, ownerId),
          includePrivate ? undefined : eq(collections.visibility, 'public'),
        ),
      )
      .groupBy(collections.id)
      .orderBy(desc(collections.updatedAt));
    const ownerPayload = publicUser(owner);
    return {
      items: rows.map((row) => this.info(row.collection, ownerPayload, Number(row.value))),
    };
  }

  private async getOwn(userId: string, id: string) {
    const rows = await this.database.db
      .select()
      .from(collections)
      .where(and(eq(collections.id, id), eq(collections.userId, userId)))
      .limit(1);
    if (!rows[0]) throw new AppError(ERROR_CODES.NOT_FOUND, '合集不存在', 404);
    return rows[0];
  }

  private async touch(id: string) {
    await this.database.db
      .update(collections)
      .set({ updatedAt: new Date() })
      .where(eq(collections.id, id));
  }

  private info(
    collection: typeof collections.$inferSelect,
    owner: PublicUser,
    itemCount: number,
  ): CollectionInfo & { itemCount: number } {
    return {
      id: collection.id,
      title: collection.title,
      kind: collection.kind,
      coverUrl: collection.coverUrl,
      itemCount,
      description: collection.description,
      visibility: collection.visibility,
      userId: collection.userId,
      createdAt: collection.createdAt.toISOString(),
      updatedAt: collection.updatedAt.toISOString(),
      owner,
    };
  }
}

function toPublicUser(user: AuthUser): PublicUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    roles: user.roles,
    level: user.level,
    experience: user.experience,
    createdAt: new Date().toISOString(),
  };
}
