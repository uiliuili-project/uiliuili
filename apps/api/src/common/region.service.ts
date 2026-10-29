import fs from 'node:fs/promises';
import { Injectable, Logger } from '@nestjs/common';
import {
  REGION_OPTIONS,
  type RegionSource,
  normalizeRegionCode,
  normalizeRegionList,
} from '@uiliuili/shared';
import type { RequestWithUser } from './auth-user';
import type { RegionContextValue } from './region-context';
import { SettingsService } from './settings.service';

interface CountryResponse {
  country?: { iso_code?: string };
}

type MaxmindReader = { get(ip: string): CountryResponse | null };
interface MaxmindModule {
  open<T>(path: string): Promise<T>;
}

interface ReaderEntry {
  mtimeMs: number;
  reader: MaxmindReader;
}

/**
 * Resolves the country for a request. Account region wins, then the configured
 * proxy/CDN country header, then an optional MaxMind database, then the site
 * fallback. Users can never choose their own region.
 */
@Injectable()
export class RegionService {
  private readonly logger = new Logger(RegionService.name);
  private readonly readers = new Map<string, ReaderEntry>();
  private geoipWarningLogged = false;

  constructor(private readonly settings: SettingsService) {}

  async resolve(
    request: Pick<RequestWithUser, 'user' | 'headers' | 'ip'>,
  ): Promise<RegionContextValue> {
    const [region, restricted] = await Promise.all([
      this.settings.getRegionSettings(),
      this.settings.getRestrictedSettings(),
    ]);
    const blockedRegions = normalizeRegionList(restricted.blockedRegions);
    const accountRegion = normalizeRegionCode(request.user?.region);
    const resolved = accountRegion
      ? { code: accountRegion, source: 'registration' as const }
      : await this.resolveCode(request, region.header, region.geoipDatabase, region.fallback);
    return this.buildContext(resolved.code, resolved.source, request.user, {
      blockedRegions,
      defaultBehavior: restricted.defaultBehavior === 'not_found' ? 'not_found' : 'message',
      defaultMessage: restricted.defaultMessage || '该内容在您所在的地区不可用',
    });
  }

  /** Resolves a region for a request without considering any account. */
  async resolveAnonymous(
    request: Pick<RequestWithUser, 'headers' | 'ip'>,
  ): Promise<{ code: string; source: RegionSource }> {
    const region = await this.settings.getRegionSettings();
    return this.resolveCode(request, region.header, region.geoipDatabase, region.fallback);
  }

  async resolveForRegistration(
    request: Pick<RequestWithUser, 'headers' | 'ip'>,
  ): Promise<{ code: string; source: RegionSource }> {
    return this.resolveAnonymous(request);
  }

  private async resolveCode(
    request: Pick<RequestWithUser, 'headers' | 'ip'>,
    headerName: string,
    geoipDatabase: string,
    fallback: string,
  ): Promise<{ code: string; source: RegionSource }> {
    const fromHeader = this.fromHeader(request.headers, headerName);
    if (fromHeader) return { code: fromHeader, source: 'header' };
    const fromGeoip = await this.fromGeoip(request.ip, geoipDatabase);
    if (fromGeoip) return { code: fromGeoip, source: 'geoip' };
    return { code: normalizeRegionCode(fallback), source: 'fallback' };
  }

  private buildContext(
    code: string,
    source: string,
    user: RequestWithUser['user'],
    policy: {
      blockedRegions: string[];
      defaultBehavior: 'message' | 'not_found';
      defaultMessage: string;
    },
  ): RegionContextValue {
    const privileged = Boolean(
      user &&
        (user.permissions.includes('video:manage_any') ||
          user.permissions.includes('video:review')),
    );
    const unrestricted = Boolean(code) && !policy.blockedRegions.includes(code);
    const showRestricted = Boolean(user?.showRestricted) && unrestricted;
    return {
      code,
      source,
      showRestricted,
      privileged,
      restrictedAllowed: unrestricted && (showRestricted || privileged),
      blockedRegions: policy.blockedRegions,
      defaultBehavior: policy.defaultBehavior,
      defaultMessage: policy.defaultMessage,
    };
  }

  private fromHeader(
    headers: Record<string, string | string[] | undefined>,
    headerName: string,
  ): string {
    const name = (headerName || 'cf-ipcountry').trim().toLowerCase();
    const value = headers[name] ?? headers[name.replace(/_/g, '-')];
    const raw = Array.isArray(value) ? value[0] : value;
    return normalizeRegionCode(raw);
  }

  private async fromGeoip(ip: string | undefined, databasePath: string): Promise<string> {
    if (!ip || !databasePath) return '';
    const reader = await this.reader(databasePath);
    if (!reader) return '';
    try {
      const result = reader.get(ip);
      return normalizeRegionCode(result?.country?.iso_code);
    } catch (error) {
      this.logger.warn(`GeoIP lookup failed for ${ip}: ${String(error)}`);
      return '';
    }
  }

  private async reader(databasePath: string): Promise<MaxmindReader | null> {
    if (!databasePath.trim()) return null;
    try {
      const stat = await fs.stat(databasePath);
      const cached = this.readers.get(databasePath);
      if (cached && cached.mtimeMs === stat.mtimeMs) return cached.reader;
      const importer = new Function('specifier', 'return import(specifier)') as (
        specifier: string,
      ) => Promise<MaxmindModule>;
      const maxmind = await importer('maxmind');
      const reader = await maxmind.open<MaxmindReader>(databasePath);
      this.readers.set(databasePath, { mtimeMs: stat.mtimeMs, reader });
      return reader;
    } catch (error) {
      if (!this.geoipWarningLogged) {
        this.geoipWarningLogged = true;
        this.logger.warn(
          `GeoIP database is unavailable (${databasePath}). Install the optional "maxmind" package and provide a .mmdb file. ${String(error)}`,
        );
      }
      return null;
    }
  }

  /** Public region catalog used by the studio and administration screens. */
  options() {
    return { items: REGION_OPTIONS };
  }
}
