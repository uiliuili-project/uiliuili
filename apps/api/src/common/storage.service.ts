import crypto from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { type StorageProvider, createStorageProvider } from '@uiliuili/media';
import { config } from '../config';
import { SettingsService } from './settings.service';

@Injectable()
export class StorageService {
  private cached: { key: string; provider: StorageProvider } | null = null;

  constructor(private readonly settings: SettingsService) {}

  async provider(): Promise<StorageProvider> {
    const storageConfig = await this.settings.getStorageConfig();
    const cacheKey = JSON.stringify(storageConfig);
    if (this.cached?.key === cacheKey) return this.cached.provider;
    const provider = createStorageProvider(storageConfig);
    this.cached = { key: cacheKey, provider };
    return provider;
  }

  async publicUrl(key: string): Promise<string | null> {
    const provider = await this.provider();
    return provider.publicUrl(key);
  }

  async signedUrl(key: string, ttlSeconds = 3600): Promise<string> {
    const provider = await this.provider();
    if (provider.driver === 's3') return provider.signedUrl(key, ttlSeconds);
    const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
    const signature = this.sign(key, expires);
    const encoded = key
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/');
    return `/media/${encoded}?exp=${expires}&sig=${signature}`;
  }

  sign(key: string, expires: number): string {
    return crypto
      .createHmac('sha256', config.appKey)
      .update(`${key}:${expires}`)
      .digest('base64url');
  }

  verify(key: string, expires: number, signature: string): boolean {
    if (!expires || expires < Math.floor(Date.now() / 1000)) return false;
    const expected = this.sign(key, expires);
    const left = Buffer.from(expected);
    const right = Buffer.from(signature ?? '');
    if (left.length !== right.length) return false;
    return crypto.timingSafeEqual(left, right);
  }

  async test(): Promise<void> {
    const provider = await this.provider();
    await provider.test();
  }
}
