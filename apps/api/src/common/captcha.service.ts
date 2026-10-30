import crypto from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { AppError, type CaptchaAction, type CaptchaProvider, ERROR_CODES } from '@uiliuili/shared';
import type { AuthUser } from './auth-user';
import { CacheService } from './cache.service';
import { SettingsService } from './settings.service';

export interface CaptchaContext {
  userId?: string;
  ip?: string;
  staff?: boolean;
}

interface ProviderResponse {
  success?: boolean;
  score?: number;
  action?: string;
  hostname?: string;
  'error-codes'?: string[];
}

const VERIFY_URLS: Record<CaptchaProvider, string> = {
  turnstile: 'https://challenges.cloudflare.com/turnstile/v0/siteverify',
  recaptcha_v2: 'https://www.google.com/recaptcha/api/siteverify',
  recaptcha_v3: 'https://www.google.com/recaptcha/api/siteverify',
};

@Injectable()
export class CaptchaService {
  private readonly logger = new Logger(CaptchaService.name);

  constructor(
    private readonly settings: SettingsService,
    private readonly cache: CacheService,
  ) {}

  static contextFrom(user?: AuthUser, ip?: string): CaptchaContext {
    return {
      userId: user?.id,
      ip,
      staff: Boolean(user?.permissions.some((permission) => permission.startsWith('settings:'))),
    };
  }

  async isEnabled(): Promise<boolean> {
    const [settings, config] = await Promise.all([
      this.settings.getCaptchaSettings(),
      this.settings.getCaptchaConfig(),
    ]);
    return Boolean(settings.enabled && settings.siteKey && config.secretKey);
  }

  async isAlwaysRequired(action: string, context: CaptchaContext): Promise<boolean> {
    if (!(await this.isEnabled())) return false;
    const settings = await this.settings.getCaptchaSettings();
    if (settings.skipStaff && context.staff) return false;
    return Boolean(settings.always[action as CaptchaAction]);
  }

  passKey(context: CaptchaContext): string | null {
    if (context.userId) return `captcha:pass:u:${context.userId}`;
    if (context.ip) return `captcha:pass:i:${hash(context.ip)}`;
    return null;
  }

  async hasPass(context: CaptchaContext): Promise<boolean> {
    const key = this.passKey(context);
    if (!key) return false;
    return Boolean(await this.cache.get(key));
  }

  async grantPass(context: CaptchaContext): Promise<number> {
    const settings = await this.settings.getRateLimitSettings();
    const minutes = Math.max(1, Number(settings.passMinutes ?? 15));
    const key = this.passKey(context);
    if (key) await this.cache.set(key, '1', minutes * 60);
    return minutes;
  }

  /**
   * Verifies a provider token, rejects replayed tokens and, on success, grants
   * a short pass so the challenged request can be retried.
   */
  async verify(
    token: string,
    action: CaptchaAction,
    context: CaptchaContext,
  ): Promise<{ ok: true; passMinutes: number }> {
    if (!(await this.isEnabled())) {
      throw new AppError(ERROR_CODES.CAPTCHA_FAILED, '站点未启用或未配置人机验证', 400);
    }
    const value = token.trim();
    if (!value || value.length > 4096) {
      throw new AppError(ERROR_CODES.CAPTCHA_FAILED, '人机验证令牌无效', 400);
    }
    const tokenHash = hash(value);
    if (await this.cache.get(`captcha:used:${tokenHash}`)) {
      throw new AppError(ERROR_CODES.CAPTCHA_FAILED, '人机验证令牌已使用，请重新验证', 400);
    }
    const [settings, config, site] = await Promise.all([
      this.settings.getCaptchaSettings(),
      this.settings.getCaptchaConfig(),
      this.settings.getSite(),
    ]);
    const body = new URLSearchParams({
      secret: config.secretKey,
      response: value,
    });
    if (context.ip) body.set('remoteip', context.ip);
    let result: ProviderResponse;
    try {
      const response = await fetch(VERIFY_URLS[settings.provider], {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body,
        signal: AbortSignal.timeout(8000),
      });
      result = (await response.json()) as ProviderResponse;
    } catch (error) {
      this.logger.warn(`Captcha provider request failed: ${String(error)}`);
      throw new AppError(ERROR_CODES.CAPTCHA_FAILED, '人机验证服务暂不可用，请稍后再试', 503);
    }
    if (!result.success) {
      throw new AppError(ERROR_CODES.CAPTCHA_FAILED, '人机验证未通过，请重试', 400, {
        errors: result['error-codes'] ?? [],
      });
    }
    if (settings.provider === 'recaptcha_v3') {
      const score = Number(result.score ?? 0);
      if (score < Number(settings.minScore ?? 0.5)) {
        throw new AppError(ERROR_CODES.CAPTCHA_FAILED, '人机验证分数过低，请稍后再试', 400, {
          score,
        });
      }
    }
    const expectedHost = safeHostname(String(site.url ?? ''));
    if (expectedHost && result.hostname && result.hostname !== expectedHost) {
      throw new AppError(ERROR_CODES.CAPTCHA_FAILED, '人机验证域名不匹配', 400);
    }
    await this.cache.set(`captcha:used:${tokenHash}`, '1', 10 * 60);
    const passMinutes = await this.grantPass(context);
    return { ok: true, passMinutes };
  }

  async test(): Promise<{ ok: boolean; message: string }> {
    const [settings, config] = await Promise.all([
      this.settings.getCaptchaSettings(),
      this.settings.getCaptchaConfig(),
    ]);
    if (!settings.enabled) return { ok: false, message: '人机验证当前未启用' };
    if (!settings.siteKey) return { ok: false, message: '缺少站点密钥（Site Key）' };
    if (!config.secretKey) return { ok: false, message: '缺少服务端密钥（Secret Key）' };
    return {
      ok: true,
      message: `已配置 ${settings.provider}，前端可加载验证组件`,
    };
  }
}

function hash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex').slice(0, 40);
}

function safeHostname(value: string): string {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return '';
  }
}
