import crypto from 'node:crypto';
import path from 'node:path';
import { Injectable } from '@nestjs/common';
import {
  type DbVideo,
  categories,
  tags,
  uploadParts,
  uploadSessions,
  users,
  videoParts,
  videoSubtitles,
  videoTags,
  videos,
  watchEvents,
} from '@uiliuili/db';
import {
  AppError,
  ERROR_CODES,
  MAX_UPLOAD_CHUNK_BYTES,
  type VideoCreateInput,
} from '@uiliuili/shared';
import { and, count, desc, eq, gte, inArray, isNull, sql } from 'drizzle-orm';
import type { AuthUser } from '../common/auth-user';
import { DatabaseService } from '../common/database.service';
import { QueueService } from '../common/queue.service';
import { SettingsService } from '../common/settings.service';
import { StorageService } from '../common/storage.service';
import { tagSlug } from './video.helpers';

@Injectable()
export class StudioService {
  constructor(
    private readonly database: DatabaseService,
    private readonly settings: SettingsService,
    private readonly storage: StorageService,
    private readonly queue: QueueService,
  ) {}

  async list(userId: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      this.database.db
        .select()
        .from(videos)
        .where(and(eq(videos.uploaderId, userId), isNull(videos.deletedAt)))
        .orderBy(desc(videos.updatedAt))
        .limit(limit)
        .offset(offset),
      this.database.db
        .select({ value: count() })
        .from(videos)
        .where(and(eq(videos.uploaderId, userId), isNull(videos.deletedAt))),
    ]);
    return {
      items: rows.map((video) => this.studioPayload(video)),
      total: Number(total[0]?.value ?? 0),
      page,
      limit,
    };
  }

  async get(userId: string, id: string) {
    const video = await this.getOwnVideo(userId, id);
    const [parts, subtitles] = await Promise.all([
      this.database.db
        .select()
        .from(videoParts)
        .where(eq(videoParts.videoId, id))
        .orderBy(videoParts.sort, videoParts.createdAt),
      this.database.db.select().from(videoSubtitles).where(eq(videoSubtitles.videoId, id)),
    ]);
    return {
      ...this.studioPayload(video),
      parts: parts.map((part) => this.partPayload(part)),
      subtitles: subtitles.map((subtitle) => ({
        language: subtitle.language,
        label: subtitle.label,
        createdAt: subtitle.createdAt.toISOString(),
      })),
    };
  }

  async create(userId: string, input: VideoCreateInput) {
    await this.validateCategory(input.categoryId);
    const [created] = await this.database.db
      .insert(videos)
      .values({
        uploaderId: userId,
        title: input.title,
        description: input.description,
        categoryId: input.categoryId ?? null,
        visibility: input.visibility,
        status: 'draft',
      })
      .returning();
    if (!created) throw new AppError(ERROR_CODES.INTERNAL_ERROR, '创建稿件失败', 500);
    await this.setTags(created.id, input.tags);
    return this.studioPayload(created);
  }

  async update(
    userId: string,
    id: string,
    input: Partial<VideoCreateInput> & { coverUrl?: string },
  ) {
    await this.getOwnVideo(userId, id);
    await this.validateCategory(input.categoryId);
    const [updated] = await this.database.db
      .update(videos)
      .set({
        title: input.title,
        description: input.description,
        categoryId: input.categoryId === undefined ? undefined : input.categoryId,
        visibility: input.visibility,
        coverUrl: input.coverUrl,
        updatedAt: new Date(),
      })
      .where(eq(videos.id, id))
      .returning();
    if (input.tags !== undefined) await this.setTags(id, input.tags);
    if (!updated) throw new AppError(ERROR_CODES.NOT_FOUND, '视频不存在', 404);
    return this.studioPayload(updated);
  }

  async remove(userId: string, id: string) {
    await this.getOwnVideo(userId, id);
    await this.database.db
      .update(videos)
      .set({ status: 'deleted', deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(videos.id, id));
    return { ok: true };
  }

  async initUpload(
    userId: string,
    videoId: string,
    input: { filename: string; size: number; contentType: string; partId?: string },
  ) {
    const video = await this.getOwnVideo(userId, videoId);
    if (!['draft', 'uploading', 'failed', 'ready', 'processing'].includes(video.status)) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '当前状态不能重新上传视频', 400);
    }
    const part = input.partId ? await this.getOwnPart(userId, videoId, input.partId) : null;
    const uploadSettings = await this.settings.getUploadSettings();
    if (input.size > Number(uploadSettings.maxBytes)) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '文件超过站点上传大小限制', 400);
    }
    const extension = path.extname(input.filename).replace('.', '').toLowerCase();
    const allowed = Array.from(uploadSettings.allowedExtensions as readonly string[]).map((item) =>
      item.toLowerCase(),
    );
    if (!allowed.includes(extension)) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, `不支持的视频格式：${extension || '未知'}`, 400);
    }
    const chunkSize = Math.min(MAX_UPLOAD_CHUNK_BYTES, Math.max(1024 * 1024, input.size));
    const totalChunks = Math.max(1, Math.ceil(input.size / chunkSize));
    if (totalChunks > 10_000) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '分片数量过多', 400);
    }

    await this.database.db
      .update(uploadSessions)
      .set({ status: 'aborted' })
      .where(
        and(
          eq(uploadSessions.videoId, videoId),
          eq(uploadSessions.userId, userId),
          eq(uploadSessions.status, 'uploading'),
          part ? eq(uploadSessions.partId, part.id) : isNull(uploadSessions.partId),
        ),
      );

    const storageKey = part
      ? `videos/${videoId}/parts/${part.id}/source/${crypto.randomUUID()}.${extension}`
      : `videos/${videoId}/source/${crypto.randomUUID()}.${extension}`;
    const provider = await this.storage.provider();
    const multipart = await provider.initMultipart(storageKey, input.contentType);
    const [session] = await this.database.db
      .insert(uploadSessions)
      .values({
        userId,
        videoId,
        partId: part?.id ?? null,
        filename: input.filename.slice(0, 255),
        size: input.size,
        contentType: input.contentType,
        storageDriver: provider.driver,
        storageKey,
        s3UploadId: multipart.uploadId,
        chunkSize,
        totalChunks,
        uploadedChunks: 0,
        status: 'uploading',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })
      .returning();
    if (!session) throw new AppError(ERROR_CODES.INTERNAL_ERROR, '创建上传会话失败', 500);

    await this.database.db
      .update(videos)
      .set({
        status: 'uploading',
        sourceFilename: input.filename,
        sourceSize: input.size,
        sourceKey: storageKey,
        updatedAt: new Date(),
      })
      .where(eq(videos.id, videoId));
    if (part) {
      await this.database.db
        .update(videoParts)
        .set({
          status: 'uploading',
          sourceFilename: input.filename,
          sourceSize: input.size,
          sourceKey: storageKey,
          updatedAt: new Date(),
        })
        .where(eq(videoParts.id, part.id));
    }

    if (provider.driver === 's3') {
      const parts = await Promise.all(
        Array.from({ length: totalChunks }, async (_, index) => ({
          partNumber: index + 1,
          url: await provider.presignPart(storageKey, session.s3UploadId, index + 1, 3600),
        })),
      );
      return {
        mode: 's3' as const,
        uploadId: session.id,
        storageKey,
        partSize: chunkSize,
        totalChunks,
        parts,
      };
    }
    return {
      mode: 'local' as const,
      uploadId: session.id,
      storageKey,
      partSize: chunkSize,
      totalChunks,
    };
  }

  async presignParts(userId: string, uploadId: string, partNumbers: number[]) {
    const session = await this.getSession(userId, uploadId);
    const provider = await this.storage.provider();
    if (provider.driver !== 's3') {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '当前存储不支持预签名上传', 400);
    }
    return {
      parts: await Promise.all(
        partNumbers.map(async (partNumber) => ({
          partNumber,
          url: await provider.presignPart(session.storageKey, session.s3UploadId, partNumber, 3600),
        })),
      ),
    };
  }

  async putLocalPart(userId: string, uploadId: string, partNumber: number, body: Buffer) {
    const session = await this.getSession(userId, uploadId);
    const provider = await this.storage.provider();
    if (provider.driver !== 'local') {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '请直接上传到 S3', 400);
    }
    if (partNumber < 1 || partNumber > session.totalChunks) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '分片编号不合法', 400);
    }
    if (body.length > session.chunkSize + 1) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '分片大小超过限制', 400);
    }
    const part = await provider.putPart(
      session.storageKey,
      session.s3UploadId,
      partNumber,
      body,
      session.contentType,
    );
    await this.database.db
      .insert(uploadParts)
      .values({
        uploadSessionId: session.id,
        partNumber,
        size: body.length,
        etag: part.etag,
      })
      .onConflictDoUpdate({
        target: [uploadParts.uploadSessionId, uploadParts.partNumber],
        set: { size: body.length, etag: part.etag },
      });
    await this.refreshUploadedCount(session.id);
    return { partNumber, etag: part.etag };
  }

  async recordPart(
    userId: string,
    uploadId: string,
    partNumber: number,
    etag: string,
    size?: number,
  ) {
    const session = await this.getSession(userId, uploadId);
    if (session.storageDriver !== 's3') {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '当前上传不支持 ETag 记录', 400);
    }
    if (partNumber < 1 || partNumber > session.totalChunks) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '分片编号不合法', 400);
    }
    await this.database.db
      .insert(uploadParts)
      .values({ uploadSessionId: session.id, partNumber, size: size ?? 0, etag })
      .onConflictDoUpdate({
        target: [uploadParts.uploadSessionId, uploadParts.partNumber],
        set: { size: size ?? 0, etag },
      });
    await this.refreshUploadedCount(session.id);
    return { ok: true };
  }

  async completeUpload(
    userId: string,
    uploadId: string,
    providedParts?: Array<{ partNumber: number; etag: string }>,
  ) {
    const session = await this.getSession(userId, uploadId);
    const stored = await this.database.db
      .select()
      .from(uploadParts)
      .where(eq(uploadParts.uploadSessionId, session.id));
    const merged = new Map<number, { partNumber: number; etag: string }>();
    for (const part of stored) {
      if (part.etag) merged.set(part.partNumber, { partNumber: part.partNumber, etag: part.etag });
    }
    for (const part of providedParts ?? []) {
      merged.set(part.partNumber, part);
    }
    if (merged.size !== session.totalChunks) {
      throw new AppError(
        ERROR_CODES.BAD_REQUEST,
        `分片不完整（${merged.size}/${session.totalChunks}）`,
        400,
      );
    }
    const provider = await this.storage.provider();
    await provider.completeMultipart(session.storageKey, session.s3UploadId, [...merged.values()]);
    await this.database.db
      .update(uploadSessions)
      .set({ status: 'completed', updatedAt: new Date() })
      .where(eq(uploadSessions.id, session.id));
    await this.database.db
      .update(videos)
      .set({
        status: 'processing',
        sourceKey: session.storageKey,
        sourceSize: session.size,
        sourceFilename: session.filename,
        updatedAt: new Date(),
      })
      .where(eq(videos.id, session.videoId));
    if (session.partId) {
      await this.database.db
        .update(videoParts)
        .set({
          status: 'processing',
          sourceKey: session.storageKey,
          sourceSize: session.size,
          sourceFilename: session.filename,
          updatedAt: new Date(),
        })
        .where(eq(videoParts.id, session.partId));
    }
    await this.queue.enqueue(
      'transcode',
      {
        videoId: session.videoId,
        sourceKey: session.storageKey,
        uploadSessionId: session.id,
        ...(session.partId ? { partId: session.partId } : {}),
      },
      {
        idempotencyKey: `transcode:${session.id}`,
        maxAttempts: 3,
      },
    );
    return { videoId: session.videoId, status: 'processing' };
  }

  async publish(user: AuthUser, id: string, publishAt?: string) {
    const video = await this.getOwnVideo(user.id, id);
    const canReview = user.permissions.includes('video:review');
    if (!['ready', 'pending_review', 'published'].includes(video.status)) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '视频尚未完成处理', 400);
    }
    const parts = await this.database.db
      .select({ id: videoParts.id, status: videoParts.status })
      .from(videoParts)
      .where(eq(videoParts.videoId, id));
    if (parts.some((part) => part.status !== 'ready')) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '仍有分 P 未完成转码', 400);
    }
    const upload = await this.settings.getUploadSettings();
    const reviewRequired = Boolean(upload.requireReview) && !canReview;
    const status = reviewRequired && video.status !== 'published' ? 'pending_review' : 'published';
    const publishedAt = publishAt ? new Date(publishAt) : new Date();
    const delaySeconds = Math.max(0, Math.floor((publishedAt.getTime() - Date.now()) / 1000));
    const [updated] = await this.database.db
      .update(videos)
      .set({
        status,
        publishedAt,
        updatedAt: new Date(),
      })
      .where(eq(videos.id, id))
      .returning();
    if (status === 'published') {
      await this.queue.enqueue(
        'search-index',
        { videoId: id },
        { idempotencyKey: `search:${id}`, delaySeconds },
      );
      await this.queue.enqueue(
        'notify-followers',
        { videoId: id },
        { idempotencyKey: `notify-followers:${id}`, delaySeconds },
      );
    }
    return updated ? this.studioPayload(updated) : null;
  }

  async setCover(userId: string, id: string, buffer: Buffer, contentType: string) {
    await this.getOwnVideo(userId, id);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '封面只支持 JPEG、PNG 或 WebP', 400);
    }
    if (buffer.length > 5 * 1024 * 1024) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '封面不能超过 5 MB', 400);
    }
    const extension =
      contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
    const key = `covers/${id}/${crypto.randomUUID()}.${extension}`;
    const provider = await this.storage.provider();
    await provider.putObject(key, buffer, contentType);
    const url = `/media/${key
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/')}`;
    await this.database.db
      .update(videos)
      .set({ coverUrl: url, updatedAt: new Date() })
      .where(eq(videos.id, id));
    return { coverUrl: url };
  }

  async setSubtitle(userId: string, id: string, language: string, label: string, content: string) {
    await this.getOwnVideo(userId, id);
    if (!/^[a-zA-Z0-9-]{2,16}$/.test(language)) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '字幕语言代码不合法', 400);
    }
    if (content.length > 5 * 1024 * 1024) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '字幕文件不能超过 5 MB', 400);
    }
    const storageKey = `videos/${id}/subtitles/${language}.vtt`;
    const provider = await this.storage.provider();
    await provider.putObject(storageKey, Buffer.from(content, 'utf8'), 'text/vtt');
    await this.database.db
      .insert(videoSubtitles)
      .values({ videoId: id, language, label: label.slice(0, 40), storageKey })
      .onConflictDoUpdate({
        target: [videoSubtitles.videoId, videoSubtitles.language],
        set: { label: label.slice(0, 40), storageKey },
      });
    return { ok: true, language, label };
  }

  async listParts(userId: string, videoId: string) {
    await this.getOwnVideo(userId, videoId);
    const rows = await this.database.db
      .select()
      .from(videoParts)
      .where(eq(videoParts.videoId, videoId))
      .orderBy(videoParts.sort, videoParts.createdAt);
    return { items: rows.map((part) => this.partPayload(part)) };
  }

  async createPart(userId: string, videoId: string, input: { title: string; sort?: number }) {
    await this.getOwnVideo(userId, videoId);
    const [maxRow] = await this.database.db
      .select({ value: sql<number>`COALESCE(MAX(${videoParts.sort}), 0)` })
      .from(videoParts)
      .where(eq(videoParts.videoId, videoId));
    const [created] = await this.database.db
      .insert(videoParts)
      .values({
        videoId,
        title: input.title.trim().slice(0, 80),
        sort: input.sort ?? Number(maxRow?.value ?? 0) + 1,
        status: 'draft',
      })
      .returning();
    if (!created) throw new AppError(ERROR_CODES.INTERNAL_ERROR, '创建分 P 失败', 500);
    return this.partPayload(created);
  }

  async updatePart(
    userId: string,
    videoId: string,
    partId: string,
    input: { title?: string; sort?: number },
  ) {
    await this.getOwnPart(userId, videoId, partId);
    const [updated] = await this.database.db
      .update(videoParts)
      .set({
        title: input.title?.trim().slice(0, 80),
        sort: input.sort,
        updatedAt: new Date(),
      })
      .where(eq(videoParts.id, partId))
      .returning();
    if (!updated) throw new AppError(ERROR_CODES.NOT_FOUND, '分 P 不存在', 404);
    return this.partPayload(updated);
  }

  async removePart(userId: string, videoId: string, partId: string) {
    const part = await this.getOwnPart(userId, videoId, partId);
    if (part.status === 'processing') {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '分 P 正在转码，暂时不能删除', 400);
    }
    await this.database.db.delete(videoParts).where(eq(videoParts.id, partId));
    return { ok: true };
  }

  async listSubtitles(userId: string, videoId: string) {
    await this.getOwnVideo(userId, videoId);
    const rows = await this.database.db
      .select()
      .from(videoSubtitles)
      .where(eq(videoSubtitles.videoId, videoId));
    return {
      items: rows.map((subtitle) => ({
        language: subtitle.language,
        label: subtitle.label,
        createdAt: subtitle.createdAt.toISOString(),
      })),
    };
  }

  async removeSubtitle(userId: string, videoId: string, language: string) {
    await this.getOwnVideo(userId, videoId);
    const rows = await this.database.db
      .select()
      .from(videoSubtitles)
      .where(and(eq(videoSubtitles.videoId, videoId), eq(videoSubtitles.language, language)))
      .limit(1);
    if (!rows[0]) throw new AppError(ERROR_CODES.NOT_FOUND, '字幕不存在', 404);
    const provider = await this.storage.provider();
    await provider.deleteObject(rows[0].storageKey).catch(() => undefined);
    await this.database.db.delete(videoSubtitles).where(eq(videoSubtitles.id, rows[0].id));
    return { ok: true };
  }

  async stats(userId: string, videoId: string) {
    const video = await this.getOwnVideo(userId, videoId);
    const since = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
    const [daily, viewsTotal, completions] = await Promise.all([
      this.database.db
        .select({
          day: sql<string>`to_char(${watchEvents.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`,
          value: count(),
        })
        .from(watchEvents)
        .where(
          and(
            eq(watchEvents.videoId, videoId),
            eq(watchEvents.eventType, 'view'),
            gte(watchEvents.createdAt, since),
          ),
        )
        .groupBy(sql`to_char(${watchEvents.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`)
        .orderBy(sql`to_char(${watchEvents.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`),
      this.database.db
        .select({ value: count() })
        .from(watchEvents)
        .where(and(eq(watchEvents.videoId, videoId), eq(watchEvents.eventType, 'view'))),
      this.database.db
        .select({ value: count() })
        .from(watchEvents)
        .where(and(eq(watchEvents.videoId, videoId), eq(watchEvents.eventType, 'complete'))),
    ]);
    const totalViews = Number(viewsTotal[0]?.value ?? 0);
    return {
      totals: {
        views: video.viewCount,
        likes: video.likeCount,
        coins: video.coinCount,
        favorites: video.favoriteCount,
        comments: video.commentCount,
        danmaku: video.danmakuCount,
      },
      daily: daily.map((row) => ({ day: row.day, views: Number(row.value) })),
      totalTrackedViews: totalViews,
      completions: Number(completions[0]?.value ?? 0),
      completionRate:
        totalViews > 0
          ? Number(((Number(completions[0]?.value ?? 0) / totalViews) * 100).toFixed(1))
          : 0,
      rangeDays: 30,
    };
  }

  private async getOwnPart(userId: string, videoId: string, partId: string) {
    await this.getOwnVideo(userId, videoId);
    const rows = await this.database.db
      .select()
      .from(videoParts)
      .where(and(eq(videoParts.id, partId), eq(videoParts.videoId, videoId)))
      .limit(1);
    if (!rows[0]) throw new AppError(ERROR_CODES.NOT_FOUND, '分 P 不存在', 404);
    return rows[0];
  }

  private partPayload(part: typeof videoParts.$inferSelect) {
    return {
      id: part.id,
      title: part.title,
      sort: part.sort,
      status: part.status,
      durationSeconds: part.durationSeconds,
      sourceFilename: part.sourceFilename,
      sourceSize: part.sourceSize,
      playlistUrl:
        part.playlistKey && ['ready', 'published'].includes(part.status)
          ? `/api/v1/videos/${part.videoId}/parts/${part.id}/hls/master.m3u8`
          : null,
      createdAt: part.createdAt.toISOString(),
      updatedAt: part.updatedAt.toISOString(),
    };
  }

  async getOwnVideo(userId: string, id: string): Promise<DbVideo> {
    const rows = await this.database.db
      .select()
      .from(videos)
      .where(and(eq(videos.id, id), eq(videos.uploaderId, userId), isNull(videos.deletedAt)))
      .limit(1);
    const video = rows[0];
    if (!video) throw new AppError(ERROR_CODES.NOT_FOUND, '稿件不存在', 404);
    return video;
  }

  private async getSession(userId: string, uploadId: string) {
    const rows = await this.database.db
      .select()
      .from(uploadSessions)
      .where(and(eq(uploadSessions.id, uploadId), eq(uploadSessions.userId, userId)))
      .limit(1);
    const session = rows[0];
    if (!session) throw new AppError(ERROR_CODES.NOT_FOUND, '上传会话不存在', 404);
    if (session.status !== 'uploading') {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '上传会话已结束', 400);
    }
    if (session.expiresAt < new Date()) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '上传会话已过期', 400);
    }
    return session;
  }

  private async refreshUploadedCount(uploadSessionId: string) {
    const [countRow] = await this.database.db
      .select({ value: count() })
      .from(uploadParts)
      .where(eq(uploadParts.uploadSessionId, uploadSessionId));
    await this.database.db
      .update(uploadSessions)
      .set({ uploadedChunks: Number(countRow?.value ?? 0), updatedAt: new Date() })
      .where(eq(uploadSessions.id, uploadSessionId));
  }

  private async setTags(videoId: string, names: string[]) {
    const clean = [...new Set(names.map((name) => name.trim()).filter(Boolean))].slice(0, 12);
    await this.database.db.delete(videoTags).where(eq(videoTags.videoId, videoId));
    if (clean.length === 0) return;
    for (const name of clean) {
      await this.database.db
        .insert(tags)
        .values({ name, slug: tagSlug(name) })
        .onConflictDoNothing();
    }
    const rows = await this.database.db.select().from(tags).where(inArray(tags.name, clean));
    if (rows.length === 0) return;
    await this.database.db
      .insert(videoTags)
      .values(rows.map((tag) => ({ videoId, tagId: tag.id })))
      .onConflictDoNothing();
  }

  private async validateCategory(categoryId?: string | null) {
    if (!categoryId) return;
    const rows = await this.database.db
      .select({ id: categories.id })
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1);
    if (rows.length === 0) throw new AppError(ERROR_CODES.BAD_REQUEST, '分区不存在', 400);
  }

  private studioPayload(video: DbVideo) {
    return {
      id: video.id,
      title: video.title,
      description: video.description,
      coverUrl: video.coverUrl,
      status: video.status,
      visibility: video.visibility,
      categoryId: video.categoryId,
      durationSeconds: video.durationSeconds,
      views: video.viewCount,
      likes: video.likeCount,
      coins: video.coinCount,
      comments: video.commentCount,
      danmaku: video.danmakuCount,
      sourceFilename: video.sourceFilename,
      sourceSize: video.sourceSize,
      publishedAt: video.publishedAt?.toISOString() ?? null,
      createdAt: video.createdAt.toISOString(),
      updatedAt: video.updatedAt.toISOString(),
      playlistUrl: video.playlistKey ? `/api/v1/videos/${video.id}/hls/master.m3u8` : null,
    };
  }
}
