import crypto from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { danmaku, videos } from '@uiliuili/db';
import { AppError, type DanmakuCreateInput, type DanmakuItem, ERROR_CODES } from '@uiliuili/shared';
import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';
import type { AuthUser } from '../common/auth-user';
import { CacheService } from '../common/cache.service';
import { DatabaseService } from '../common/database.service';
import { RateLimitService } from '../common/rate-limit.service';
import { SettingsService } from '../common/settings.service';
import { StorageService } from '../common/storage.service';
import { VideosService } from '../videos/videos.service';
import { DanmakuBus } from './danmaku.bus';

const SEGMENT_MS = 6 * 60 * 1000;

@Injectable()
export class DanmakuService {
  constructor(
    private readonly database: DatabaseService,
    private readonly settings: SettingsService,
    private readonly cache: CacheService,
    private readonly videos: VideosService,
    private readonly storage: StorageService,
    private readonly bus: DanmakuBus,
    private readonly rateLimit: RateLimitService,
  ) {}

  async segment(videoId: string, segment: number, viewer?: AuthUser, partId?: string) {
    const row = await this.videos.getRow(videoId);
    this.videos.assertCanView(row.video, viewer);
    if (partId) await this.videos.getPart(videoId, partId);
    const cacheKey = `danmaku:seg:${videoId}:${partId ?? 'legacy'}:${segment}:${
      viewer?.id ?? 'anon'
    }`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return JSON.parse(cached) as { items: DanmakuItem[]; segment: number };
    const conditions = [
      eq(danmaku.videoId, videoId),
      eq(danmaku.segment, segment),
      partId ? eq(danmaku.partId, partId) : isNull(danmaku.partId),
      viewer
        ? or(
            eq(danmaku.status, 'visible'),
            and(eq(danmaku.status, 'hidden'), eq(danmaku.userId, viewer.id)),
          )!
        : eq(danmaku.status, 'visible'),
    ];
    const rows = await this.database.db
      .select()
      .from(danmaku)
      .where(and(...conditions))
      .orderBy(asc(danmaku.progressMs), asc(danmaku.createdAt))
      .limit(5000);
    const items = rows.map((item) => this.toItem(item, viewer));
    const payload = { items, segment };
    await this.cache.set(cacheKey, JSON.stringify(payload), 30);
    return payload;
  }

  /** Full danmaku list for the side panel, scoped to a part when present. */
  async list(videoId: string, viewer?: AuthUser, partId?: string, limit = 2000) {
    const row = await this.videos.getRow(videoId);
    this.videos.assertCanView(row.video, viewer);
    if (partId) await this.videos.getPart(videoId, partId);
    const rows = await this.database.db
      .select()
      .from(danmaku)
      .where(
        and(
          eq(danmaku.videoId, videoId),
          partId ? eq(danmaku.partId, partId) : isNull(danmaku.partId),
          eq(danmaku.status, 'visible'),
        ),
      )
      .orderBy(asc(danmaku.progressMs), asc(danmaku.createdAt))
      .limit(Math.min(limit, 5000));
    return { items: rows.map((item) => this.toItem(item, viewer)) };
  }

  async send(
    user: AuthUser,
    videoId: string,
    input: DanmakuCreateInput,
    ip?: string,
  ): Promise<DanmakuItem> {
    if (user.banned) throw new AppError(ERROR_CODES.FORBIDDEN, '账号已被封禁', 403);
    if (user.mutedUntil && user.mutedUntil > new Date()) {
      throw new AppError(ERROR_CODES.FORBIDDEN, '你当前已被禁言', 403);
    }
    const row = await this.videos.getRow(videoId);
    this.videos.assertCanView(row.video, user);
    if (input.partId) await this.videos.getPart(videoId, input.partId);
    if (row.video.status !== 'published') {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '视频尚未发布', 400);
    }
    const settings = await this.settings.getDanmakuSettings();
    if (!settings.enabled) throw new AppError(ERROR_CODES.BAD_REQUEST, '弹幕功能已关闭', 400);
    if (user.level < Number(settings.levelGate ?? 0)) {
      throw new AppError(ERROR_CODES.FORBIDDEN, '你的等级还不能发送弹幕', 403);
    }
    const content = input.content.trim();
    if (!content || content.length > Number(settings.maxLength ?? 100)) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '弹幕长度不合法', 400);
    }
    const blockedWords = (settings.blockedWords as string[]) ?? [];
    const lower = content.toLowerCase();
    if (blockedWords.some((word) => word && lower.includes(String(word).toLowerCase()))) {
      throw new AppError(ERROR_CODES.BAD_REQUEST, '弹幕包含不被允许的内容', 400);
    }
    await this.rateLimit.check('danmaku', this.rateLimit.contextFrom(user, ip));

    const lastKey = `danmaku:last:${user.id}`;
    const last = Number((await this.cache.get(lastKey)) ?? 0);
    const interval = Number(settings.intervalSeconds ?? 3) * 1000;
    if (Date.now() - last < interval) {
      throw new AppError(ERROR_CODES.RATE_LIMITED, '发送弹幕太快了，请稍后再试', 429);
    }
    const duplicateKey = `danmaku:dup:${user.id}:${videoId}:${crypto
      .createHash('sha1')
      .update(content)
      .digest('hex')
      .slice(0, 12)}`;
    if (await this.cache.get(duplicateKey)) {
      throw new AppError(ERROR_CODES.RATE_LIMITED, '请不要重复发送相同弹幕', 429);
    }
    await this.cache.set(lastKey, String(Date.now()), Math.ceil(interval / 1000) + 1);
    await this.cache.set(duplicateKey, '1', 30);

    const segment = Math.floor(input.progressMs / SEGMENT_MS);
    const [created] = await this.database.db
      .insert(danmaku)
      .values({
        videoId,
        userId: user.id,
        partId: input.partId ?? null,
        pool: input.pool,
        progressMs: input.progressMs,
        segment,
        mode: input.mode,
        color: input.color,
        fontSize: input.fontSize,
        content,
        status: 'visible',
        ipHash: crypto
          .createHash('sha256')
          .update(ip ?? '')
          .digest('hex')
          .slice(0, 32),
      })
      .returning();
    if (!created) throw new AppError(ERROR_CODES.INTERNAL_ERROR, '发送弹幕失败', 500);
    await this.database.db
      .update(videos)
      .set({ danmakuCount: sql`${videos.danmakuCount} + 1` })
      .where(eq(videos.id, videoId));
    await this.cache.del(
      `danmaku:seg:${videoId}:${input.partId ?? 'legacy'}:${segment}:${user.id}`,
      `danmaku:seg:${videoId}:${input.partId ?? 'legacy'}:${segment}:anon`,
    );
    const item = this.toItem(created, user);
    this.bus.publish({ videoId, partId: input.partId ?? null, item });
    return item;
  }

  async importXml(
    user: AuthUser,
    videoId: string,
    items: Array<DanmakuCreateInput>,
    partId?: string,
  ) {
    const video = await this.videos.getRow(videoId);
    if (video.video.uploaderId !== user.id && !user.permissions.includes('danmaku:manage')) {
      throw new AppError(ERROR_CODES.FORBIDDEN, '没有权限导入弹幕', 403);
    }
    const values = items.slice(0, 10_000).map((item) => ({
      videoId,
      userId: user.id,
      partId: item.partId ?? partId ?? null,
      pool: item.pool,
      progressMs: item.progressMs,
      segment: Math.floor(item.progressMs / SEGMENT_MS),
      mode: item.mode,
      color: item.color,
      fontSize: item.fontSize,
      content: item.content.slice(0, 100),
      status: 'visible',
      ipHash: '',
    }));
    for (let index = 0; index < values.length; index += 500) {
      await this.database.db.insert(danmaku).values(values.slice(index, index + 500));
    }
    if (values.length > 0) {
      await this.database.db
        .update(videos)
        .set({ danmakuCount: sql`${videos.danmakuCount} + ${values.length}` })
        .where(eq(videos.id, videoId));
    }
    return { imported: values.length };
  }

  async exportXml(videoId: string, viewer?: AuthUser, partId?: string) {
    const row = await this.videos.getRow(videoId);
    this.videos.assertCanView(row.video, viewer);
    if (partId) await this.videos.getPart(videoId, partId);
    const rows = await this.database.db
      .select()
      .from(danmaku)
      .where(
        and(
          eq(danmaku.videoId, videoId),
          partId ? eq(danmaku.partId, partId) : isNull(danmaku.partId),
          eq(danmaku.status, 'visible'),
        ),
      )
      .orderBy(asc(danmaku.progressMs))
      .limit(20_000);
    const { serializeBilibiliXml } = await import('@uiliuili/danmaku');
    return serializeBilibiliXml(rows.map((item) => this.toItem(item, viewer)));
  }

  toItem(item: typeof danmaku.$inferSelect, viewer?: AuthUser): DanmakuItem {
    return {
      id: item.id,
      progressMs: item.progressMs,
      partId: item.partId,
      pool: item.pool,
      mode: item.mode,
      color: item.color,
      fontSize: item.fontSize,
      content: item.content,
      createdAt: item.createdAt.toISOString(),
      userHash: crypto.createHash('sha1').update(item.userId).digest('hex').slice(0, 8),
      mine: viewer?.id === item.userId,
    };
  }
}
