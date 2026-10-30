import crypto from 'node:crypto';
import path from 'node:path';
import { Injectable } from '@nestjs/common';
import {
  type DbVideo,
  categories,
  collectionItems,
  collections,
  comments,
  danmaku,
  followEvents,
  follows,
  notifications,
  tags,
  uploadParts,
  uploadSessions,
  userBadges,
  users,
  videoAppeals,
  videoCollaborators,
  videoParts,
  videoStatusLogs,
  videoSubtitles,
  videoTags,
  videos,
  watchEvents,
} from '@uiliuili/db';
import {
  AppError,
  BADGES,
  ERROR_CODES,
  LEVEL_THRESHOLDS,
  MAX_UPLOAD_CHUNK_BYTES,
  type VideoCreateInput,
  normalizeRegionList,
} from '@uiliuili/shared';
import { and, count, desc, eq, gte, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm';
import type { AuthUser } from '../common/auth-user';
import { DatabaseService } from '../common/database.service';
import { QueueService } from '../common/queue.service';
import { RateLimitService } from '../common/rate-limit.service';
import { currentRegionContext } from '../common/region-context';
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
    private readonly rateLimit: RateLimitService,
  ) {}

  async list(userId: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const where = and(
      isNull(videos.deletedAt),
      or(
        eq(videos.uploaderId, userId),
        sql`EXISTS (SELECT 1 FROM "uiliuili"."video_collaborators" vc WHERE vc."video_id" = ${videos.id} AND vc."user_id" = ${userId} AND vc."status" = 'accepted')`,
      ),
    );
    const [rows, total] = await Promise.all([
      this.database.db
        .select()
        .from(videos)
        .where(where)
        .orderBy(desc(videos.updatedAt))
        .limit(limit)
        .offset(offset),
      this.database.db.select({ value: count() }).from(videos).where(where),
    ]);
    return {
      items: rows.map((video) => this.studioPayload(video)),
      total: Number(total[0]?.value ?? 0),
      page,
      limit,
    };
  }

  async get(userId: string, id: string) {
    const video = await this.getOwnVideo(userId, id, true);
    const [parts, subtitles, collaborators] = await Promise.all([
      this.database.db
        .select()
        .from(videoParts)
        .where(eq(videoParts.videoId, id))
        .orderBy(videoParts.sort, videoParts.createdAt),
      this.database.db.select().from(videoSubtitles).where(eq(videoSubtitles.videoId, id)),
      this.collaboratorList(id),
    ]);
    return {
      ...this.studioPayload(video),
      isOwner: video.uploaderId === userId,
      collaborators: collaborators.items,
      parts: parts.map((part) => this.partPayload(part)),
      subtitles: subtitles.map((subtitle) => ({
        language: subtitle.language,
        label: subtitle.label,
        createdAt: subtitle.createdAt.toISOString(),
      })),
    };
  }

  async create(userId: string, input: VideoCreateInput, ip?: string) {
    await this.rateLimit.check('upload', {
      userId,
      ip,
      staff: false,
    });
    await this.validateCategory(input.categoryId);
    const policy = await this.regionPolicy(input);
    const [created] = await this.database.db
      .insert(videos)
      .values({
        uploaderId: userId,
        title: input.title,
        description: input.description,
        categoryId: input.categoryId ?? null,
        visibility: input.visibility,
        status: 'draft',
        contentType: input.contentType ?? 'original',
        sourceUrl: input.sourceUrl ?? '',
        aiGenerated: input.aiGenerated ?? false,
        allowComments: input.allowComments ?? true,
        allowDanmaku: input.allowDanmaku ?? true,
        restricted: policy.restricted,
        regionMode: policy.regionMode,
        regionCodes: policy.regionCodes,
        regionDenyBehavior: policy.regionDenyBehavior,
        regionDenyMessage: policy.regionDenyMessage,
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
    const current = await this.getOwnVideo(userId, id, true);
    const nextContentType = input.contentType ?? current.contentType;
    const nextSourceUrl = input.sourceUrl ?? current.sourceUrl;
    if (nextContentType === 'repost' && nextSourceUrl.trim().length === 0) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '转载稿件需要填写来源链接', 400);
    }
    await this.validateCategory(input.categoryId);
    const touchesRegion =
      input.restricted !== undefined ||
      input.regionMode !== undefined ||
      input.regionCodes !== undefined ||
      input.regionDenyBehavior !== undefined ||
      input.regionDenyMessage !== undefined;
    const policy = touchesRegion
      ? await this.regionPolicy({
          restricted: input.restricted ?? current.restricted,
          regionMode: input.regionMode ?? current.regionMode,
          regionCodes: input.regionCodes ?? current.regionCodes,
          regionDenyBehavior: input.regionDenyBehavior ?? current.regionDenyBehavior,
          regionDenyMessage: input.regionDenyMessage ?? current.regionDenyMessage,
        })
      : null;
    const [updated] = await this.database.db
      .update(videos)
      .set({
        title: input.title,
        description: input.description,
        categoryId: input.categoryId === undefined ? undefined : input.categoryId,
        visibility: input.visibility,
        coverUrl: input.coverUrl,
        contentType: input.contentType,
        sourceUrl: input.sourceUrl,
        aiGenerated: input.aiGenerated,
        allowComments: input.allowComments,
        allowDanmaku: input.allowDanmaku,
        restricted: policy?.restricted,
        regionMode: policy?.regionMode,
        regionCodes: policy?.regionCodes,
        regionDenyBehavior: policy?.regionDenyBehavior,
        regionDenyMessage: policy?.regionDenyMessage,
        updatedAt: new Date(),
      })
      .where(eq(videos.id, id))
      .returning();
    if (input.tags !== undefined) await this.setTags(id, input.tags);
    if (!updated) throw new AppError(ERROR_CODES.NOT_FOUND, '视频不存在', 404);
    return this.studioPayload(updated);
  }

  /**
   * Resolves the region policy for an upload. Restricted content always uses
   * the site's blocked-region list, which stays authoritative; normal videos
   * may additionally block a chosen set of countries.
   */
  private async regionPolicy(input: {
    restricted?: boolean;
    regionMode?: string;
    regionCodes?: unknown;
    regionDenyBehavior?: string;
    regionDenyMessage?: string;
  }) {
    const context = currentRegionContext();
    const restrictedSettings = await this.settings.getRestrictedSettings();
    const blockedRegions = normalizeRegionList(restrictedSettings.blockedRegions);
    const behavior =
      input.regionDenyBehavior === 'message' || input.regionDenyBehavior === 'not_found'
        ? input.regionDenyBehavior
        : 'default';
    const message = (input.regionDenyMessage ?? '').slice(0, 200);
    if (input.restricted) {
      if (!context.code || blockedRegions.includes(context.code)) {
        throw new AppError(ERROR_CODES.FORBIDDEN, '当前地区不能发布限制级内容', 403);
      }
      return {
        restricted: true,
        regionMode: 'block' as const,
        regionCodes: blockedRegions,
        regionDenyBehavior: behavior,
        regionDenyMessage: message,
      };
    }
    const regionCodes = normalizeRegionList(input.regionCodes);
    return {
      restricted: false,
      regionMode: input.regionMode === 'block' && regionCodes.length > 0 ? 'block' : 'inherit',
      regionCodes: input.regionMode === 'block' && regionCodes.length > 0 ? regionCodes : [],
      regionDenyBehavior: behavior,
      regionDenyMessage: message,
    };
  }

  async remove(userId: string, id: string) {
    const video = await this.getOwnVideo(userId, id);
    await this.database.db
      .update(videos)
      .set({ status: 'deleted', deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(videos.id, id));
    await this.logStatus(id, video.status, 'deleted', userId, 'uploader');
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
    if (status !== video.status) {
      await this.logStatus(id, video.status, status, user.id, 'publish');
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
    const video = await this.getOwnVideo(userId, videoId, true);
    const since = new Date(Date.now() - 29 * 24 * 60 * 60 * 1000);
    const [daily, viewsTotal, completions, sources, devices, countries] = await Promise.all([
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
      this.breakdown('source', [videoId], since),
      this.breakdown('device', [videoId], since),
      this.breakdown('country', [videoId], since),
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
      sources: sources.map((row) => ({ key: row.key, value: Number(row.value) })),
      devices: devices.map((row) => ({ key: row.key, value: Number(row.value) })),
      countries: countries.map((row) => ({ key: row.key, value: Number(row.value) })),
    };
  }

  async listDeleted(userId: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const where = and(eq(videos.uploaderId, userId), isNotNull(videos.deletedAt));
    const [rows, total] = await Promise.all([
      this.database.db
        .select()
        .from(videos)
        .where(where)
        .orderBy(desc(videos.deletedAt))
        .limit(limit)
        .offset(offset),
      this.database.db.select({ value: count() }).from(videos).where(where),
    ]);
    return {
      items: rows.map((video) => this.studioPayload(video)),
      total: Number(total[0]?.value ?? 0),
      page,
      limit,
    };
  }

  async restore(userId: string, id: string) {
    const rows = await this.database.db
      .select()
      .from(videos)
      .where(and(eq(videos.id, id), eq(videos.uploaderId, userId), isNotNull(videos.deletedAt)))
      .limit(1);
    const video = rows[0];
    if (!video) throw new AppError(ERROR_CODES.NOT_FOUND, '回收站中没有该稿件', 404);
    const status = video.publishedAt ? 'published' : video.playlistKey ? 'ready' : 'draft';
    const [updated] = await this.database.db
      .update(videos)
      .set({ status, deletedAt: null, updatedAt: new Date() })
      .where(eq(videos.id, id))
      .returning();
    await this.logStatus(id, 'deleted', status, userId, 'restore');
    return updated ? this.studioPayload(updated) : null;
  }

  async purge(userId: string, id: string) {
    const rows = await this.database.db
      .select()
      .from(videos)
      .where(and(eq(videos.id, id), eq(videos.uploaderId, userId), isNotNull(videos.deletedAt)))
      .limit(1);
    if (!rows[0]) throw new AppError(ERROR_CODES.NOT_FOUND, '回收站中没有该稿件', 404);
    const provider = await this.storage.provider();
    await provider.deletePrefix(`videos/${id}`).catch(() => undefined);
    await provider.deletePrefix(`covers/${id}`).catch(() => undefined);
    await this.database.db.delete(videos).where(eq(videos.id, id));
    return { ok: true };
  }

  async history(userId: string, id: string) {
    await this.getOwnVideo(userId, id, true);
    const rows = await this.database.db
      .select({
        id: videoStatusLogs.id,
        fromStatus: videoStatusLogs.fromStatus,
        toStatus: videoStatusLogs.toStatus,
        reason: videoStatusLogs.reason,
        createdAt: videoStatusLogs.createdAt,
        actor: users.displayName,
      })
      .from(videoStatusLogs)
      .leftJoin(users, eq(users.id, videoStatusLogs.actorId))
      .where(eq(videoStatusLogs.videoId, id))
      .orderBy(desc(videoStatusLogs.createdAt))
      .limit(50);
    return {
      items: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
    };
  }

  async listAppeals(userId: string, page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    const where = eq(videoAppeals.userId, userId);
    const [rows, total] = await Promise.all([
      this.database.db
        .select({
          appeal: videoAppeals,
          videoTitle: videos.title,
          videoStatus: videos.status,
          videoCover: videos.coverUrl,
        })
        .from(videoAppeals)
        .innerJoin(videos, eq(videos.id, videoAppeals.videoId))
        .where(where)
        .orderBy(desc(videoAppeals.createdAt))
        .limit(limit)
        .offset(offset),
      this.database.db.select({ value: count() }).from(videoAppeals).where(where),
    ]);
    return {
      items: rows.map(({ appeal, videoTitle, videoStatus, videoCover }) => ({
        id: appeal.id,
        videoId: appeal.videoId,
        videoTitle,
        videoStatus,
        videoCover,
        reason: appeal.reason,
        detail: appeal.detail,
        status: appeal.status,
        handleNote: appeal.handleNote,
        handledAt: appeal.handledAt?.toISOString() ?? null,
        createdAt: appeal.createdAt.toISOString(),
      })),
      total: Number(total[0]?.value ?? 0),
      page,
      limit,
    };
  }

  async createAppeal(userId: string, id: string, input: { reason: string; detail?: string }) {
    await this.getOwnedVideo(userId, id);
    const existing = await this.database.db
      .select({ id: videoAppeals.id })
      .from(videoAppeals)
      .where(
        and(
          eq(videoAppeals.videoId, id),
          eq(videoAppeals.userId, userId),
          eq(videoAppeals.status, 'pending'),
        ),
      )
      .limit(1);
    if (existing[0]) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '该稿件已有待处理的申诉', 400);
    }
    const [created] = await this.database.db
      .insert(videoAppeals)
      .values({
        videoId: id,
        userId,
        reason: input.reason,
        detail: (input.detail ?? '').slice(0, 1000),
      })
      .returning();
    if (!created) throw new AppError(ERROR_CODES.INTERNAL_ERROR, '提交申诉失败', 500);
    await this.database.db.insert(notifications).values({
      userId,
      type: 'appeal',
      title: '申诉已提交',
      body: '我们会在审核后通知你处理结果。',
      link: '/studio/appeals',
    });
    return {
      id: created.id,
      status: created.status,
      createdAt: created.createdAt.toISOString(),
    };
  }

  async analytics(userId: string, days = 30) {
    const rangeDays = Math.max(1, Math.min(365, Math.floor(days) || 30));
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (rangeDays - 1));
    // Raw SQL parameters bypass Drizzle's column encoders, so hand postgres a
    // timestamp string instead of a Date instance.
    const sinceIso = since.toISOString();
    const owned = await this.database.db
      .select({
        id: videos.id,
        title: videos.title,
        coverUrl: videos.coverUrl,
        viewCount: videos.viewCount,
        likeCount: videos.likeCount,
        coinCount: videos.coinCount,
        favoriteCount: videos.favoriteCount,
        commentCount: videos.commentCount,
        danmakuCount: videos.danmakuCount,
      })
      .from(videos)
      .where(and(eq(videos.uploaderId, userId), isNull(videos.deletedAt)));
    const ids = owned.map((video) => video.id);
    const emptyDaily = this.emptyDailySeries(rangeDays);
    if (ids.length === 0) {
      return {
        rangeDays,
        totals: {
          views: 0,
          likes: 0,
          coins: 0,
          favorites: 0,
          comments: 0,
          danmaku: 0,
          followers: 0,
          gained: 0,
          lost: 0,
        },
        daily: emptyDaily,
        sources: [],
        devices: [],
        countries: [],
        topVideos: [],
      };
    }
    const [dailyRows, sources, devices, countries, topRows, followRows, interactionRows] =
      await Promise.all([
        this.database.db
          .select({
            day: sql<string>`to_char(${watchEvents.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`,
            views: sql<number>`count(*) filter (where ${watchEvents.eventType} = 'view')`,
            completions: sql<number>`count(*) filter (where ${watchEvents.eventType} = 'complete')`,
            uniqueViewers: sql<number>`count(distinct ${watchEvents.userId}) filter (where ${watchEvents.eventType} = 'view')`,
          })
          .from(watchEvents)
          .where(and(inArray(watchEvents.videoId, ids), gte(watchEvents.createdAt, since)))
          .groupBy(sql`1`)
          .orderBy(sql`1`),
        this.breakdown('source', ids, since),
        this.breakdown('device', ids, since),
        this.breakdown('country', ids, since),
        this.database.db
          .select({ videoId: watchEvents.videoId, views: count() })
          .from(watchEvents)
          .where(
            and(
              inArray(watchEvents.videoId, ids),
              eq(watchEvents.eventType, 'view'),
              gte(watchEvents.createdAt, since),
            ),
          )
          .groupBy(watchEvents.videoId)
          .orderBy(desc(count()))
          .limit(10),
        this.database.db
          .select({
            day: sql<string>`to_char(${followEvents.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`,
            eventType: followEvents.eventType,
            value: count(),
          })
          .from(followEvents)
          .where(and(eq(followEvents.followingId, userId), gte(followEvents.createdAt, since)))
          .groupBy(sql`1`, followEvents.eventType),
        this.database.db.execute(sql`
          SELECT day,
                 SUM(likes)::int AS likes,
                 SUM(coins)::int AS coins,
                 SUM(favorites)::int AS favorites,
                 SUM(comments)::int AS comments,
                 SUM(danmaku)::int AS danmaku
          FROM (
            SELECT to_char("created_at" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
                   1 AS likes, 0 AS coins, 0 AS favorites, 0 AS comments, 0 AS danmaku
            FROM "uiliuili"."video_likes"
            WHERE "video_id" IN (${sql.join(
              ids.map((id) => sql`${id}::uuid`),
              sql`, `,
            )})
              AND "created_at" >= ${sinceIso}
            UNION ALL
            SELECT to_char("created_at" AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
                   0, 1, 0, 0, 0
            FROM "uiliuili"."video_coins"
            WHERE "video_id" IN (${sql.join(
              ids.map((id) => sql`${id}::uuid`),
              sql`, `,
            )})
              AND "created_at" >= ${sinceIso}
            UNION ALL
            SELECT to_char("created_at" AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
                   0, 0, 1, 0, 0
            FROM "uiliuili"."favorite_items"
            WHERE "video_id" IN (${sql.join(
              ids.map((id) => sql`${id}::uuid`),
              sql`, `,
            )})
              AND "created_at" >= ${sinceIso}
            UNION ALL
            SELECT to_char("created_at" AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
                   0, 0, 0, 1, 0
            FROM "uiliuili"."comments"
            WHERE "video_id" IN (${sql.join(
              ids.map((id) => sql`${id}::uuid`),
              sql`, `,
            )})
              AND "created_at" >= ${sinceIso}
            UNION ALL
            SELECT to_char("created_at" AT TIME ZONE 'UTC', 'YYYY-MM-DD'),
                   0, 0, 0, 0, 1
            FROM "uiliuili"."danmaku"
            WHERE "video_id" IN (${sql.join(
              ids.map((id) => sql`${id}::uuid`),
              sql`, `,
            )})
              AND "created_at" >= ${sinceIso}
          ) AS events
          GROUP BY day
        `),
      ]);
    const interactionMap = new Map<string, Record<string, number>>();
    for (const row of interactionRows as unknown as Array<Record<string, unknown>>) {
      interactionMap.set(String(row.day), {
        likes: Number(row.likes ?? 0),
        coins: Number(row.coins ?? 0),
        favorites: Number(row.favorites ?? 0),
        comments: Number(row.comments ?? 0),
        danmaku: Number(row.danmaku ?? 0),
      });
    }
    const followMap = new Map<string, { gained: number; lost: number }>();
    for (const row of followRows) {
      const entry = followMap.get(row.day) ?? { gained: 0, lost: 0 };
      if (row.eventType === 'follow') entry.gained += Number(row.value);
      else entry.lost += Number(row.value);
      followMap.set(row.day, entry);
    }
    const dailyMap = new Map(
      dailyRows.map((row) => [
        row.day,
        {
          views: Number(row.views),
          completions: Number(row.completions),
          uniqueViewers: Number(row.uniqueViewers),
        },
      ]),
    );
    const daily = emptyDaily.map((entry) => {
      const views = dailyMap.get(entry.day);
      const interactions = interactionMap.get(entry.day);
      const follower = followMap.get(entry.day);
      return {
        ...entry,
        views: views?.views ?? 0,
        completions: views?.completions ?? 0,
        uniqueViewers: views?.uniqueViewers ?? 0,
        likes: interactions?.likes ?? 0,
        coins: interactions?.coins ?? 0,
        favorites: interactions?.favorites ?? 0,
        comments: interactions?.comments ?? 0,
        danmaku: interactions?.danmaku ?? 0,
        followersGained: follower?.gained ?? 0,
        followersLost: follower?.lost ?? 0,
      };
    });
    const sum = (key: 'views' | 'likes' | 'coins' | 'favorites' | 'comments' | 'danmaku') =>
      daily.reduce((total, entry) => total + entry[key], 0);
    const titleMap = new Map(owned.map((video) => [video.id, video]));
    return {
      rangeDays,
      totals: {
        views: sum('views'),
        likes: sum('likes'),
        coins: sum('coins'),
        favorites: sum('favorites'),
        comments: sum('comments'),
        danmaku: sum('danmaku'),
        followers: daily.reduce(
          (total, entry) => total + entry.followersGained - entry.followersLost,
          0,
        ),
        gained: daily.reduce((total, entry) => total + entry.followersGained, 0),
        lost: daily.reduce((total, entry) => total + entry.followersLost, 0),
      },
      daily,
      sources,
      devices,
      countries,
      topVideos: topRows.map((row) => {
        const video = titleMap.get(row.videoId);
        return {
          id: row.videoId,
          title: video?.title ?? '',
          coverUrl: video?.coverUrl ?? null,
          views: Number(row.views),
        };
      }),
    };
  }

  private emptyDailySeries(days: number) {
    const series: Array<{
      day: string;
      views: number;
      completions: number;
      uniqueViewers: number;
      likes: number;
      coins: number;
      favorites: number;
      comments: number;
      danmaku: number;
      followersGained: number;
      followersLost: number;
    }> = [];
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - (days - 1));
    for (let index = 0; index < days; index += 1) {
      const date = new Date(start);
      date.setUTCDate(start.getUTCDate() + index);
      series.push({
        day: date.toISOString().slice(0, 10),
        views: 0,
        completions: 0,
        uniqueViewers: 0,
        likes: 0,
        coins: 0,
        favorites: 0,
        comments: 0,
        danmaku: 0,
        followersGained: 0,
        followersLost: 0,
      });
    }
    return series;
  }

  private breakdown(field: 'source' | 'device' | 'country', ids: string[], since: Date) {
    const column =
      field === 'source'
        ? watchEvents.source
        : field === 'device'
          ? watchEvents.device
          : watchEvents.country;
    return this.database.db
      .select({ key: column, value: count() })
      .from(watchEvents)
      .where(
        and(
          inArray(watchEvents.videoId, ids),
          eq(watchEvents.eventType, 'view'),
          gte(watchEvents.createdAt, since),
        ),
      )
      .groupBy(column)
      .orderBy(desc(count()))
      .limit(12);
  }

  async commentsInbox(userId: string, query: { page: number; limit: number; status?: string }) {
    const where = and(
      eq(videos.uploaderId, userId),
      isNull(comments.deletedAt),
      query.status ? eq(comments.status, query.status) : undefined,
    );
    const offset = (query.page - 1) * query.limit;
    const [rows, total] = await Promise.all([
      this.database.db
        .select({
          id: comments.id,
          videoId: comments.videoId,
          videoTitle: videos.title,
          content: comments.content,
          status: comments.status,
          likeCount: comments.likeCount,
          ipRegion: comments.ipRegion,
          createdAt: comments.createdAt,
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        })
        .from(comments)
        .innerJoin(videos, eq(videos.id, comments.videoId))
        .innerJoin(users, eq(users.id, comments.userId))
        .where(where)
        .orderBy(desc(comments.createdAt))
        .limit(query.limit)
        .offset(offset),
      this.database.db
        .select({ value: count() })
        .from(comments)
        .innerJoin(videos, eq(videos.id, comments.videoId))
        .where(where),
    ]);
    return {
      items: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
      total: Number(total[0]?.value ?? 0),
      page: query.page,
      limit: query.limit,
    };
  }

  async moderateComment(userId: string, commentId: string, action: string) {
    const rows = await this.database.db
      .select({ id: comments.id, videoId: comments.videoId })
      .from(comments)
      .innerJoin(videos, eq(videos.id, comments.videoId))
      .where(and(eq(comments.id, commentId), eq(videos.uploaderId, userId)))
      .limit(1);
    if (!rows[0]) throw new AppError(ERROR_CODES.NOT_FOUND, '评论不存在', 404);
    if (action === 'delete') {
      await this.database.db
        .update(comments)
        .set({ status: 'deleted', deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(comments.id, commentId));
    } else {
      await this.database.db
        .update(comments)
        .set({ status: action === 'hide' ? 'hidden' : 'visible', updatedAt: new Date() })
        .where(eq(comments.id, commentId));
    }
    return { ok: true };
  }

  async danmakuInbox(userId: string, query: { page: number; limit: number; status?: string }) {
    const where = and(
      eq(videos.uploaderId, userId),
      query.status ? eq(danmaku.status, query.status) : undefined,
    );
    const offset = (query.page - 1) * query.limit;
    const [rows, total] = await Promise.all([
      this.database.db
        .select({
          id: danmaku.id,
          videoId: danmaku.videoId,
          videoTitle: videos.title,
          content: danmaku.content,
          progressMs: danmaku.progressMs,
          color: danmaku.color,
          mode: danmaku.mode,
          status: danmaku.status,
          createdAt: danmaku.createdAt,
          username: users.username,
          displayName: users.displayName,
        })
        .from(danmaku)
        .innerJoin(videos, eq(videos.id, danmaku.videoId))
        .innerJoin(users, eq(users.id, danmaku.userId))
        .where(where)
        .orderBy(desc(danmaku.createdAt))
        .limit(query.limit)
        .offset(offset),
      this.database.db
        .select({ value: count() })
        .from(danmaku)
        .innerJoin(videos, eq(videos.id, danmaku.videoId))
        .where(where),
    ]);
    return {
      items: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
      total: Number(total[0]?.value ?? 0),
      page: query.page,
      limit: query.limit,
    };
  }

  async moderateDanmaku(userId: string, danmakuId: string, action: string) {
    const rows = await this.database.db
      .select({ id: danmaku.id })
      .from(danmaku)
      .innerJoin(videos, eq(videos.id, danmaku.videoId))
      .where(and(eq(danmaku.id, danmakuId), eq(videos.uploaderId, userId)))
      .limit(1);
    if (!rows[0]) throw new AppError(ERROR_CODES.NOT_FOUND, '弹幕不存在', 404);
    await this.database.db
      .update(danmaku)
      .set({ status: action === 'hide' ? 'hidden' : 'visible' })
      .where(eq(danmaku.id, danmakuId));
    return { ok: true };
  }

  async listCollections(userId: string) {
    const rows = await this.database.db
      .select()
      .from(collections)
      .where(eq(collections.userId, userId))
      .orderBy(desc(collections.updatedAt));
    const counts = rows.length
      ? await this.database.db
          .select({ collectionId: collectionItems.collectionId, value: count() })
          .from(collectionItems)
          .where(
            inArray(
              collectionItems.collectionId,
              rows.map((row) => row.id),
            ),
          )
          .groupBy(collectionItems.collectionId)
      : [];
    const countMap = new Map(counts.map((row) => [row.collectionId, Number(row.value)]));
    return {
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        coverUrl: row.coverUrl,
        kind: row.kind,
        visibility: row.visibility,
        itemCount: countMap.get(row.id) ?? 0,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
    };
  }

  async createCollection(
    userId: string,
    input: { title: string; description?: string; kind?: string; visibility?: string },
  ) {
    const [created] = await this.database.db
      .insert(collections)
      .values({
        userId,
        title: input.title.slice(0, 80),
        description: (input.description ?? '').slice(0, 2000),
        kind: input.kind === 'series' ? 'series' : 'collection',
        visibility: input.visibility ?? 'public',
      })
      .returning();
    if (!created) throw new AppError(ERROR_CODES.INTERNAL_ERROR, '创建合集失败', 500);
    return { id: created.id };
  }

  async updateCollection(
    userId: string,
    id: string,
    input: { title?: string; description?: string; visibility?: string },
  ) {
    const [updated] = await this.database.db
      .update(collections)
      .set({
        title: input.title?.slice(0, 80),
        description: input.description?.slice(0, 2000),
        visibility: input.visibility,
        updatedAt: new Date(),
      })
      .where(and(eq(collections.id, id), eq(collections.userId, userId)))
      .returning();
    if (!updated) throw new AppError(ERROR_CODES.NOT_FOUND, '合集不存在', 404);
    return { ok: true };
  }

  async deleteCollection(userId: string, id: string) {
    const [deleted] = await this.database.db
      .delete(collections)
      .where(and(eq(collections.id, id), eq(collections.userId, userId)))
      .returning();
    if (!deleted) throw new AppError(ERROR_CODES.NOT_FOUND, '合集不存在', 404);
    return { ok: true };
  }

  async addCollectionItem(userId: string, id: string, videoId: string) {
    const owned = await this.database.db
      .select({ id: collections.id })
      .from(collections)
      .where(and(eq(collections.id, id), eq(collections.userId, userId)))
      .limit(1);
    if (!owned[0]) throw new AppError(ERROR_CODES.NOT_FOUND, '合集不存在', 404);
    await this.getOwnedVideo(userId, videoId);
    const [maxRow] = await this.database.db
      .select({ value: sql<number>`COALESCE(MAX(${collectionItems.sort}), 0)` })
      .from(collectionItems)
      .where(eq(collectionItems.collectionId, id));
    await this.database.db
      .insert(collectionItems)
      .values({ collectionId: id, videoId, sort: Number(maxRow?.value ?? 0) + 1 })
      .onConflictDoNothing();
    await this.database.db
      .update(collections)
      .set({ updatedAt: new Date() })
      .where(eq(collections.id, id));
    return { ok: true };
  }

  async removeCollectionItem(userId: string, id: string, videoId: string) {
    const owned = await this.database.db
      .select({ id: collections.id })
      .from(collections)
      .where(and(eq(collections.id, id), eq(collections.userId, userId)))
      .limit(1);
    if (!owned[0]) throw new AppError(ERROR_CODES.NOT_FOUND, '合集不存在', 404);
    await this.database.db
      .delete(collectionItems)
      .where(and(eq(collectionItems.collectionId, id), eq(collectionItems.videoId, videoId)));
    return { ok: true };
  }

  async collectionItems(userId: string, id: string) {
    const owned = await this.database.db
      .select({ id: collections.id })
      .from(collections)
      .where(and(eq(collections.id, id), eq(collections.userId, userId)))
      .limit(1);
    if (!owned[0]) throw new AppError(ERROR_CODES.NOT_FOUND, '合集不存在', 404);
    const rows = await this.database.db
      .select({
        videoId: videos.id,
        title: videos.title,
        coverUrl: videos.coverUrl,
        status: videos.status,
        durationSeconds: videos.durationSeconds,
        sort: collectionItems.sort,
      })
      .from(collectionItems)
      .innerJoin(videos, eq(videos.id, collectionItems.videoId))
      .where(eq(collectionItems.collectionId, id))
      .orderBy(collectionItems.sort);
    return { items: rows };
  }

  async fans(userId: string) {
    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - 29);
    const [followerTotal, followingTotal, recent, trend] = await Promise.all([
      this.database.db
        .select({ value: count() })
        .from(follows)
        .where(eq(follows.followingId, userId)),
      this.database.db
        .select({ value: count() })
        .from(follows)
        .where(eq(follows.followerId, userId)),
      this.database.db
        .select({
          username: users.username,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
          level: users.level,
          createdAt: follows.createdAt,
        })
        .from(follows)
        .innerJoin(users, eq(users.id, follows.followerId))
        .where(eq(follows.followingId, userId))
        .orderBy(desc(follows.createdAt))
        .limit(20),
      this.database.db
        .select({
          day: sql<string>`to_char(${followEvents.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`,
          eventType: followEvents.eventType,
          value: count(),
        })
        .from(followEvents)
        .where(and(eq(followEvents.followingId, userId), gte(followEvents.createdAt, since)))
        .groupBy(sql`1`, followEvents.eventType),
    ]);
    const series = this.emptyDailySeries(30).map((entry) => ({
      day: entry.day,
      gained: 0,
      lost: 0,
    }));
    const map = new Map(series.map((entry) => [entry.day, entry]));
    for (const row of trend) {
      const entry = map.get(row.day);
      if (!entry) continue;
      if (row.eventType === 'follow') entry.gained = Number(row.value);
      else entry.lost = Number(row.value);
    }
    return {
      followers: Number(followerTotal[0]?.value ?? 0),
      following: Number(followingTotal[0]?.value ?? 0),
      recent: recent.map((row) => ({
        username: row.username,
        displayName: row.displayName,
        avatarUrl: row.avatarUrl,
        level: row.level,
        followedAt: row.createdAt.toISOString(),
      })),
      trend: series,
    };
  }

  async growth(userId: string) {
    const [userRow] = await this.database.db
      .select({
        experience: users.experience,
        level: users.level,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    const [videoAgg] = await this.database.db
      .select({
        published: sql<number>`count(*) filter (where ${videos.status} = 'published')`,
        views: sql<number>`COALESCE(SUM(${videos.viewCount}), 0)`,
        likes: sql<number>`COALESCE(SUM(${videos.likeCount}), 0)`,
      })
      .from(videos)
      .where(and(eq(videos.uploaderId, userId), isNull(videos.deletedAt)));
    const [fansRow] = await this.database.db
      .select({ value: count() })
      .from(follows)
      .where(eq(follows.followingId, userId));
    const [danmakuRow] = await this.database.db
      .select({ value: count() })
      .from(danmaku)
      .where(eq(danmaku.userId, userId));
    const badges = await this.database.db
      .select({ code: userBadges.code, awardedAt: userBadges.awardedAt })
      .from(userBadges)
      .where(eq(userBadges.userId, userId));
    const experience = Number(userRow?.experience ?? 0);
    let level = 0;
    for (let index = 0; index < LEVEL_THRESHOLDS.length; index += 1) {
      if (experience >= LEVEL_THRESHOLDS[index]!) level = index;
    }
    const next = LEVEL_THRESHOLDS[Math.min(level + 1, LEVEL_THRESHOLDS.length - 1)]!;
    const current = LEVEL_THRESHOLDS[level]!;
    const stats = {
      published: Number(videoAgg?.published ?? 0),
      views: Number(videoAgg?.views ?? 0),
      likes: Number(videoAgg?.likes ?? 0),
      followers: Number(fansRow?.value ?? 0),
      danmaku: Number(danmakuRow?.value ?? 0),
    };
    return {
      level,
      experience,
      currentLevelExperience: current,
      nextLevelExperience: level >= LEVEL_THRESHOLDS.length - 1 ? null : next,
      progress:
        level >= LEVEL_THRESHOLDS.length - 1
          ? 100
          : Math.round(((experience - current) / Math.max(1, next - current)) * 100),
      badges: badges.map((badge) => {
        const meta = BADGES.find((item) => item.code === badge.code);
        return {
          code: badge.code,
          label: meta?.label ?? badge.code,
          description: meta?.description ?? '',
          awardedAt: badge.awardedAt.toISOString(),
        };
      }),
      stats,
      tasks: [
        { code: 'first_video', label: '发布第一支视频', done: stats.published > 0 },
        { code: 'first_follower', label: '获得第一位粉丝', done: stats.followers > 0 },
        { code: 'hundred_views', label: '累计播放达到 100', done: stats.views >= 100 },
        { code: 'first_danmaku', label: '发送第一条弹幕', done: stats.danmaku > 0 },
      ],
    };
  }

  async collaborators(userId: string, videoId: string) {
    await this.getOwnedVideo(userId, videoId);
    return this.collaboratorList(videoId);
  }

  private async collaboratorList(videoId: string) {
    const rows = await this.database.db
      .select({
        userId: videoCollaborators.userId,
        role: videoCollaborators.role,
        status: videoCollaborators.status,
        username: users.username,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        createdAt: videoCollaborators.createdAt,
      })
      .from(videoCollaborators)
      .innerJoin(users, eq(users.id, videoCollaborators.userId))
      .where(eq(videoCollaborators.videoId, videoId))
      .orderBy(videoCollaborators.createdAt);
    return {
      items: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
    };
  }

  async inviteCollaborator(userId: string, videoId: string, username: string, role: string) {
    await this.getOwnedVideo(userId, videoId);
    const rows = await this.database.db
      .select({ id: users.id, username: users.username, displayName: users.displayName })
      .from(users)
      .where(
        or(
          sql`lower(${users.username}) = ${username.toLowerCase()}`,
          sql`lower(${users.email}) = ${username.toLowerCase()}`,
        ),
      )
      .limit(1);
    const target = rows[0];
    if (!target) throw new AppError(ERROR_CODES.NOT_FOUND, '用户不存在', 404);
    if (target.id === userId) throw new AppError(ERROR_CODES.BAD_REQUEST, '不能邀请自己', 400);
    await this.database.db
      .insert(videoCollaborators)
      .values({
        videoId,
        userId: target.id,
        role: role === 'assistant' ? 'assistant' : 'coauthor',
        status: 'pending',
        invitedBy: userId,
      })
      .onConflictDoUpdate({
        target: [videoCollaborators.videoId, videoCollaborators.userId],
        set: {
          role: role === 'assistant' ? 'assistant' : 'coauthor',
          status: 'pending',
          invitedBy: userId,
          respondedAt: null,
          updatedAt: new Date(),
        },
      });
    const [video] = await this.database.db
      .select({ title: videos.title })
      .from(videos)
      .where(eq(videos.id, videoId))
      .limit(1);
    await this.database.db.insert(notifications).values({
      userId: target.id,
      actorId: userId,
      type: 'collaboration',
      title: '收到联合投稿邀请',
      body: video?.title ?? '',
      link: '/studio/collaborations',
    });
    return this.collaboratorList(videoId);
  }

  async removeCollaborator(userId: string, videoId: string, collaboratorId: string) {
    await this.getOwnedVideo(userId, videoId);
    await this.database.db
      .delete(videoCollaborators)
      .where(
        and(eq(videoCollaborators.videoId, videoId), eq(videoCollaborators.userId, collaboratorId)),
      );
    return { ok: true };
  }

  async respondCollaboration(userId: string, videoId: string, accept: boolean) {
    const rows = await this.database.db
      .select()
      .from(videoCollaborators)
      .where(
        and(
          eq(videoCollaborators.videoId, videoId),
          eq(videoCollaborators.userId, userId),
          eq(videoCollaborators.status, 'pending'),
        ),
      )
      .limit(1);
    const invitation = rows[0];
    if (!invitation) throw new AppError(ERROR_CODES.NOT_FOUND, '邀请不存在', 404);
    await this.database.db
      .update(videoCollaborators)
      .set({
        status: accept ? 'accepted' : 'rejected',
        respondedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(videoCollaborators.videoId, videoId), eq(videoCollaborators.userId, userId)));
    const [video] = await this.database.db
      .select({ uploaderId: videos.uploaderId, title: videos.title })
      .from(videos)
      .where(eq(videos.id, videoId))
      .limit(1);
    if (video) {
      await this.database.db.insert(notifications).values({
        userId: video.uploaderId,
        actorId: userId,
        type: 'collaboration',
        title: accept ? '联合投稿邀请已接受' : '联合投稿邀请被拒绝',
        body: video.title,
        link: `/studio/videos/${videoId}`,
      });
    }
    return { ok: true, status: accept ? 'accepted' : 'rejected' };
  }

  async myCollaborations(userId: string) {
    const pending = await this.database.db
      .select({
        videoId: videoCollaborators.videoId,
        role: videoCollaborators.role,
        createdAt: videoCollaborators.createdAt,
        title: videos.title,
        coverUrl: videos.coverUrl,
        status: videos.status,
        uploaderName: users.displayName,
        uploaderUsername: users.username,
      })
      .from(videoCollaborators)
      .innerJoin(videos, eq(videos.id, videoCollaborators.videoId))
      .innerJoin(users, eq(users.id, videos.uploaderId))
      .where(
        and(
          eq(videoCollaborators.userId, userId),
          eq(videoCollaborators.status, 'pending'),
          isNull(videos.deletedAt),
        ),
      )
      .orderBy(desc(videoCollaborators.createdAt));
    const accepted = await this.database.db
      .select({
        videoId: videoCollaborators.videoId,
        role: videoCollaborators.role,
        respondedAt: videoCollaborators.respondedAt,
        title: videos.title,
        coverUrl: videos.coverUrl,
        status: videos.status,
        views: videos.viewCount,
        uploaderName: users.displayName,
        uploaderUsername: users.username,
      })
      .from(videoCollaborators)
      .innerJoin(videos, eq(videos.id, videoCollaborators.videoId))
      .innerJoin(users, eq(users.id, videos.uploaderId))
      .where(
        and(
          eq(videoCollaborators.userId, userId),
          eq(videoCollaborators.status, 'accepted'),
          isNull(videos.deletedAt),
        ),
      )
      .orderBy(desc(videoCollaborators.respondedAt));
    return {
      pending: pending.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
      accepted: accepted.map((row) => ({
        ...row,
        respondedAt: row.respondedAt?.toISOString() ?? null,
      })),
    };
  }

  private async logStatus(
    videoId: string,
    fromStatus: string,
    toStatus: string,
    actorId: string | null,
    reason: string,
  ) {
    await this.database.db.insert(videoStatusLogs).values({
      videoId,
      fromStatus: fromStatus ?? '',
      toStatus,
      actorId,
      reason: reason ?? '',
    });
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

  async getOwnVideo(userId: string, id: string, allowCollaborator = false): Promise<DbVideo> {
    const rows = await this.database.db
      .select()
      .from(videos)
      .where(
        and(
          eq(videos.id, id),
          isNull(videos.deletedAt),
          allowCollaborator
            ? or(
                eq(videos.uploaderId, userId),
                sql`EXISTS (SELECT 1 FROM "uiliuili"."video_collaborators" vc WHERE vc."video_id" = ${videos.id} AND vc."user_id" = ${userId} AND vc."status" = 'accepted')`,
              )
            : eq(videos.uploaderId, userId),
        ),
      )
      .limit(1);
    const video = rows[0];
    if (!video) throw new AppError(ERROR_CODES.NOT_FOUND, '稿件不存在', 404);
    return video;
  }

  /** Resolves a video the caller owns, excluding collaborative access. */
  private getOwnedVideo(userId: string, id: string): Promise<DbVideo> {
    return this.getOwnVideo(userId, id);
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
      contentType: video.contentType,
      sourceUrl: video.sourceUrl,
      aiGenerated: video.aiGenerated,
      allowComments: video.allowComments,
      allowDanmaku: video.allowDanmaku,
      restricted: video.restricted,
      regionMode: video.regionMode,
      regionCodes: video.regionCodes,
      regionDenyBehavior: video.regionDenyBehavior,
      regionDenyMessage: video.regionDenyMessage,
      publishedAt: video.publishedAt?.toISOString() ?? null,
      createdAt: video.createdAt.toISOString(),
      updatedAt: video.updatedAt.toISOString(),
      playlistUrl: video.playlistKey ? `/api/v1/videos/${video.id}/hls/master.m3u8` : null,
    };
  }
}
