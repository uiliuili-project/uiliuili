import { Injectable, Logger } from '@nestjs/common';
import { authProviders, decryptSecret, encryptSecret, siteSettings } from '@uiliuili/db';
import {
  DEFAULT_SETTINGS,
  type MailConfig,
  type SearchConfig,
  type StorageConfig,
} from '@uiliuili/shared';
import { eq } from 'drizzle-orm';
import { config } from '../config';
import { CacheService } from './cache.service';
import { DatabaseService } from './database.service';

interface CachedSetting {
  value: unknown;
  isSecret: boolean;
  expiresAt: number;
}

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);
  private readonly cache = new Map<string, CachedSetting>();
  private readonly ttlMs = 15_000;

  constructor(
    private readonly database: DatabaseService,
    private readonly cacheService: CacheService,
  ) {}

  async get<T>(key: string, fallback: T): Promise<T> {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value as T;
    const rows = await this.database.db
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.key, key))
      .limit(1);
    const row = rows[0];
    if (!row) {
      this.cache.set(key, { value: fallback, isSecret: false, expiresAt: Date.now() + this.ttlMs });
      return fallback;
    }
    this.cache.set(key, {
      value: row.value,
      isSecret: row.isSecret,
      expiresAt: Date.now() + this.ttlMs,
    });
    return row.value as T;
  }

  async getGroup<T extends Record<string, unknown>>(key: string, fallback: T): Promise<T> {
    const stored = await this.get<Partial<T> | null>(key, null);
    if (!stored) return fallback;
    return { ...fallback, ...stored };
  }

  async set(key: string, value: unknown, isSecret = false): Promise<void> {
    const stored = isSecret ? encryptSecret(value, config.appKey) : value;
    await this.database.db
      .insert(siteSettings)
      .values({ key, value: stored, isSecret })
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: { value: stored, isSecret, updatedAt: new Date() },
      });
    this.cache.delete(key);
    await this.cacheService.del('settings:public');
  }

  async getSecret<T>(key: string, fallback: T): Promise<T> {
    const rows = await this.database.db
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.key, key))
      .limit(1);
    const row = rows[0];
    if (!row || !row.isSecret || !row.value) return fallback;
    try {
      return decryptSecret<T>(String(row.value), config.appKey);
    } catch (error) {
      this.logger.warn(`Unable to decrypt setting ${key}: ${String(error)}`);
      return fallback;
    }
  }

  async getStorageConfig(): Promise<StorageConfig> {
    const stored = await this.getSecret<StorageConfig | null>('storage_config', null);
    if (stored) return stored;
    return { driver: 'local', localPath: config.storageRoot };
  }

  async getMailConfig(): Promise<MailConfig | null> {
    const stored = await this.getSecret<(MailConfig & { enabled?: boolean }) | null>(
      'mail_config',
      null,
    );
    if (!stored?.enabled) return null;
    return stored;
  }

  async getSearchConfig(): Promise<SearchConfig> {
    return this.getSecret<SearchConfig>('search_config', { driver: 'postgres' });
  }

  async getRedisConfig(): Promise<{ url: string } | null> {
    return this.getSecret<{ url: string } | null>('redis_config', null);
  }

  async getSite<T extends Record<string, unknown>>(): Promise<T & typeof DEFAULT_SETTINGS.site> {
    return this.getGroup('site', DEFAULT_SETTINGS.site) as Promise<
      T & typeof DEFAULT_SETTINGS.site
    >;
  }

  async getUploadSettings() {
    return this.getGroup('upload', DEFAULT_SETTINGS.upload);
  }

  async getPlaybackSettings() {
    return this.getGroup('playback', DEFAULT_SETTINGS.playback);
  }

  async getDanmakuSettings() {
    return this.getGroup('danmaku', DEFAULT_SETTINGS.danmaku);
  }

  async getSocialSettings() {
    return this.getGroup('social', DEFAULT_SETTINGS.social);
  }

  async getRecommendationSettings() {
    return this.getGroup('recommendation', DEFAULT_SETTINGS.recommendation);
  }

  async getSecuritySettings() {
    return this.getGroup('security', DEFAULT_SETTINGS.security);
  }

  async getRegionSettings() {
    return this.getGroup('region', DEFAULT_SETTINGS.region);
  }

  async getRestrictedSettings() {
    return this.getGroup('restricted', DEFAULT_SETTINGS.restricted);
  }

  async getPublicSettings() {
    const cached = await this.cacheService.get('settings:public');
    if (cached) return JSON.parse(cached) as Record<string, unknown>;
    const [
      site,
      upload,
      playback,
      danmaku,
      social,
      recommendation,
      mail,
      security,
      region,
      restricted,
      search,
      storage,
    ] = await Promise.all([
      this.getGroup('site', DEFAULT_SETTINGS.site),
      this.getGroup('upload', DEFAULT_SETTINGS.upload),
      this.getGroup('playback', DEFAULT_SETTINGS.playback),
      this.getGroup('danmaku', DEFAULT_SETTINGS.danmaku),
      this.getGroup('social', DEFAULT_SETTINGS.social),
      this.getGroup('recommendation', DEFAULT_SETTINGS.recommendation),
      this.getGroup('mail', DEFAULT_SETTINGS.mail),
      this.getGroup('security', DEFAULT_SETTINGS.security),
      this.getGroup('region', DEFAULT_SETTINGS.region),
      this.getGroup('restricted', DEFAULT_SETTINGS.restricted),
      this.getGroup('search', { driver: 'postgres' }),
      this.getGroup('storage', { driver: 'local' }),
    ]);
    const payload = {
      site: {
        name: site.name,
        description: site.description,
        logoUrl: site.logoUrl,
        url: site.url,
        locale: site.locale,
        timezone: site.timezone,
        registration: site.registration,
        maintenance: site.maintenance,
        icp: site.icp,
        footer: site.footer,
      },
      upload: {
        maxBytes: upload.maxBytes,
        maxDurationSeconds: upload.maxDurationSeconds,
        maxResolution: upload.maxResolution,
        allowedExtensions: upload.allowedExtensions,
      },
      playback,
      danmaku,
      social,
      recommendation: {
        enabled: recommendation.enabled,
        explorationRatio: recommendation.explorationRatio,
      },
      mail: { enabled: mail.enabled, verificationRequired: mail.verificationRequired },
      security: { sessionDays: security.sessionDays },
      region: { fallback: region.fallback },
      restricted: {
        defaultBehavior: restricted.defaultBehavior,
        defaultMessage: restricted.defaultMessage,
      },
      search,
      storage,
    };
    await this.cacheService.set('settings:public', JSON.stringify(payload), 60);
    return payload;
  }

  async providerSettings() {
    const [storage, mail, search, redis] = await Promise.all([
      this.getStorageConfig(),
      this.getMailConfig(),
      this.getSearchConfig(),
      this.getRedisConfig(),
    ]);
    return { storage, mail, search, redis };
  }

  async getOAuthProvider(provider: string): Promise<{
    enabled: boolean;
    clientId: string;
    clientSecret: string;
    issuer: string;
    scopes: string[];
  } | null> {
    const rows = await this.database.db
      .select()
      .from(authProviders)
      .where(eq(authProviders.provider, provider))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    try {
      const configValue = decryptSecret<{
        enabled: boolean;
        clientId: string;
        clientSecret: string;
        issuer: string;
        scopes: string[];
      }>(row.configEncrypted, config.appKey);
      return { ...configValue, enabled: row.enabled };
    } catch {
      return null;
    }
  }

  invalidate(): void {
    this.cache.clear();
  }
}
