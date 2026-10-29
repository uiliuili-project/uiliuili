import { AsyncLocalStorage } from 'node:async_hooks';
import { videos } from '@uiliuili/db';
import { AppError, ERROR_CODES } from '@uiliuili/shared';
import { type SQL, and, sql } from 'drizzle-orm';

export type RegionDenialReason = 'login_required' | 'region_blocked' | 'preference_off';

export interface RegionContextValue {
  /** Resolved ISO 3166-1 alpha-2 country code, empty when unknown. */
  code: string;
  source: string;
  /** True when the account opted in to restricted content. */
  showRestricted: boolean;
  /** Staff can preview content regardless of region policy. */
  privileged: boolean;
  /** True when restricted content may be shown to this request. */
  restrictedAllowed: boolean;
  blockedRegions: string[];
  defaultBehavior: 'message' | 'not_found';
  defaultMessage: string;
}

export const FALLBACK_REGION_CONTEXT: RegionContextValue = {
  code: '',
  source: 'fallback',
  showRestricted: false,
  privileged: false,
  restrictedAllowed: false,
  blockedRegions: [],
  defaultBehavior: 'message',
  defaultMessage: '该内容在您所在的地区不可用',
};

const storage = new AsyncLocalStorage<RegionContextValue>();

export function runWithRegionContext<T>(value: RegionContextValue, fn: () => T): T {
  return storage.run(value, fn);
}

export function currentRegionContext(): RegionContextValue {
  return storage.getStore() ?? FALLBACK_REGION_CONTEXT;
}

/**
 * SQL predicate hiding videos the current request may not list. Staff bypass
 * the filter for moderation and preview.
 */
export function videoRegionCondition(context = currentRegionContext()): SQL {
  if (context.privileged) return sql`true`;
  const conditions: SQL[] = [];
  if (!context.restrictedAllowed) {
    conditions.push(sql`${videos.restricted} = false`);
  }
  conditions.push(
    sql`(${videos.regionMode} <> 'block' OR NOT (${context.code} = ANY(${videos.regionCodes})))`,
  );
  return and(...conditions)!;
}

export interface RegionVideoPolicy {
  restricted: boolean;
  regionMode: string;
  regionCodes: string[];
  regionDenyBehavior: string;
  regionDenyMessage: string;
  uploaderId: string;
}

export function regionDenialReason(
  video: RegionVideoPolicy,
  viewerId?: string,
  context = currentRegionContext(),
): RegionDenialReason | null {
  if (context.privileged) return null;
  if (viewerId && viewerId === video.uploaderId) return null;
  const restrictedByPerVideoRule =
    video.regionMode === 'block' &&
    Boolean(context.code) &&
    video.regionCodes.some((code) => code.toUpperCase() === context.code);
  if (restrictedByPerVideoRule) return 'region_blocked';
  if (!video.restricted) return null;
  if (!viewerId) return 'login_required';
  if (!context.restrictedAllowed) {
    return context.blockedRegions.includes(context.code) ? 'region_blocked' : 'preference_off';
  }
  return null;
}

/** Builds the denial surfaced for a region-restricted video. */
export function regionDenialError(
  video: RegionVideoPolicy,
  reason: RegionDenialReason,
  context = currentRegionContext(),
): AppError {
  if (reason === 'login_required') {
    return new AppError(ERROR_CODES.REGION_RESTRICTED, '登录后可观看限制级内容', 451, {
      region: context.code,
      reason,
      restricted: true,
    });
  }
  const behavior =
    video.regionDenyBehavior === 'default' ? context.defaultBehavior : video.regionDenyBehavior;
  if (behavior === 'not_found') {
    return new AppError(ERROR_CODES.NOT_FOUND, '视频不存在', 404);
  }
  const message =
    video.regionDenyMessage.trim() || context.defaultMessage || '该内容在您所在的地区不可用';
  return new AppError(ERROR_CODES.REGION_RESTRICTED, message, 451, {
    region: context.code,
    reason,
    restricted: true,
  });
}
