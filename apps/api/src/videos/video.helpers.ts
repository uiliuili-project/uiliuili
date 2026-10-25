import crypto from 'node:crypto';
import type { DbCategory, DbUser, DbVideo } from '@uiliuili/db';
import type { Category, PublicUser, VideoCard } from '@uiliuili/shared';

export interface VideoJoinRow {
  video: DbVideo;
  uploader: DbUser;
  category: DbCategory | null;
}

export function publicUser(user: DbUser, badges?: PublicUser['badges']): PublicUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    roles: user.roles,
    level: user.level,
    experience: user.experience,
    badges,
    createdAt: user.createdAt.toISOString(),
  };
}

export function categoryPayload(category: DbCategory): Category {
  return {
    id: category.id,
    slug: category.slug,
    name: category.name,
    sort: category.sort,
    parentId: category.parentId,
  };
}

export function videoCard(row: VideoJoinRow, tags: string[]): VideoCard {
  return {
    id: row.video.id,
    title: row.video.title,
    coverUrl: row.video.coverUrl,
    durationSeconds: row.video.durationSeconds,
    views: row.video.viewCount,
    likes: row.video.likeCount,
    coins: row.video.coinCount,
    favorites: row.video.favoriteCount,
    comments: row.video.commentCount,
    danmaku: row.video.danmakuCount,
    publishedAt: row.video.publishedAt?.toISOString() ?? null,
    createdAt: row.video.createdAt.toISOString(),
    category: row.category ? categoryPayload(row.category) : null,
    uploader: publicUser(row.uploader),
    tags,
  };
}

export function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset }), 'utf8').toString('base64url');
}

export function decodeCursor(cursor?: string): number {
  if (!cursor) return 0;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      offset?: number;
    };
    return Math.max(0, Number(parsed.offset ?? 0));
  } catch {
    return 0;
  }
}

export function tagSlug(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fa5_-]/g, '')
    .slice(0, 40);
  return normalized || `tag-${crypto.createHash('sha1').update(name).digest('hex').slice(0, 10)}`;
}

export function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** index).toFixed(1)} ${units[index]}`;
}
