import { Injectable } from '@nestjs/common';
import {
  type DbComment,
  type DbUser,
  commentLikes,
  comments,
  notifications,
  users,
  videos,
} from '@uiliuili/db';
import { AppError, type CommentCreateInput, type CommentItem, ERROR_CODES } from '@uiliuili/shared';
import { and, asc, count, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { AuthUser } from '../common/auth-user';
import { DatabaseService } from '../common/database.service';
import { decodeCursor, encodeCursor, publicUser } from '../videos/video.helpers';
import { VideosService } from '../videos/videos.service';

@Injectable()
export class CommentsService {
  constructor(
    private readonly database: DatabaseService,
    private readonly videos: VideosService,
  ) {}

  async list(
    videoId: string,
    query: { cursor?: string; limit: number; sort: 'hot' | 'new' },
    viewer?: AuthUser,
  ) {
    const row = await this.videos.getRow(videoId);
    this.videos.assertCanView(row.video, viewer);
    const offset = decodeCursor(query.cursor);
    const rows = await this.database.db
      .select({ comment: comments, user: users })
      .from(comments)
      .innerJoin(users, eq(users.id, comments.userId))
      .where(
        and(
          eq(comments.videoId, videoId),
          isNull(comments.parentId),
          eq(comments.status, 'visible'),
        ),
      )
      .orderBy(
        ...(query.sort === 'hot'
          ? [desc(comments.likeCount), desc(comments.createdAt)]
          : [desc(comments.createdAt)]),
      )
      .limit(query.limit)
      .offset(offset);
    const ids = rows.map((row) => row.comment.id);
    const [replies, liked, replyCounts] = await Promise.all([
      ids.length
        ? this.database.db
            .select({ comment: comments, user: users })
            .from(comments)
            .innerJoin(users, eq(users.id, comments.userId))
            .where(and(eq(comments.status, 'visible'), inArray(comments.parentId, ids)))
            .orderBy(asc(comments.createdAt))
            .limit(500)
        : Promise.resolve([]),
      viewer
        ? this.database.db
            .select({ commentId: commentLikes.commentId })
            .from(commentLikes)
            .where(eq(commentLikes.userId, viewer.id))
        : Promise.resolve([]),
      ids.length
        ? this.database.db
            .select({ parentId: comments.parentId, value: count() })
            .from(comments)
            .where(and(eq(comments.status, 'visible'), inArray(comments.parentId, ids)))
            .groupBy(comments.parentId)
        : Promise.resolve([]),
    ]);
    const likedSet = new Set(liked.map((item) => item.commentId));
    const replyMap = new Map<string, Array<{ comment: DbComment; user: DbUser }>>();
    for (const reply of replies) {
      if (!reply.comment.parentId) continue;
      const list = replyMap.get(reply.comment.parentId) ?? [];
      list.push(reply);
      replyMap.set(reply.comment.parentId, list);
    }
    const countMap = new Map(replyCounts.map((item) => [item.parentId ?? '', Number(item.value)]));
    return {
      items: rows.map((row) =>
        this.toItem(
          row.comment,
          row.user,
          (replyMap.get(row.comment.id) ?? []).map((reply) =>
            this.toItem(reply.comment, reply.user, [], likedSet.has(reply.comment.id), 0),
          ),
          likedSet.has(row.comment.id),
          countMap.get(row.comment.id) ?? 0,
        ),
      ),
      nextCursor: rows.length === query.limit ? encodeCursor(offset + query.limit) : null,
    };
  }

  async create(videoId: string, viewer: AuthUser, input: CommentCreateInput) {
    const row = await this.videos.getRow(videoId);
    this.videos.assertCanView(row.video, viewer);
    if (row.video.status !== 'published') {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '视频尚未发布', 400);
    }
    const content = input.content.split('\u0000').join('').trim();
    if (!content) throw new AppError(ERROR_CODES.BAD_REQUEST, '评论不能为空', 400);
    let parentUserId: string | null = null;
    if (input.parentId) {
      const parentRows = await this.database.db
        .select()
        .from(comments)
        .where(and(eq(comments.id, input.parentId), eq(comments.videoId, videoId)))
        .limit(1);
      const parent = parentRows[0];
      if (!parent || parent.status !== 'visible') {
        throw new AppError(ERROR_CODES.BAD_REQUEST, '回复的评论不存在', 400);
      }
      parentUserId = parent.userId;
    }
    const [created] = await this.database.db
      .insert(comments)
      .values({
        videoId,
        userId: viewer.id,
        parentId: input.parentId ?? null,
        content: content.slice(0, 1000),
      })
      .returning();
    if (!created) throw new AppError(ERROR_CODES.INTERNAL_ERROR, '发布评论失败', 500);
    await this.database.db
      .update(videos)
      .set({ commentCount: sql`${videos.commentCount} + 1` })
      .where(eq(videos.id, videoId));
    if (row.video.uploaderId !== viewer.id) {
      await this.database.db.insert(notifications).values({
        userId: row.video.uploaderId,
        actorId: viewer.id,
        type: 'comment',
        title: `${viewer.displayName} 评论了你的视频`,
        body: content.slice(0, 120),
        link: `/video/${videoId}`,
      });
    }
    if (parentUserId && parentUserId !== viewer.id && parentUserId !== row.video.uploaderId) {
      await this.database.db.insert(notifications).values({
        userId: parentUserId,
        actorId: viewer.id,
        type: 'reply',
        title: `${viewer.displayName} 回复了你的评论`,
        body: content.slice(0, 120),
        link: `/video/${videoId}`,
      });
    }
    const userRows = await this.database.db
      .select()
      .from(users)
      .where(eq(users.id, viewer.id))
      .limit(1);
    if (!userRows[0]) throw new AppError(ERROR_CODES.NOT_FOUND, '用户不存在', 404);
    return this.toItem(created, userRows[0], [], false, 0);
  }

  async remove(videoId: string, commentId: string, viewer: AuthUser) {
    const rows = await this.database.db
      .select()
      .from(comments)
      .where(and(eq(comments.id, commentId), eq(comments.videoId, videoId)))
      .limit(1);
    const comment = rows[0];
    if (!comment) throw new AppError(ERROR_CODES.NOT_FOUND, '评论不存在', 404);
    if (comment.userId !== viewer.id && !viewer.permissions.includes('comment:manage')) {
      throw new AppError(ERROR_CODES.FORBIDDEN, '没有权限删除此评论', 403);
    }
    await this.database.db
      .update(comments)
      .set({ status: 'deleted', deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(comments.id, commentId));
    await this.database.db
      .update(videos)
      .set({ commentCount: sql`GREATEST(0, ${videos.commentCount} - 1)` })
      .where(eq(videos.id, videoId));
    return { ok: true };
  }

  async toggleLike(commentId: string, viewer: AuthUser, desired: boolean) {
    let liked = false;
    await this.database.db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(commentLikes)
        .where(and(eq(commentLikes.commentId, commentId), eq(commentLikes.userId, viewer.id)))
        .limit(1);
      if (!desired && existing.length > 0) {
        await tx
          .delete(commentLikes)
          .where(and(eq(commentLikes.commentId, commentId), eq(commentLikes.userId, viewer.id)));
        await tx
          .update(comments)
          .set({ likeCount: sql`GREATEST(0, ${comments.likeCount} - 1)` })
          .where(eq(comments.id, commentId));
      } else if (desired && existing.length === 0) {
        await tx.insert(commentLikes).values({ commentId, userId: viewer.id });
        await tx
          .update(comments)
          .set({ likeCount: sql`${comments.likeCount} + 1` })
          .where(eq(comments.id, commentId));
        liked = true;
      } else {
        liked = existing.length > 0;
      }
    });
    const [countRow] = await this.database.db
      .select({ value: count() })
      .from(commentLikes)
      .where(eq(commentLikes.commentId, commentId));
    return { liked, count: Number(countRow?.value ?? 0) };
  }

  private toItem(
    comment: DbComment,
    user: DbUser,
    replies: CommentItem[],
    liked: boolean,
    replyCount: number,
  ): CommentItem {
    return {
      id: comment.id,
      content: comment.content,
      createdAt: comment.createdAt.toISOString(),
      likeCount: comment.likeCount,
      liked,
      user: publicUser(user),
      replies,
      replyCount,
    };
  }
}
