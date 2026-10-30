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
import { and, asc, count, desc, eq, inArray, isNull, ne, sql } from 'drizzle-orm';
import type { AuthUser } from '../common/auth-user';
import { DatabaseService } from '../common/database.service';
import { grantExperience } from '../common/experience';
import { currentRegionContext } from '../common/region-context';
import { decodeCursor, encodeCursor, publicUser } from '../videos/video.helpers';
import { VideosService } from '../videos/videos.service';

const REPLIES_PREVIEW = 3;

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
    const videoRow = await this.videos.getRow(videoId);
    this.videos.assertCanView(videoRow.video, viewer);
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
        desc(comments.pinned),
        ...(query.sort === 'hot'
          ? [desc(comments.likeCount), desc(comments.createdAt)]
          : [desc(comments.createdAt)]),
      )
      .limit(query.limit)
      .offset(offset);
    const ids = rows.map((item) => item.comment.id);
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
      if (list.length < REPLIES_PREVIEW) list.push(reply);
      replyMap.set(reply.comment.parentId, list);
    }
    const countMap = new Map(replyCounts.map((item) => [item.parentId ?? '', Number(item.value)]));
    return {
      items: rows.map((item) =>
        this.toItem(
          item.comment,
          item.user,
          videoRow.video.uploaderId,
          (replyMap.get(item.comment.id) ?? []).map((reply) =>
            this.toItem(
              reply.comment,
              reply.user,
              videoRow.video.uploaderId,
              [],
              likedSet.has(reply.comment.id),
              0,
            ),
          ),
          likedSet.has(item.comment.id),
          countMap.get(item.comment.id) ?? 0,
        ),
      ),
      nextCursor: rows.length === query.limit ? encodeCursor(offset + query.limit) : null,
    };
  }

  async replies(
    videoId: string,
    commentId: string,
    query: { cursor?: string; limit: number },
    viewer?: AuthUser,
  ) {
    const videoRow = await this.videos.getRow(videoId);
    this.videos.assertCanView(videoRow.video, viewer);
    const offset = decodeCursor(query.cursor);
    const rows = await this.database.db
      .select({ comment: comments, user: users })
      .from(comments)
      .innerJoin(users, eq(users.id, comments.userId))
      .where(
        and(
          eq(comments.videoId, videoId),
          eq(comments.parentId, commentId),
          eq(comments.status, 'visible'),
        ),
      )
      .orderBy(asc(comments.createdAt))
      .limit(query.limit)
      .offset(offset);
    let likedSet = new Set<string>();
    if (viewer && rows.length > 0) {
      const liked = await this.database.db
        .select({ commentId: commentLikes.commentId })
        .from(commentLikes)
        .where(
          and(
            eq(commentLikes.userId, viewer.id),
            inArray(
              commentLikes.commentId,
              rows.map((item) => item.comment.id),
            ),
          ),
        );
      likedSet = new Set(liked.map((item) => item.commentId));
    }
    return {
      items: rows.map((item) =>
        this.toItem(
          item.comment,
          item.user,
          videoRow.video.uploaderId,
          [],
          likedSet.has(item.comment.id),
          0,
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
    const region = currentRegionContext();
    const [created] = await this.database.db
      .insert(comments)
      .values({
        videoId,
        userId: viewer.id,
        parentId: input.parentId ?? null,
        content: content.slice(0, 1000),
        ipRegion: region.ipLocationEnabled ? region.networkCode || null : null,
      })
      .returning();
    if (!created) throw new AppError(ERROR_CODES.INTERNAL_ERROR, '发布评论失败', 500);
    await this.database.db
      .update(videos)
      .set({ commentCount: sql`${videos.commentCount} + 1` })
      .where(eq(videos.id, videoId));
    const notified = new Set<string>([viewer.id]);
    if (row.video.uploaderId !== viewer.id) {
      notified.add(row.video.uploaderId);
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
      notified.add(parentUserId);
      await this.database.db.insert(notifications).values({
        userId: parentUserId,
        actorId: viewer.id,
        type: 'reply',
        title: `${viewer.displayName} 回复了你的评论`,
        body: content.slice(0, 120),
        link: `/video/${videoId}`,
      });
    }
    await this.notifyMentions(videoId, content, viewer, notified);
    await grantExperience(this.database.db, viewer.id, 2);
    if (row.video.uploaderId !== viewer.id) {
      await grantExperience(this.database.db, row.video.uploaderId, 1);
    }
    const userRows = await this.database.db
      .select()
      .from(users)
      .where(eq(users.id, viewer.id))
      .limit(1);
    if (!userRows[0]) throw new AppError(ERROR_CODES.NOT_FOUND, '用户不存在', 404);
    return this.toItem(created, userRows[0], row.video.uploaderId, [], false, 0);
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

  async pin(videoId: string, commentId: string, viewer: AuthUser, pinned: boolean) {
    const row = await this.videos.getRow(videoId);
    const canPin =
      row.video.uploaderId === viewer.id || viewer.permissions.includes('comment:manage');
    if (!canPin) throw new AppError(ERROR_CODES.FORBIDDEN, '只有 UP 主可以置顶评论', 403);
    const rows = await this.database.db
      .select()
      .from(comments)
      .where(and(eq(comments.id, commentId), eq(comments.videoId, videoId)))
      .limit(1);
    if (!rows[0]) throw new AppError(ERROR_CODES.NOT_FOUND, '评论不存在', 404);
    if (pinned) {
      await this.database.db
        .update(comments)
        .set({ pinned: false, pinnedAt: null })
        .where(and(eq(comments.videoId, videoId), eq(comments.pinned, true)));
    }
    await this.database.db
      .update(comments)
      .set({ pinned, pinnedAt: pinned ? new Date() : null, updatedAt: new Date() })
      .where(eq(comments.id, commentId));
    return { pinned };
  }

  async toggleUpLike(videoId: string, commentId: string, viewer: AuthUser, desired: boolean) {
    const row = await this.videos.getRow(videoId);
    if (row.video.uploaderId !== viewer.id) {
      throw new AppError(ERROR_CODES.FORBIDDEN, '只有 UP 主可以点赞评论', 403);
    }
    const rows = await this.database.db
      .select()
      .from(comments)
      .where(and(eq(comments.id, commentId), eq(comments.videoId, videoId)))
      .limit(1);
    if (!rows[0]) throw new AppError(ERROR_CODES.NOT_FOUND, '评论不存在', 404);
    await this.database.db
      .update(comments)
      .set({ upLiked: desired, updatedAt: new Date() })
      .where(eq(comments.id, commentId));
    return { upLiked: desired };
  }

  private async notifyMentions(
    videoId: string,
    content: string,
    viewer: AuthUser,
    excluded: Set<string>,
  ) {
    const handles = Array.from(
      new Set(
        Array.from(content.matchAll(/@([a-zA-Z0-9_\u4e00-\u9fa5-]{2,20})/g)).map((match) =>
          match[1]!.toLowerCase(),
        ),
      ),
    ).slice(0, 5);
    if (handles.length === 0) return;
    const rows = await this.database.db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(inArray(sql`lower(${users.username})`, handles));
    for (const target of rows) {
      if (excluded.has(target.id)) continue;
      excluded.add(target.id);
      await this.database.db.insert(notifications).values({
        userId: target.id,
        actorId: viewer.id,
        type: 'mention',
        title: `${viewer.displayName} 在评论中提到了你`,
        body: content.slice(0, 120),
        link: `/video/${videoId}`,
      });
    }
  }

  private toItem(
    comment: DbComment,
    user: DbUser,
    uploaderId: string,
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
      pinned: comment.pinned,
      upLiked: comment.upLiked,
      isUploader: comment.userId === uploaderId,
      ipRegion: currentRegionContext().ipLocationEnabled ? comment.ipRegion : null,
      user: publicUser(user),
      replies,
      replyCount,
    };
  }
}
