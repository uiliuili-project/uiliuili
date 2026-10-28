import { Injectable } from '@nestjs/common';
import { auditLogs, comments, notifications, reports, users, videos } from '@uiliuili/db';
import { AppError, ERROR_CODES } from '@uiliuili/shared';
import { and, count, desc, eq, gte, ilike, isNull, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import { AuditService } from '../common/audit.service';
import type { AuthUser } from '../common/auth-user';
import { DatabaseService } from '../common/database.service';
import { QueueService } from '../common/queue.service';

export const reviewVideoQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().max(100).optional(),
  status: z.enum(['pending_review', 'published', 'blocked', 'all']).default('pending_review'),
});

export const reviewVideoDecisionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().max(500).optional(),
});

export const reviewCommentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().max(100).optional(),
  filter: z.enum(['all', 'hidden', 'reported']).default('reported'),
});

@Injectable()
export class ReviewService {
  constructor(
    private readonly database: DatabaseService,
    private readonly queue: QueueService,
    private readonly audit: AuditService,
  ) {}

  async summary() {
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    const overdueBefore = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [pending, openReports, hiddenComments, todayActions, overdue] = await Promise.all([
      this.database.db
        .select({ value: count() })
        .from(videos)
        .where(and(eq(videos.status, 'pending_review'), isNull(videos.deletedAt))),
      this.database.db.select({ value: count() }).from(reports).where(eq(reports.status, 'open')),
      this.database.db
        .select({ value: count() })
        .from(comments)
        .where(eq(comments.status, 'hidden')),
      this.database.db
        .select({ value: count() })
        .from(auditLogs)
        .where(and(ilike(auditLogs.action, 'review.%'), gte(auditLogs.createdAt, since))),
      this.database.db
        .select({ value: count() })
        .from(videos)
        .where(
          and(
            eq(videos.status, 'pending_review'),
            isNull(videos.deletedAt),
            lt(videos.createdAt, overdueBefore),
          ),
        ),
    ]);
    return {
      pendingVideos: Number(pending[0]?.value ?? 0),
      openReports: Number(openReports[0]?.value ?? 0),
      hiddenComments: Number(hiddenComments[0]?.value ?? 0),
      todayActions: Number(todayActions[0]?.value ?? 0),
      overdueVideos: Number(overdue[0]?.value ?? 0),
    };
  }

  async listVideos(query: z.infer<typeof reviewVideoQuerySchema>) {
    const conditions = [isNull(videos.deletedAt)];
    if (query.status !== 'all') conditions.push(eq(videos.status, query.status));
    if (query.q) conditions.push(ilike(videos.title, `%${query.q}%`));
    const where = and(...conditions);
    const offset = (query.page - 1) * query.limit;
    const [rows, total] = await Promise.all([
      this.database.db
        .select({
          id: videos.id,
          title: videos.title,
          status: videos.status,
          coverUrl: videos.coverUrl,
          durationSeconds: videos.durationSeconds,
          createdAt: videos.createdAt,
          publishedAt: videos.publishedAt,
          blockReason: videos.blockReason,
          uploaderId: users.id,
          uploaderName: users.displayName,
          uploaderUsername: users.username,
        })
        .from(videos)
        .innerJoin(users, eq(users.id, videos.uploaderId))
        .where(where)
        .orderBy(desc(videos.createdAt))
        .limit(query.limit)
        .offset(offset),
      this.database.db.select({ value: count() }).from(videos).where(where),
    ]);
    return {
      items: rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
        publishedAt: row.publishedAt?.toISOString() ?? null,
      })),
      total: Number(total[0]?.value ?? 0),
      page: query.page,
      limit: query.limit,
    };
  }

  async decideVideo(actor: AuthUser, id: string, input: z.infer<typeof reviewVideoDecisionSchema>) {
    const rows = await this.database.db.select().from(videos).where(eq(videos.id, id)).limit(1);
    const video = rows[0];
    if (!video || video.deletedAt) {
      throw new AppError(ERROR_CODES.NOT_FOUND, '视频不存在', 404);
    }
    if (video.status !== 'pending_review') {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '该视频不在待审核状态', 400);
    }
    if (input.action === 'reject' && !input.reason?.trim()) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '请填写驳回原因', 400);
    }
    const approved = input.action === 'approve';
    const [updated] = await this.database.db
      .update(videos)
      .set({
        status: approved ? 'published' : 'blocked',
        publishedAt: approved ? (video.publishedAt ?? new Date()) : video.publishedAt,
        blockReason: approved ? null : (input.reason?.trim() ?? ''),
        updatedAt: new Date(),
      })
      .where(eq(videos.id, id))
      .returning();
    await this.queue.enqueue(
      'search-index',
      { videoId: id },
      { idempotencyKey: `search:${id}:${Date.now()}` },
    );
    await this.audit.record({
      actorId: actor.id,
      action: approved ? 'review.video.approve' : 'review.video.reject',
      targetType: 'video',
      targetId: id,
      after: { status: updated?.status, reason: input.reason ?? null },
    });
    await this.database.db.insert(notifications).values({
      userId: video.uploaderId,
      actorId: actor.id,
      type: 'moderation',
      title: approved ? '视频审核通过' : '视频未通过审核',
      body: approved ? `《${video.title}》已通过审核并公开发布。` : input.reason!.trim(),
      link: '/studio',
    });
    return { id, status: updated?.status ?? (approved ? 'published' : 'blocked') };
  }

  async listComments(query: z.infer<typeof reviewCommentQuerySchema>) {
    const conditions = [];
    if (query.filter === 'hidden') conditions.push(eq(comments.status, 'hidden'));
    if (query.q) conditions.push(ilike(comments.content, `%${query.q}%`));
    if (query.filter === 'reported') {
      conditions.push(
        sql`EXISTS (
          SELECT 1 FROM "uiliuili"."reports" r
          WHERE r."target_type" = 'comment'
            AND r."target_id" = ${comments.id}
            AND r."status" = 'open'
        )`,
      );
    }
    const where = conditions.length ? and(...conditions) : undefined;
    const offset = (query.page - 1) * query.limit;
    const [rows, total] = await Promise.all([
      this.database.db
        .select({
          id: comments.id,
          content: comments.content,
          videoId: comments.videoId,
          status: comments.status,
          likeCount: comments.likeCount,
          createdAt: comments.createdAt,
          username: users.username,
          videoTitle: videos.title,
        })
        .from(comments)
        .innerJoin(users, eq(users.id, comments.userId))
        .innerJoin(videos, eq(videos.id, comments.videoId))
        .where(where)
        .orderBy(desc(comments.createdAt))
        .limit(query.limit)
        .offset(offset),
      this.database.db.select({ value: count() }).from(comments).where(where),
    ]);
    return {
      items: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
      total: Number(total[0]?.value ?? 0),
      page: query.page,
      limit: query.limit,
    };
  }

  async actOnComment(actor: AuthUser, id: string, action: string, reason?: string) {
    const statusMap: Record<string, string> = {
      hide: 'hidden',
      restore: 'visible',
      delete: 'deleted',
    };
    const status = statusMap[action];
    if (!status) throw new AppError(ERROR_CODES.BAD_REQUEST, '不支持的操作', 400);
    const rows = await this.database.db.select().from(comments).where(eq(comments.id, id)).limit(1);
    const comment = rows[0];
    if (!comment) throw new AppError(ERROR_CODES.NOT_FOUND, '评论不存在', 404);
    await this.database.db
      .update(comments)
      .set({
        status,
        updatedAt: new Date(),
        deletedAt: status === 'deleted' ? new Date() : null,
      })
      .where(eq(comments.id, id));
    if (status !== 'visible') {
      await this.database.db
        .update(reports)
        .set({ status: 'resolved', handledBy: actor.id, handledAt: new Date() })
        .where(
          and(
            eq(reports.targetType, 'comment'),
            eq(reports.targetId, id),
            eq(reports.status, 'open'),
          ),
        );
    }
    await this.audit.record({
      actorId: actor.id,
      action: `review.comment.${action}`,
      targetType: 'comment',
      targetId: id,
      after: { status, reason: reason ?? null },
    });
    return { ok: true, status };
  }
}
