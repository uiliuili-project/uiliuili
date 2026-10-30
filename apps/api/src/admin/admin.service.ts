import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { Injectable, Logger } from '@nestjs/common';
import {
  aiModerationLogs,
  announcements,
  appInstance,
  auditLogs,
  backgroundJobs,
  categories,
  comments,
  danmaku,
  notifications,
  readMigrations,
  reports,
  runMigrations,
  siteSettings,
  tags,
  users,
  videoTags,
  videos,
} from '@uiliuili/db';
import { runtimeRoot } from '@uiliuili/installer';
import { checkFfmpeg } from '@uiliuili/media';
import {
  APP_VERSION,
  AppError,
  DEFAULT_SETTINGS,
  ERROR_CODES,
  type Permission,
  SETTINGS_GROUP_SCHEMAS,
  type UserRole,
  aiConfigSchema,
  announcementCreateSchema,
  captchaConfigSchema,
  categoryCreateSchema,
  categoryUpdateSchema,
  mailConfigSchema,
  normalizeRegionList,
  sanitizeRichHtml,
  searchConfigSchema,
  storageConfigSchema,
  userGroupForRoles,
} from '@uiliuili/shared';
import argon2 from 'argon2';
import { and, count, desc, eq, gte, ilike, inArray, isNull, lte, ne, or, sql } from 'drizzle-orm';
import type { z } from 'zod';
import { AuditService } from '../common/audit.service';
import type { AuthUser } from '../common/auth-user';
import { CacheService } from '../common/cache.service';
import { DatabaseService } from '../common/database.service';
import { QueueService } from '../common/queue.service';
import { SettingsService } from '../common/settings.service';
import { StorageService } from '../common/storage.service';
import { config } from '../config';
import { AiModerationService } from '../moderation/ai-moderation.service';

const execFileAsync = promisify(execFile);
const BACKUP_KEEP = 5;

type StorageConfig = z.infer<typeof storageConfigSchema>;
type SearchConfig = z.infer<typeof searchConfigSchema>;

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly settings: SettingsService,
    private readonly storage: StorageService,
    private readonly queue: QueueService,
    private readonly audit: AuditService,
    private readonly cache: CacheService,
    private readonly moderation: AiModerationService,
  ) {}

  async dashboard() {
    const [
      userCount,
      videoCount,
      danmakuToday,
      reportCount,
      storageUsed,
      queueRows,
      recentUsers,
      recentVideos,
      search,
      cacheMode,
      ffmpeg,
    ] = await Promise.all([
      this.database.db.select({ value: count() }).from(users),
      this.database.db
        .select({ value: count() })
        .from(videos)
        .where(and(isNull(videos.deletedAt), eq(videos.status, 'published'))),
      this.database.db
        .select({ value: count() })
        .from(danmaku)
        .where(gte(danmaku.createdAt, startOfToday())),
      this.database.db.select({ value: count() }).from(reports).where(eq(reports.status, 'open')),
      this.database.db
        .select({ value: sql<number>`COALESCE(SUM(${videos.sourceSize}), 0)` })
        .from(videos),
      this.queue.stats(),
      this.database.db
        .select({
          id: users.id,
          username: users.username,
          displayName: users.displayName,
          createdAt: users.createdAt,
        })
        .from(users)
        .orderBy(desc(users.createdAt))
        .limit(6),
      this.database.db
        .select({
          id: videos.id,
          title: videos.title,
          status: videos.status,
          createdAt: videos.createdAt,
        })
        .from(videos)
        .orderBy(desc(videos.createdAt))
        .limit(6),
      this.settings.getSearchConfig(),
      Promise.resolve(this.cache.mode),
      this.checkFfmpegSafe(),
    ]);
    const queue: Record<string, number> = {};
    for (const row of queueRows) {
      if (row.status === 'active' || row.status === 'created' || row.status === 'retry') {
        queue[row.queue] = (queue[row.queue] ?? 0) + Number(row.count);
      }
    }
    return {
      users: Number(userCount[0]?.value ?? 0),
      videos: Number(videoCount[0]?.value ?? 0),
      danmakuToday: Number(danmakuToday[0]?.value ?? 0),
      pendingReports: Number(reportCount[0]?.value ?? 0),
      storageUsed: Number(storageUsed[0]?.value ?? 0),
      queue,
      recentUsers: recentUsers.map((user) => ({
        ...user,
        createdAt: user.createdAt.toISOString(),
      })),
      recentVideos: recentVideos.map((video) => ({
        ...video,
        createdAt: video.createdAt.toISOString(),
      })),
      system: {
        version: process.env.npm_package_version ?? '0.1.0',
        node: process.version,
        database: 'PostgreSQL',
        ffmpeg,
        search: search.driver,
        cache: cacheMode,
      },
    };
  }

  async listUsers(query: {
    page: number;
    limit: number;
    q?: string;
    role?: UserRole;
    group?: string;
    region?: string;
    banned?: boolean;
  }) {
    const conditions = [];
    if (query.q) {
      const needle = `%${query.q}%`;
      conditions.push(
        or(
          ilike(users.username, needle),
          ilike(users.email, needle),
          ilike(users.displayName, needle),
        ),
      );
    }
    if (query.role) conditions.push(sql`${users.roles} @> ARRAY[${query.role}]::text[]`);
    if (query.group) conditions.push(eq(users.userGroup, query.group));
    if (query.region) conditions.push(eq(users.region, query.region));
    if (query.banned !== undefined) conditions.push(eq(users.banned, query.banned));
    const where = conditions.length ? and(...conditions) : undefined;
    const offset = (query.page - 1) * query.limit;
    const [rows, total] = await Promise.all([
      this.database.db
        .select()
        .from(users)
        .where(where)
        .orderBy(desc(users.createdAt))
        .limit(query.limit)
        .offset(offset),
      this.database.db.select({ value: count() }).from(users).where(where),
    ]);
    return {
      items: rows.map((user) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        roles: user.roles,
        group: user.userGroup,
        level: user.level,
        region: user.region,
        regionSource: user.regionSource,
        showRestricted: user.showRestricted,
        banned: user.banned,
        mutedUntil: user.mutedUntil?.toISOString() ?? null,
        coinBalance: user.coinBalance,
        createdAt: user.createdAt.toISOString(),
      })),
      total: Number(total[0]?.value ?? 0),
      page: query.page,
      limit: query.limit,
    };
  }

  async updateUser(
    actor: AuthUser,
    id: string,
    input: {
      role?: UserRole;
      banned?: boolean;
      mutedUntil?: string | null;
      level?: number;
      region?: string | null;
      showRestricted?: boolean;
    },
  ) {
    const rows = await this.database.db.select().from(users).where(eq(users.id, id)).limit(1);
    const user = rows[0];
    if (!user) throw new AppError(ERROR_CODES.NOT_FOUND, '用户不存在', 404);
    const targetRoles = (user.roles ?? []) as UserRole[];
    const targetIsOwner = user.userGroup === 'OWNER' || targetRoles.includes('SUPER_ADMIN');
    const targetIsAdmin = user.userGroup === 'ADMIN' || targetRoles.includes('ADMIN');
    const actorIsOwner = actor.group === 'OWNER';

    if (targetIsOwner) {
      throw new AppError(ERROR_CODES.FORBIDDEN, '站长账号不能在这里修改，请先转移站长身份', 403);
    }
    if (targetIsAdmin && !actorIsOwner) {
      throw new AppError(ERROR_CODES.FORBIDDEN, '不能修改其他管理员的账号', 403);
    }
    if (id === actor.id && (input.role !== undefined || input.banned !== undefined)) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '不能修改自己的角色或封禁状态', 400);
    }
    if (input.role) {
      this.assertPermission(actor, 'user:assign_role');
      if (input.role === 'SUPER_ADMIN') {
        throw new AppError(ERROR_CODES.BAD_REQUEST, '请使用站长转移功能移交站长身份', 400);
      }
    }
    const nextRegion = input.region === undefined ? user.region : (input.region ?? '');
    const nextShowRestricted = input.showRestricted ?? user.showRestricted;
    if (input.region !== undefined || input.showRestricted !== undefined) {
      const restricted = await this.settings.getRestrictedSettings();
      const blockedRegions = normalizeRegionList(restricted.blockedRegions);
      if (nextShowRestricted && blockedRegions.includes(nextRegion)) {
        throw new AppError(
          ERROR_CODES.BAD_REQUEST,
          '该地区不能开启限制级内容显示，请先调整限制级内容不可发布的地区',
          400,
        );
      }
    }
    const [updated] = await this.database.db
      .update(users)
      .set({
        roles: input.role ? [input.role] : undefined,
        userGroup: input.role ? userGroupForRoles([input.role]) : userGroupForRoles(targetRoles),
        banned: input.banned,
        mutedUntil:
          input.mutedUntil === undefined
            ? undefined
            : input.mutedUntil
              ? new Date(input.mutedUntil)
              : null,
        level: input.level,
        region: input.region === undefined ? undefined : nextRegion,
        regionSource: input.region === undefined ? undefined : nextRegion ? 'admin' : '',
        showRestricted: input.showRestricted,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();
    await this.audit.record({
      actorId: actor.id,
      action: 'admin.user.update',
      targetType: 'user',
      targetId: id,
      before: { roles: user.roles, banned: user.banned, level: user.level },
      after: input,
    });
    return updated
      ? {
          id: updated.id,
          username: updated.username,
          roles: updated.roles,
          group: updated.userGroup,
          banned: updated.banned,
          level: updated.level,
          region: updated.region,
          showRestricted: updated.showRestricted,
        }
      : null;
  }

  async listVideos(query: {
    page: number;
    limit: number;
    q?: string;
    status?: string;
    categoryId?: string;
    region?: string;
    restricted?: boolean;
    featured?: boolean;
  }) {
    const conditions = [isNull(videos.deletedAt)];
    if (query.q) conditions.push(ilike(videos.title, `%${query.q}%`));
    if (query.status) conditions.push(eq(videos.status, query.status));
    if (query.categoryId) conditions.push(eq(videos.categoryId, query.categoryId));
    if (query.restricted !== undefined) conditions.push(eq(videos.restricted, query.restricted));
    if (query.region) {
      const restricted = await this.settings.getRestrictedSettings();
      const blockedRegions = normalizeRegionList(restricted.blockedRegions);
      const regionConditions = [
        and(eq(videos.regionMode, 'block'), sql`${query.region} = ANY(${videos.regionCodes})`)!,
      ];
      if (blockedRegions.includes(query.region)) {
        regionConditions.push(eq(videos.restricted, true));
      }
      conditions.push(or(...regionConditions)!);
    }
    if (query.featured !== undefined) conditions.push(eq(videos.featured, query.featured));
    const offset = (query.page - 1) * query.limit;
    const [rows, total] = await Promise.all([
      this.database.db
        .select({ video: videos, uploader: users, category: categories })
        .from(videos)
        .innerJoin(users, eq(users.id, videos.uploaderId))
        .leftJoin(categories, eq(categories.id, videos.categoryId))
        .where(and(...conditions))
        .orderBy(desc(videos.createdAt))
        .limit(query.limit)
        .offset(offset),
      this.database.db
        .select({ value: count() })
        .from(videos)
        .where(and(...conditions)),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.video.id,
        title: row.video.title,
        status: row.video.status,
        visibility: row.video.visibility,
        featured: row.video.featured,
        recommendWeight: row.video.recommendWeight,
        restricted: row.video.restricted,
        regionMode: row.video.regionMode,
        regionCodes: row.video.regionCodes,
        regionDenyBehavior: row.video.regionDenyBehavior,
        regionDenyMessage: row.video.regionDenyMessage,
        views: row.video.viewCount,
        likes: row.video.likeCount,
        comments: row.video.commentCount,
        danmaku: row.video.danmakuCount,
        createdAt: row.video.createdAt.toISOString(),
        uploader: {
          id: row.uploader.id,
          username: row.uploader.username,
          displayName: row.uploader.displayName,
        },
        category: row.category ? { id: row.category.id, name: row.category.name } : null,
      })),
      total: Number(total[0]?.value ?? 0),
      page: query.page,
      limit: query.limit,
    };
  }

  async updateVideo(
    actor: AuthUser,
    id: string,
    input: {
      status?: string;
      featured?: boolean;
      recommendWeight?: number;
      blockReason?: string;
      restricted?: boolean;
      regionMode?: 'inherit' | 'block';
      regionCodes?: string[];
      regionDenyBehavior?: 'default' | 'message' | 'not_found';
      regionDenyMessage?: string;
    },
  ) {
    const touchesRegion =
      input.restricted !== undefined ||
      input.regionMode !== undefined ||
      input.regionCodes !== undefined ||
      input.regionDenyBehavior !== undefined ||
      input.regionDenyMessage !== undefined;
    if (input.featured !== undefined || input.recommendWeight !== undefined) {
      this.assertPermission(actor, 'video:feature');
    }
    if (input.status !== undefined || input.blockReason !== undefined || touchesRegion) {
      this.assertPermission(actor, 'video:manage_any');
    }
    const rows = await this.database.db.select().from(videos).where(eq(videos.id, id)).limit(1);
    const video = rows[0];
    if (!video) throw new AppError(ERROR_CODES.NOT_FOUND, '视频不存在', 404);
    const restricted = input.restricted ?? video.restricted;
    const restrictedSettings = await this.settings.getRestrictedSettings();
    const blockedRegions = normalizeRegionList(restrictedSettings.blockedRegions);
    // Clearing the restricted flag removes the inherited site list unless the
    // administrator explicitly chooses a new per-video block policy.
    const regionMode =
      input.regionMode ?? (input.restricted === false ? 'inherit' : video.regionMode);
    const regionCodes =
      input.regionCodes === undefined ? video.regionCodes : normalizeRegionList(input.regionCodes);
    const [updated] = await this.database.db
      .update(videos)
      .set({
        status: input.status,
        featured: input.featured,
        recommendWeight: input.recommendWeight,
        blockReason: input.blockReason,
        restricted: input.restricted,
        regionMode: restricted ? 'block' : regionMode,
        regionCodes: restricted ? blockedRegions : regionMode === 'block' ? regionCodes : [],
        regionDenyBehavior: input.regionDenyBehavior,
        regionDenyMessage: input.regionDenyMessage,
        publishedAt: input.status === 'published' && !video.publishedAt ? new Date() : undefined,
        deletedAt: input.status === 'deleted' ? new Date() : input.status ? null : undefined,
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
      action: 'admin.video.update',
      targetType: 'video',
      targetId: id,
      before: { status: video.status, featured: video.featured },
      after: input,
    });
    return updated;
  }

  async listDanmaku(query: {
    page: number;
    limit: number;
    q?: string;
    status?: string;
    videoId?: string;
  }) {
    const conditions = [];
    if (query.q) conditions.push(ilike(danmaku.content, `%${query.q}%`));
    if (query.status) conditions.push(eq(danmaku.status, query.status));
    if (query.videoId) conditions.push(eq(danmaku.videoId, query.videoId));
    const where = conditions.length ? and(...conditions) : undefined;
    const offset = (query.page - 1) * query.limit;
    const [rows, total] = await Promise.all([
      this.database.db
        .select({
          id: danmaku.id,
          content: danmaku.content,
          videoId: danmaku.videoId,
          progressMs: danmaku.progressMs,
          status: danmaku.status,
          createdAt: danmaku.createdAt,
          username: users.username,
          videoTitle: videos.title,
        })
        .from(danmaku)
        .innerJoin(users, eq(users.id, danmaku.userId))
        .innerJoin(videos, eq(videos.id, danmaku.videoId))
        .where(where)
        .orderBy(desc(danmaku.createdAt))
        .limit(query.limit)
        .offset(offset),
      this.database.db.select({ value: count() }).from(danmaku).where(where),
    ]);
    return {
      items: rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })),
      total: Number(total[0]?.value ?? 0),
      page: query.page,
      limit: query.limit,
    };
  }

  async moderateDanmaku(actorId: string, id: string, action: string) {
    const statusMap: Record<string, string> = {
      hide: 'hidden',
      restore: 'visible',
      delete: 'deleted',
    };
    const status = statusMap[action];
    if (!status) throw new AppError(ERROR_CODES.BAD_REQUEST, '不支持的操作', 400);
    await this.database.db.update(danmaku).set({ status }).where(eq(danmaku.id, id));
    await this.audit.record({
      actorId,
      action: `admin.danmaku.${action}`,
      targetType: 'danmaku',
      targetId: id,
      after: { status },
    });
    return { ok: true, status };
  }

  async listComments(query: {
    page: number;
    limit: number;
    q?: string;
    status?: string;
    videoId?: string;
  }) {
    const conditions = [];
    if (query.q) conditions.push(ilike(comments.content, `%${query.q}%`));
    if (query.status) conditions.push(eq(comments.status, query.status));
    if (query.videoId) conditions.push(eq(comments.videoId, query.videoId));
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

  async moderateComment(actorId: string, id: string, action: string) {
    const statusMap: Record<string, string> = {
      hide: 'hidden',
      restore: 'visible',
      delete: 'deleted',
    };
    const status = statusMap[action];
    if (!status) throw new AppError(ERROR_CODES.BAD_REQUEST, '不支持的操作', 400);
    const rows = await this.database.db.select().from(comments).where(eq(comments.id, id)).limit(1);
    const existing = rows[0];
    if (!existing) throw new AppError(ERROR_CODES.NOT_FOUND, '评论不存在', 404);
    await this.database.db
      .update(comments)
      .set({ status, updatedAt: new Date(), deletedAt: status === 'deleted' ? new Date() : null })
      .where(eq(comments.id, id));
    if (existing.status !== 'visible' && status === 'visible') {
      await this.database.db
        .update(videos)
        .set({ commentCount: sql`${videos.commentCount} + 1` })
        .where(eq(videos.id, existing.videoId));
    } else if (existing.status === 'visible' && status !== 'visible') {
      await this.database.db
        .update(videos)
        .set({ commentCount: sql`GREATEST(0, ${videos.commentCount} - 1)` })
        .where(eq(videos.id, existing.videoId));
    }
    await this.audit.record({
      actorId,
      action: `admin.comment.${action}`,
      targetType: 'comment',
      targetId: id,
      after: { status },
    });
    return { ok: true, status };
  }

  async listModerationLogs(query: {
    page: number;
    limit: number;
    decision?: string;
    targetType?: string;
  }) {
    const conditions = [];
    if (query.decision) conditions.push(eq(aiModerationLogs.decision, query.decision));
    if (query.targetType) conditions.push(eq(aiModerationLogs.targetType, query.targetType));
    const where = conditions.length ? and(...conditions) : undefined;
    const offset = (query.page - 1) * query.limit;
    const [rows, total] = await Promise.all([
      this.database.db
        .select({
          id: aiModerationLogs.id,
          targetType: aiModerationLogs.targetType,
          targetId: aiModerationLogs.targetId,
          excerpt: aiModerationLogs.excerpt,
          allowed: aiModerationLogs.allowed,
          decision: aiModerationLogs.decision,
          reason: aiModerationLogs.reason,
          categories: aiModerationLogs.categories,
          model: aiModerationLogs.model,
          latencyMs: aiModerationLogs.latencyMs,
          cached: aiModerationLogs.cached,
          error: aiModerationLogs.error,
          createdAt: aiModerationLogs.createdAt,
          username: users.username,
        })
        .from(aiModerationLogs)
        .leftJoin(users, eq(users.id, aiModerationLogs.userId))
        .where(where)
        .orderBy(desc(aiModerationLogs.createdAt))
        .limit(query.limit)
        .offset(offset),
      this.database.db.select({ value: count() }).from(aiModerationLogs).where(where),
    ]);
    return {
      items: rows.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
      })),
      total: Number(total[0]?.value ?? 0),
      page: query.page,
      limit: query.limit,
    };
  }

  async testModeration(content: string) {
    return this.moderation.test(content);
  }

  async listReports(query: {
    page: number;
    limit: number;
    status?: string;
    targetType?: string;
  }) {
    const conditions = [];
    if (query.status) conditions.push(eq(reports.status, query.status));
    if (query.targetType) conditions.push(eq(reports.targetType, query.targetType));
    const where = conditions.length ? and(...conditions) : undefined;
    const offset = (query.page - 1) * query.limit;
    const [rows, total] = await Promise.all([
      this.database.db
        .select({ report: reports, reporter: users })
        .from(reports)
        .leftJoin(users, eq(users.id, reports.reporterId))
        .where(where)
        .orderBy(desc(reports.createdAt))
        .limit(query.limit)
        .offset(offset),
      this.database.db.select({ value: count() }).from(reports).where(where),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.report.id,
        targetType: row.report.targetType,
        targetId: row.report.targetId,
        reason: row.report.reason,
        detail: row.report.detail,
        status: row.report.status,
        createdAt: row.report.createdAt.toISOString(),
        reporter: row.reporter?.username ?? null,
      })),
      total: Number(total[0]?.value ?? 0),
      page: query.page,
      limit: query.limit,
    };
  }

  async handleReport(
    actorId: string,
    id: string,
    input: { action: string; reason?: string; durationHours?: number },
  ) {
    const rows = await this.database.db.select().from(reports).where(eq(reports.id, id)).limit(1);
    const report = rows[0];
    if (!report) throw new AppError(ERROR_CODES.NOT_FOUND, '举报不存在', 404);
    if (input.action === 'delete' || input.action === 'hide') {
      await this.applyContentAction(report.targetType, report.targetId, input.action);
    }
    if (input.action === 'ban') {
      if (report.targetType !== 'user') {
        const ownerId =
          report.targetType === 'video'
            ? (
                await this.database.db
                  .select({ uploaderId: videos.uploaderId })
                  .from(videos)
                  .where(eq(videos.id, report.targetId))
                  .limit(1)
              )[0]?.uploaderId
            : undefined;
        if (ownerId) {
          await this.database.db
            .update(users)
            .set({ banned: true, updatedAt: new Date() })
            .where(eq(users.id, ownerId));
        }
      } else {
        await this.database.db
          .update(users)
          .set({ banned: true, updatedAt: new Date() })
          .where(eq(users.id, report.targetId));
      }
    }
    if (input.action === 'mute') {
      const until = new Date(Date.now() + (input.durationHours ?? 24) * 60 * 60 * 1000);
      await this.database.db
        .update(users)
        .set({ mutedUntil: until, updatedAt: new Date() })
        .where(eq(users.id, report.targetId));
    }
    const status = input.action === 'restore' ? 'rejected' : 'resolved';
    await this.database.db
      .update(reports)
      .set({ status, handledBy: actorId, handledAt: new Date() })
      .where(eq(reports.id, id));
    await this.audit.record({
      actorId,
      action: 'admin.report.handle',
      targetType: 'report',
      targetId: id,
      after: { ...input, status },
    });
    return { ok: true, status };
  }

  async listCategories() {
    return this.database.db.select().from(categories).orderBy(categories.sort);
  }

  async createCategory(actorId: string, input: z.infer<typeof categoryCreateSchema>) {
    const [created] = await this.database.db.insert(categories).values(input).returning();
    await this.audit.record({
      actorId,
      action: 'admin.category.create',
      targetType: 'category',
      targetId: created?.id ?? '',
      after: input,
    });
    return created;
  }

  async updateCategory(actorId: string, id: string, input: z.infer<typeof categoryUpdateSchema>) {
    const [updated] = await this.database.db
      .update(categories)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(categories.id, id))
      .returning();
    await this.audit.record({
      actorId,
      action: 'admin.category.update',
      targetType: 'category',
      targetId: id,
      after: input,
    });
    return updated;
  }

  async deleteCategory(actorId: string, id: string) {
    const [used] = await this.database.db
      .select({ value: count() })
      .from(videos)
      .where(eq(videos.categoryId, id));
    if (Number(used?.value ?? 0) > 0) {
      throw new AppError(ERROR_CODES.CONFLICT, '该分区下仍有视频，请先把视频迁移到其他分区', 409);
    }
    await this.database.db.delete(categories).where(eq(categories.id, id));
    await this.audit.record({
      actorId,
      action: 'admin.category.delete',
      targetType: 'category',
      targetId: id,
    });
    return { ok: true };
  }

  async listTags() {
    return this.database.db
      .select({
        id: tags.id,
        name: tags.name,
        slug: tags.slug,
        count: count(videoTags.videoId),
      })
      .from(tags)
      .leftJoin(videoTags, eq(videoTags.tagId, tags.id))
      .groupBy(tags.id)
      .orderBy(desc(count(videoTags.videoId)))
      .limit(200);
  }

  async transferOwner(
    actor: AuthUser,
    targetUserId: string,
    password?: string,
  ): Promise<{ ok: true }> {
    if (targetUserId === actor.id) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '目标用户已经是站长', 400);
    }
    if (password) {
      const actorRows = await this.database.db
        .select()
        .from(users)
        .where(eq(users.id, actor.id))
        .limit(1);
      const actorRecord = actorRows[0];
      if (actorRecord?.passwordHash) {
        const valid = await argon2.verify(actorRecord.passwordHash, password).catch(() => false);
        if (!valid) throw new AppError(ERROR_CODES.BAD_REQUEST, '密码不正确', 400);
      }
    }
    const targetRows = await this.database.db
      .select()
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);
    const target = targetRows[0];
    if (!target) throw new AppError(ERROR_CODES.NOT_FOUND, '用户不存在', 404);
    if (target.banned)
      throw new AppError(ERROR_CODES.BAD_REQUEST, '不能把站长身份转移给已封禁用户', 400);

    await this.database.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('uiliuili:owner'))`);
      const owners = await tx
        .select({ id: users.id })
        .from(users)
        .where(sql`${users.userGroup} = 'OWNER' OR ${users.roles} @> ARRAY['SUPER_ADMIN']::text[]`);
      if (!owners.some((owner) => owner.id === actor.id)) {
        throw new AppError(ERROR_CODES.FORBIDDEN, '只有站长可以转移站长身份', 403);
      }
      await tx
        .update(users)
        .set({ roles: ['ADMIN'], userGroup: 'ADMIN', updatedAt: new Date() })
        .where(
          sql`${users.id} <> ${target.id} AND (${users.userGroup} = 'OWNER' OR ${users.roles} @> ARRAY['SUPER_ADMIN']::text[])`,
        );
      await tx
        .update(users)
        .set({
          roles: ['SUPER_ADMIN'],
          userGroup: 'OWNER',
          banned: false,
          level: 6,
          updatedAt: new Date(),
        })
        .where(eq(users.id, target.id));
      await tx.insert(notifications).values([
        {
          userId: actor.id,
          type: 'system',
          title: '站长身份已转移',
          body: `你已将站长身份转移给 ${target.displayName || target.username}。`,
          link: '/',
        },
        {
          userId: target.id,
          type: 'system',
          title: '你已成为站长',
          body: '你已接管本站的站长账号，拥有全部管理权限。',
          link: '/admin/',
        },
      ]);
    });

    await this.audit.record({
      actorId: actor.id,
      action: 'admin.owner.transfer',
      targetType: 'user',
      targetId: target.id,
      before: { owner: actor.id },
      after: { owner: target.id },
    });
    return { ok: true };
  }

  private hasPermission(actor: AuthUser, permission: Permission): boolean {
    return actor.permissions.includes(permission);
  }

  private assertPermission(actor: AuthUser, permission: Permission): void {
    if (!this.hasPermission(actor, permission)) {
      throw new AppError(ERROR_CODES.FORBIDDEN, '没有权限执行此操作', 403);
    }
  }

  private assertSettingPermission(actor: AuthUser, key: string, value: unknown): void {
    if (key === 'site') {
      const fields = value && typeof value === 'object' ? Object.keys(value) : [];
      const securityFields: string[] = fields.filter(
        (field) => field === 'registration' || field === 'maintenance',
      );
      const otherFields = fields.filter((field) => !securityFields.includes(field));
      if (otherFields.length > 0) this.assertPermission(actor, 'settings:site');
      if (securityFields.length > 0) this.assertPermission(actor, 'settings:security');
      return;
    }
    if (['branding', 'navigation', 'customCode', 'analytics', 'legal'].includes(key)) {
      this.assertPermission(actor, 'settings:site');
      return;
    }
    if (
      [
        'upload',
        'playback',
        'danmaku',
        'social',
        'recommendation',
        'region',
        'restricted',
        'privacy',
        'rateLimit',
        'review',
      ].includes(key)
    ) {
      this.assertPermission(actor, 'settings:content');
      return;
    }
    if (
      [
        'storage_config',
        'search_config',
        'redis_config',
        'mail_config',
        'mail',
        'aiModeration',
        'ai_config',
      ].includes(key)
    ) {
      this.assertPermission(actor, 'settings:integration');
      return;
    }
    if (['security', 'captcha', 'captcha_config'].includes(key)) {
      this.assertPermission(actor, 'settings:security');
    }
  }

  async getSettings(actor: AuthUser) {
    const groupKeys: string[] = [];
    if (
      this.hasPermission(actor, 'settings:site') ||
      this.hasPermission(actor, 'settings:security')
    ) {
      groupKeys.push('site');
    }
    if (this.hasPermission(actor, 'settings:site')) {
      groupKeys.push('branding', 'navigation', 'customCode', 'analytics', 'legal');
    }
    if (this.hasPermission(actor, 'settings:content')) {
      groupKeys.push(
        'upload',
        'playback',
        'danmaku',
        'social',
        'recommendation',
        'region',
        'restricted',
        'privacy',
        'rateLimit',
        'review',
      );
    }
    if (this.hasPermission(actor, 'settings:integration')) groupKeys.push('mail', 'aiModeration');
    if (this.hasPermission(actor, 'settings:security')) groupKeys.push('security', 'captcha');

    const groups = await Promise.all(
      groupKeys.map(async (key) => {
        const defaults = (DEFAULT_SETTINGS as Record<string, Record<string, unknown>>)[key] ?? {};
        return [key, await this.settings.getGroup(key, defaults)] as const;
      }),
    );

    if (!this.hasPermission(actor, 'settings:integration')) {
      return {
        groups: Object.fromEntries(groups),
        storage: null,
        mail: null,
        search: null,
        redis: null,
        oauth: [],
        aiConfig: null,
        captchaConfig: this.hasPermission(actor, 'settings:security')
          ? { secretKey: '********' }
          : null,
      };
    }

    const [storage, mail, search, redis, aiConfig, captchaConfig] = await Promise.all([
      this.settings.getStorageConfig(),
      this.settings.getSecret<Record<string, unknown> | null>('mail_config', null),
      this.settings.getSearchConfig(),
      this.settings.getRedisConfig(),
      this.settings.getAiConfig(),
      this.settings.getCaptchaConfig(),
    ]);
    const providers = [];
    for (const provider of ['github', 'google', 'oidc']) {
      const config = await this.settings.getOAuthProvider(provider);
      providers.push({
        provider,
        enabled: config?.enabled ?? false,
        config: {
          clientId: config?.clientId ?? '',
          clientSecret: config?.clientSecret ? '********' : '',
          issuer: config?.issuer ?? '',
          scopes: config?.scopes ?? [],
        },
      });
    }
    return {
      groups: Object.fromEntries(groups),
      storage: {
        ...storage,
        s3: storage.driver === 's3' ? { ...storage.s3, secretAccessKey: '********' } : undefined,
      },
      mail: mail ? { ...mail, password: mail.password ? '********' : '' } : null,
      search:
        search.driver === 'meilisearch' ? { ...search, key: search.key ? '********' : '' } : search,
      redis: redis ? { url: maskRedisUrl(redis.url) } : null,
      oauth: providers,
      aiConfig: {
        baseUrl: aiConfig.baseUrl,
        model: aiConfig.model,
        apiKey: aiConfig.apiKey ? '********' : '',
      },
      captchaConfig: { secretKey: captchaConfig.secretKey ? '********' : '' },
    };
  }

  async uploadLogo(actorId: string, buffer: Buffer, contentType: string) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, 'Logo 只支持 JPEG、PNG 或 WebP', 400);
    }
    if (buffer.length === 0) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, 'Logo 文件为空', 400);
    }
    if (buffer.length > 2 * 1024 * 1024) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, 'Logo 不能超过 2 MB', 400);
    }
    const extension =
      contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
    const key = `branding/logo-${crypto.randomUUID()}.${extension}`;
    const provider = await this.storage.provider();
    await provider.putObject(key, buffer, contentType);
    const logoUrl = `/media/${key
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/')}`;
    const site = await this.settings.getSite();
    await this.settings.set('site', { ...site, logoUrl }, false);
    await this.settings.invalidate();
    await this.cache.del('settings:public');
    await this.audit.record({
      actorId,
      action: 'admin.settings.logo',
      targetType: 'setting',
      targetId: 'site',
      after: { logoUrl },
    });
    return { logoUrl };
  }

  async updateSettings(actor: AuthUser, patches: Record<string, unknown>) {
    for (const [key, value] of Object.entries(patches)) {
      this.assertSettingPermission(actor, key, value);
      if (key === 'storage_config') {
        const parsed = storageConfigSchema.parse(
          mergeMasked(value, await this.settings.getStorageConfig()),
        );
        await this.settings.set(key, parsed, true);
        await this.settings.set('storage', { driver: parsed.driver }, false);
      } else if (key === 'mail_config') {
        const existing = await this.settings.getSecret<Record<string, unknown> | null>(
          'mail_config',
          null,
        );
        const parsed = mailConfigSchema.parse(mergeMasked(value, existing ?? {}));
        await this.settings.set(key, parsed, true);
        await this.settings.set(
          'mail',
          {
            enabled: parsed.enabled,
            verificationRequired: parsed.verificationRequired,
          },
          false,
        );
      } else if (key === 'search_config') {
        const existing = await this.settings.getSearchConfig();
        const parsed = searchConfigSchema.parse(mergeMasked(value, existing));
        await this.settings.set(key, parsed, true);
        await this.settings.set('search', { driver: parsed.driver }, false);
      } else if (key === 'redis_config') {
        const existing = await this.settings.getRedisConfig();
        const merged = mergeMasked(value, existing ?? {});
        const hasRedis = Boolean(merged && (merged as { url?: string }).url);
        await this.settings.set(key, hasRedis ? merged : null, true);
        await this.settings.set('cache', { driver: hasRedis ? 'redis' : 'memory' }, false);
      } else if (key === 'captcha_config') {
        const existing = await this.settings.getCaptchaConfig();
        const parsed = captchaConfigSchema.parse(mergeMasked(value, existing));
        await this.settings.set(key, parsed, true);
      } else if (key === 'ai_config') {
        const existing = await this.settings.getAiConfig();
        const parsed = aiConfigSchema.parse(mergeMasked(value, existing));
        await this.settings.set(key, parsed, true);
      } else if (key in SETTINGS_GROUP_SCHEMAS) {
        const schema = SETTINGS_GROUP_SCHEMAS[key as keyof typeof SETTINGS_GROUP_SCHEMAS];
        const existing = await this.settings.getGroup<Record<string, unknown>>(key, {});
        const merged = mergeMasked(value, existing);
        const parsed = schema.parse(merged) as Record<string, unknown>;
        if (key === 'legal') {
          parsed.termsHtml = sanitizeRichHtml(String(parsed.termsHtml ?? ''));
          parsed.privacyHtml = sanitizeRichHtml(String(parsed.privacyHtml ?? ''));
          const previousTerms = String(existing.termsHtml ?? '');
          const previousPrivacy = String(existing.privacyHtml ?? '');
          if (previousTerms !== parsed.termsHtml || previousPrivacy !== parsed.privacyHtml) {
            const current = Number.parseInt(String(parsed.termsVersion ?? '1'), 10);
            parsed.termsVersion = String(Number.isFinite(current) ? current + 1 : 2);
          }
        }
        await this.settings.set(key, parsed, false);
      } else if (
        [
          'site',
          'upload',
          'playback',
          'danmaku',
          'social',
          'recommendation',
          'mail',
          'security',
          'region',
          'restricted',
          'privacy',
        ].includes(key)
      ) {
        await this.settings.set(key, value, false);
        if (key === 'restricted') {
          const merged = await this.settings.getRestrictedSettings();
          const blockedRegions = normalizeRegionList(merged.blockedRegions);
          // The site list is authoritative for restricted content; refresh the
          // materialised per-video policy so stale lists stop granting access.
          await this.database.db
            .update(videos)
            .set({ regionMode: 'block', regionCodes: blockedRegions, updatedAt: new Date() })
            .where(eq(videos.restricted, true));
        }
      } else {
        continue;
      }
      await this.audit.record({
        actorId: actor.id,
        action: 'admin.settings.update',
        targetType: 'setting',
        targetId: key,
        after: key.includes('config') ? '[redacted]' : value,
      });
    }
    await this.settings.invalidate();
    await this.cache.del('settings:public');
    return { ok: true };
  }

  async updateOAuth(
    actorId: string,
    provider: string,
    input: {
      enabled: boolean;
      clientId: string;
      clientSecret: string;
      issuer?: string;
      scopes?: string[];
    },
  ) {
    if (!['github', 'google', 'oidc'].includes(provider)) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '不支持的登录方式', 400);
    }
    const existing = await this.settings.getOAuthProvider(provider);
    const clientSecret =
      input.clientSecret === '********' ? (existing?.clientSecret ?? '') : input.clientSecret;
    const { authProviders } = await import('@uiliuili/db');
    const { encryptSecret } = await import('@uiliuili/db');
    const { config } = await import('../config');
    await this.database.db
      .insert(authProviders)
      .values({
        provider,
        enabled: input.enabled,
        configEncrypted: encryptSecret(
          {
            clientId: input.clientId,
            clientSecret,
            issuer: input.issuer ?? '',
            scopes: input.scopes ?? [],
          },
          config.appKey,
        ),
      })
      .onConflictDoUpdate({
        target: authProviders.provider,
        set: {
          enabled: input.enabled,
          configEncrypted: encryptSecret(
            {
              clientId: input.clientId,
              clientSecret,
              issuer: input.issuer ?? '',
              scopes: input.scopes ?? [],
            },
            config.appKey,
          ),
          updatedAt: new Date(),
        },
      });
    await this.audit.record({
      actorId,
      action: 'admin.oauth.update',
      targetType: 'oauth',
      targetId: provider,
      after: { enabled: input.enabled, clientId: input.clientId },
    });
    return { ok: true };
  }

  async system() {
    const [dbVersion, tableCount, queueRows, search, ffmpeg, instance] = await Promise.all([
      this.database.db.execute<{ version: string }>(sql`SELECT version() AS version`),
      this.database.db.execute<{ count: number }>(
        sql`SELECT COUNT(*)::int AS count FROM information_schema.tables WHERE table_schema = 'uiliuili'`,
      ),
      this.queue.stats(),
      this.settings.getSearchConfig(),
      this.checkFfmpegSafe(),
      this.database.db.select().from(appInstance).limit(1),
    ]);
    const queue: Record<string, number> = {};
    for (const row of queueRows) {
      queue[row.status] = (queue[row.status] ?? 0) + Number(row.count);
    }
    return {
      version: instance[0]?.version ?? '0.1.0',
      node: process.version,
      database: String(dbVersion[0]?.version ?? 'PostgreSQL').split(',')[0],
      migrations: Number(tableCount[0]?.count ?? 0),
      ffmpeg,
      storage: (await this.settings.getStorageConfig()).driver,
      mail: Boolean(await this.settings.getMailConfig()),
      search: search.driver,
      cache: this.cache.mode,
      queue,
      uptimeSeconds: Math.round(process.uptime()),
      platform: `${process.platform} ${process.arch}`,
      memoryUsed: process.memoryUsage().rss,
      hostname: os.hostname(),
    };
  }

  async checkUpdate() {
    const repo = process.env.GITHUB_REPO ?? 'uiliuili-project/uiliuili';
    try {
      const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, {
        headers: { 'User-Agent': 'uiliuili', Accept: 'application/vnd.github+json' },
      });
      if (!response.ok) return { available: false, current: APP_VERSION, latest: null };
      const data = (await response.json()) as { tag_name?: string; html_url?: string };
      const latest = (data.tag_name ?? '').replace(/^v/, '');
      return {
        available: Boolean(latest && latest !== APP_VERSION),
        current: APP_VERSION,
        latest,
        url: data.html_url,
      };
    } catch {
      return { available: false, current: APP_VERSION, latest: null };
    }
  }

  /** Reports applied and pending migrations plus the last database backups. */
  async upgradeStatus() {
    const [instance, appliedRows] = await Promise.all([
      this.database.db.select().from(appInstance).limit(1),
      this.database.db.execute<{ name: string }>(
        sql`SELECT name FROM "uiliuili"."schema_migrations" ORDER BY name`,
      ),
    ]);
    const applied = new Set(appliedRows.map((row) => row.name));
    const all = readMigrations();
    const pending = all.filter((migration) => !applied.has(migration.name)).map((m) => m.name);
    const site = await this.settings.getSite();
    return {
      currentVersion: instance[0]?.version ?? '0.1.0',
      appVersion: APP_VERSION,
      maintenance: Boolean(site.maintenance),
      pending,
      appliedCount: applied.size,
      totalCount: all.length,
      backups: await this.listBackups(),
      restartConfigured: Boolean(process.env.UPGRADE_RESTART_CMD?.trim()),
    };
  }

  private backupDirectory(): string {
    return path.join(runtimeRoot(), 'storage', 'backups');
  }

  private async listBackups(): Promise<Array<{ name: string; bytes: number; createdAt: string }>> {
    const directory = this.backupDirectory();
    try {
      const entries = await fs.promises.readdir(directory);
      const backups = await Promise.all(
        entries
          .filter((name) => name.endsWith('.dump'))
          .map(async (name) => {
            const stat = await fs.promises.stat(path.join(directory, name));
            return {
              name,
              bytes: stat.size,
              createdAt: stat.mtime.toISOString(),
            };
          }),
      );
      return backups.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
    } catch {
      return [];
    }
  }

  async createBackup(actorId: string) {
    if (!config.databaseUrl) {
      throw new AppError(ERROR_CODES.INTERNAL_ERROR, '未配置数据库连接，无法备份', 500);
    }
    const directory = this.backupDirectory();
    await fs.promises.mkdir(directory, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dumpName = `db-${stamp}.dump`;
    const dumpPath = path.join(directory, dumpName);
    try {
      await execFileAsync(
        'pg_dump',
        ['--no-owner', '--format=custom', '--file', dumpPath, config.databaseUrl],
        { maxBuffer: 8 * 1024 * 1024 },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`pg_dump failed: ${message}`);
      throw new AppError(
        ERROR_CODES.INTERNAL_ERROR,
        '数据库备份失败：服务器缺少 pg_dump 或数据库不可访问。Docker 镜像需安装 postgresql-client。',
        500,
        { message: message.slice(0, 500) },
      );
    }
    const stateDirectory = runtimeRoot();
    for (const [source, name] of [
      [path.join(stateDirectory, '.env'), `env-${stamp}.txt`],
      [path.join(stateDirectory, 'config', 'instance.json'), `instance-${stamp}.json`],
    ] as const) {
      try {
        await fs.promises.copyFile(source, path.join(directory, name));
      } catch {
        // The backup still contains the database when optional state files are absent.
      }
    }
    await this.pruneBackups();
    await this.audit.record({
      actorId,
      action: 'admin.system.backup',
      targetType: 'system',
      targetId: dumpName,
      after: { dumpName },
    });
    return { ok: true, name: dumpName, backups: await this.listBackups() };
  }

  private async pruneBackups(): Promise<void> {
    const directory = this.backupDirectory();
    let dumps: string[] = [];
    try {
      const entries = await fs.promises.readdir(directory);
      dumps = entries
        .filter((name) => name.endsWith('.dump'))
        .sort()
        .reverse();
    } catch {
      return;
    }
    const stale = dumps.slice(BACKUP_KEEP);
    for (const name of stale) {
      const stamp = name.replace(/^db-/, '').replace(/\.dump$/, '');
      await Promise.all(
        [`db-${stamp}.dump`, `env-${stamp}.txt`, `instance-${stamp}.json`].map((file) =>
          fs.promises.rm(path.join(directory, file), { force: true }).catch(() => undefined),
        ),
      );
    }
  }

  async applyUpgrade(actorId: string, confirm: string, backup = true) {
    if (confirm.trim() !== APP_VERSION) {
      throw new AppError(
        ERROR_CODES.BAD_REQUEST,
        `请准确输入当前版本号 ${APP_VERSION} 以确认升级`,
        400,
      );
    }
    if (!config.databaseUrl) {
      throw new AppError(ERROR_CODES.INTERNAL_ERROR, '未配置数据库连接，无法执行迁移', 500);
    }
    if (backup) await this.createBackup(actorId);
    const site = (await this.settings.getSite()) as Record<string, unknown>;
    await this.settings.set('site', { ...site, maintenance: true }, false);
    let applied: string[] = [];
    try {
      applied = await runMigrations(config.databaseUrl);
      await this.database.db
        .update(appInstance)
        .set({ version: APP_VERSION, updatedAt: new Date() })
        .where(ne(appInstance.id, '00000000-0000-0000-0000-000000000000'));
    } catch (error) {
      await this.settings.set('site', { ...site, maintenance: false }, false);
      throw new AppError(
        ERROR_CODES.UPGRADE_REQUIRED,
        error instanceof Error ? `数据库迁移失败：${error.message}` : '数据库迁移失败',
        500,
      );
    }
    await this.settings.set('site', { ...site, maintenance: false }, false);
    const restartCommand = process.env.UPGRADE_RESTART_CMD?.trim() ?? '';
    let restartTriggered = false;
    if (restartCommand) {
      try {
        await execFileAsync('sh', ['-c', restartCommand], { timeout: 30_000 });
        restartTriggered = true;
      } catch (error) {
        this.logger.warn(`UPGRADE_RESTART_CMD failed: ${String(error)}`);
      }
    }
    await this.audit.record({
      actorId,
      action: 'admin.system.upgrade',
      targetType: 'system',
      targetId: APP_VERSION,
      after: { applied, restartTriggered },
    });
    return {
      ok: true,
      applied,
      version: APP_VERSION,
      restartRequired: true,
      restartTriggered,
    };
  }

  async setMaintenance(actorId: string, enabled: boolean) {
    const site = (await this.settings.getSite()) as Record<string, unknown>;
    await this.settings.set('site', { ...site, maintenance: enabled }, false);
    await this.audit.record({
      actorId,
      action: 'admin.system.maintenance',
      targetType: 'system',
      targetId: enabled ? 'on' : 'off',
      after: { enabled },
    });
    return { ok: true, maintenance: enabled };
  }

  async listJobs(query: { page: number; limit: number; status?: string; queue?: string }) {
    const conditions = [];
    if (query.status) conditions.push(eq(backgroundJobs.status, query.status));
    if (query.queue) conditions.push(eq(backgroundJobs.queue, query.queue));
    const where = conditions.length ? and(...conditions) : undefined;
    const offset = (query.page - 1) * query.limit;
    const [rows, total] = await Promise.all([
      this.database.db
        .select()
        .from(backgroundJobs)
        .where(where)
        .orderBy(desc(backgroundJobs.createdAt))
        .limit(query.limit)
        .offset(offset),
      this.database.db.select({ value: count() }).from(backgroundJobs).where(where),
    ]);
    return {
      items: rows.map((job) => ({
        id: job.id,
        queue: job.queue,
        status: job.status,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        progress: job.progress,
        lastError: job.lastError,
        createdAt: job.createdAt.toISOString(),
        runAt: job.runAt.toISOString(),
      })),
      total: Number(total[0]?.value ?? 0),
      page: query.page,
      limit: query.limit,
    };
  }

  async retryJob(id: string) {
    await this.queue.retry(id);
    return { ok: true };
  }

  async cancelJob(id: string) {
    await this.queue.cancel(id);
    return { ok: true };
  }

  async listAudit(query: { page: number; limit: number; q?: string }) {
    const where = query.q ? ilike(auditLogs.action, `%${query.q}%`) : undefined;
    const offset = (query.page - 1) * query.limit;
    const [rows, total] = await Promise.all([
      this.database.db
        .select({ log: auditLogs, actor: users })
        .from(auditLogs)
        .leftJoin(users, eq(users.id, auditLogs.actorId))
        .where(where)
        .orderBy(desc(auditLogs.createdAt))
        .limit(query.limit)
        .offset(offset),
      this.database.db.select({ value: count() }).from(auditLogs).where(where),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.log.id,
        action: row.log.action,
        targetType: row.log.targetType,
        targetId: row.log.targetId,
        ipHash: row.log.ipHash,
        createdAt: row.log.createdAt.toISOString(),
        actor: row.actor?.username ?? null,
      })),
      total: Number(total[0]?.value ?? 0),
      page: query.page,
      limit: query.limit,
    };
  }

  async listAnnouncements() {
    return this.database.db.select().from(announcements).orderBy(desc(announcements.createdAt));
  }

  async createAnnouncement(actorId: string, input: z.infer<typeof announcementCreateSchema>) {
    const [created] = await this.database.db
      .insert(announcements)
      .values({
        title: input.title,
        content: input.content,
        active: input.active,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
      })
      .returning();
    await this.audit.record({
      actorId,
      action: 'admin.announcement.create',
      targetType: 'announcement',
      targetId: created?.id ?? '',
      after: input,
    });
    return created;
  }

  async updateAnnouncement(
    actorId: string,
    id: string,
    input: Partial<z.infer<typeof announcementCreateSchema>>,
  ) {
    const [updated] = await this.database.db
      .update(announcements)
      .set({
        title: input.title,
        content: input.content,
        active: input.active,
        startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
        endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
      })
      .where(eq(announcements.id, id))
      .returning();
    await this.audit.record({
      actorId,
      action: 'admin.announcement.update',
      targetType: 'announcement',
      targetId: id,
      after: input,
    });
    return updated;
  }

  async deleteAnnouncement(actorId: string, id: string) {
    await this.database.db.delete(announcements).where(eq(announcements.id, id));
    await this.audit.record({
      actorId,
      action: 'admin.announcement.delete',
      targetType: 'announcement',
      targetId: id,
    });
    return { ok: true };
  }

  async publicAnnouncements() {
    return this.database.db
      .select()
      .from(announcements)
      .where(
        and(
          eq(announcements.active, true),
          or(isNull(announcements.startsAt), lte(announcements.startsAt, new Date())),
          or(isNull(announcements.endsAt), gte(announcements.endsAt, new Date())),
        ),
      )
      .orderBy(desc(announcements.createdAt))
      .limit(5);
  }

  async reindex() {
    await this.queue.enqueue(
      'search-index',
      { all: true },
      { idempotencyKey: `reindex:${Date.now()}` },
    );
    return { ok: true };
  }

  private async applyContentAction(targetType: string, targetId: string, action: string) {
    if (targetType === 'video') {
      await this.database.db
        .update(videos)
        .set({
          status: action === 'delete' ? 'deleted' : 'blocked',
          deletedAt: action === 'delete' ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(videos.id, targetId));
      await this.queue.enqueue(
        'search-index',
        { videoId: targetId },
        { idempotencyKey: `search:${targetId}:${Date.now()}` },
      );
    } else if (targetType === 'comment') {
      await this.database.db
        .update(comments)
        .set({
          status: action === 'delete' ? 'deleted' : 'hidden',
          deletedAt: action === 'delete' ? new Date() : null,
        })
        .where(eq(comments.id, targetId));
    } else if (targetType === 'danmaku') {
      await this.database.db
        .update(danmaku)
        .set({ status: action === 'delete' ? 'deleted' : 'hidden' })
        .where(eq(danmaku.id, targetId));
    }
  }

  private async checkFfmpegSafe(): Promise<boolean> {
    try {
      await checkFfmpeg();
      return true;
    } catch {
      return false;
    }
  }
}

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function maskRedisUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.password) parsed.password = '********';
    return parsed.toString();
  } catch {
    return '********';
  }
}

function mergeMasked(value: unknown, existing: unknown): Record<string, unknown> {
  const target = (existing && typeof existing === 'object' ? existing : {}) as Record<
    string,
    unknown
  >;
  if (!value || typeof value !== 'object') return target;
  const result: Record<string, unknown> = { ...target };
  for (const [key, next] of Object.entries(value as Record<string, unknown>)) {
    if (next === '********') continue;
    const current = target[key];
    if (
      next &&
      typeof next === 'object' &&
      !Array.isArray(next) &&
      current &&
      typeof current === 'object' &&
      !Array.isArray(current)
    ) {
      result[key] = mergeMasked(next, current);
    } else {
      result[key] = next;
    }
  }
  return result;
}
