import crypto from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { AppError, ERROR_CODES, type RateLimitAction } from '@uiliuili/shared';
import type { AuthUser } from './auth-user';
import { CacheService } from './cache.service';
import { type CaptchaContext, CaptchaService } from './captcha.service';
import { SettingsService } from './settings.service';

/**
 * Applies the configurable per-user and per-IP request policy.
 *
 * Soft threshold asks for human verification; token verification grants a
 * short pass. Hard threshold rejects with a retry window.
 */
@Injectable()
export class RateLimitService {
  constructor(
    private readonly settings: SettingsService,
    private readonly cache: CacheService,
    private readonly captcha: CaptchaService,
  ) {}

  async check(action: RateLimitAction, context: CaptchaContext): Promise<void> {
    const settings = await this.settings.getRateLimitSettings();
    const config = settings.actions[action];

    // A solved captcha grants a short pass that covers both the rate limit and
    // the always-on captcha rule.
    if (await this.captcha.hasPass(context)) return;
    // Actions marked "always require captcha" are protected even when rate
    // limiting itself is switched off.
    if (await this.captcha.isAlwaysRequired(action, context)) {
      throw this.captchaRequired(action, Number(config?.windowSeconds ?? 60));
    }

    if (!settings.enabled) return;
    if (!config) return;

    const counters: Array<Promise<number>> = [];
    // Include both dimensions so throwaway accounts on one address cannot
    // bypass the limit and shared addresses still cannot amplify it.
    if (context.userId) {
      counters.push(
        this.cache.increment(`rl:${action}:u:${context.userId}`, Number(config.windowSeconds)),
      );
    }
    if (context.ip) {
      counters.push(
        this.cache.increment(
          `rl:${action}:i:${crypto.createHash('sha256').update(context.ip).digest('hex').slice(0, 32)}`,
          Number(config.windowSeconds),
        ),
      );
    }
    if (counters.length === 0) return;
    const counts = await Promise.all(counters);
    const current = Math.max(...counts);
    if (current > Number(config.hard)) {
      throw new AppError(
        ERROR_CODES.RATE_LIMITED,
        `操作过于频繁，请 ${formatWait(Number(config.windowSeconds))}后再试`,
        429,
        {
          action,
          retryAfter: Number(config.windowSeconds),
          hard: Number(config.hard),
          reason: 'hard',
        },
      );
    }
    if (Number(config.soft) > 0 && current > Number(config.soft)) {
      if (await this.captcha.isEnabled()) {
        throw this.captchaRequired(action, Number(config.windowSeconds));
      }
    }
  }

  contextFrom(user?: AuthUser | null, ip?: string): CaptchaContext {
    return CaptchaService.contextFrom(user ?? undefined, ip);
  }

  private captchaRequired(action: RateLimitAction, retryAfter: number): AppError {
    return new AppError(ERROR_CODES.CAPTCHA_REQUIRED, '请完成人机验证后继续', 429, {
      action,
      retryAfter,
      reason: 'captcha',
    });
  }
}

function formatWait(seconds: number): string {
  if (seconds >= 3600) return `${Math.ceil(seconds / 3600)} 小时`;
  if (seconds >= 60) return `${Math.ceil(seconds / 60)} 分钟`;
  return `${Math.max(1, seconds)} 秒`;
}
