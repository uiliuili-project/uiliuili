import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { config } from '../config';

interface MemoryEntry {
  value: string;
  expiresAt: number;
}

@Injectable()
export class CacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CacheService.name);
  private readonly memory = new Map<string, MemoryEntry>();
  private redis: Redis | null = null;

  constructor() {
    if (config.redisUrl) {
      this.redis = new Redis(config.redisUrl, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
      });
      this.redis.on('error', (error) => this.logger.warn(`Redis unavailable: ${error.message}`));
    }
  }

  get mode(): 'redis' | 'memory' {
    return this.redis ? 'redis' : 'memory';
  }

  async get(key: string): Promise<string | null> {
    if (this.redis) {
      try {
        if (this.redis.status === 'wait') await this.redis.connect();
        return await this.redis.get(key);
      } catch {}
    }
    const entry = this.memory.get(key);
    if (!entry) return null;
    if (entry.expiresAt < Date.now()) {
      this.memory.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds = 60): Promise<void> {
    if (this.redis) {
      try {
        if (this.redis.status === 'wait') await this.redis.connect();
        await this.redis.set(key, value, 'EX', ttlSeconds);
        return;
      } catch {}
    }
    this.memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    if (this.memory.size > 5000) {
      const now = Date.now();
      for (const [entryKey, entry] of this.memory) {
        if (entry.expiresAt < now) this.memory.delete(entryKey);
      }
    }
  }

  async del(...keys: string[]): Promise<void> {
    if (this.redis) {
      try {
        if (this.redis.status === 'wait') await this.redis.connect();
        if (keys.length) await this.redis.del(...keys);
      } catch {}
    }
    for (const key of keys) this.memory.delete(key);
  }

  async increment(key: string, ttlSeconds: number): Promise<number> {
    if (this.redis) {
      try {
        if (this.redis.status === 'wait') await this.redis.connect();
        const value = await this.redis.incr(key);
        if (value === 1) await this.redis.expire(key, ttlSeconds);
        return value;
      } catch {}
    }
    const entry = this.memory.get(key);
    const next = entry && entry.expiresAt > Date.now() ? Number(entry.value) + 1 : 1;
    this.memory.set(key, { value: String(next), expiresAt: Date.now() + ttlSeconds * 1000 });
    return next;
  }

  async onModuleDestroy(): Promise<void> {
    if (this.redis) await this.redis.quit().catch(() => undefined);
  }
}
