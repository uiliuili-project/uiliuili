import crypto from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { aiModerationLogs } from '@uiliuili/db';
import {
  DEFAULT_MODERATION_PROMPT,
  type ModerationAction,
  type ModerationTarget,
} from '@uiliuili/shared';
import { CacheService } from '../common/cache.service';
import { DatabaseService } from '../common/database.service';
import { SettingsService } from '../common/settings.service';

export type ModerationDecision = 'allow' | 'reject' | 'pending' | 'flag';

export interface ModerationVerdict {
  decision: ModerationDecision;
  allowed: boolean;
  reason: string;
  categories: string[];
  model: string;
  latencyMs: number;
  cached: boolean;
  failed: boolean;
  error: string;
}

interface RawVerdict {
  allowed: boolean;
  reason: string;
  categories: string[];
}

/**
 * OpenAI-compatible content moderation. The service is deliberately fail-open
 * by default: an unavailable provider must not stop the community from
 * posting, and administrators can opt into fail-closed instead.
 */
@Injectable()
export class AiModerationService {
  private readonly logger = new Logger(AiModerationService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly settings: SettingsService,
    private readonly cache: CacheService,
  ) {}

  async moderate(
    targetType: ModerationTarget,
    content: string,
    options: {
      userId?: string;
      targetId?: string;
      skipCache?: boolean;
      log?: boolean;
      force?: boolean;
    } = {},
  ): Promise<ModerationVerdict> {
    const started = Date.now();
    const [configSettings, provider] = await Promise.all([
      this.settings.getAiModerationSettings(),
      this.settings.getAiConfig(),
    ]);
    if (!options.force && (!configSettings.enabled || !configSettings.targets?.[targetType])) {
      return this.allow('', provider.model, started);
    }
    const text = String(content ?? '')
      .trim()
      .slice(0, Number(configSettings.maxChars ?? 4000));
    if (!text) return this.allow('', provider.model, started);
    if (!provider.apiKey || !provider.baseUrl || !provider.model) {
      if (options.log !== false) {
        await this.writeLog(targetType, options, text, {
          allowed: true,
          decision: 'allow',
          reason: 'AI 审核未配置 API Key 或模型',
          categories: [],
          model: provider.model,
          latencyMs: Date.now() - started,
          cached: false,
          failed: true,
          error: 'missing provider configuration',
        });
      }
      return this.allow('AI 审核未配置，已按失败放行处理', provider.model, started);
    }

    const cacheMinutes = Math.max(0, Number(configSettings.cacheMinutes ?? 10));
    const cacheKey = `ai:moderation:${crypto
      .createHash('sha256')
      .update(`${provider.model}:${configSettings.prompt}:${text}`)
      .digest('hex')}`;
    if (!options.skipCache && cacheMinutes > 0) {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as RawVerdict;
        const verdict = this.toVerdict(parsed, configSettings.action, provider.model, 0, true);
        if (options.log !== false) {
          await this.writeLog(targetType, options, text, {
            ...verdict,
            error: '',
          });
        }
        return verdict;
      }
    }

    let raw: RawVerdict;
    try {
      raw = await this.request(configSettings, provider, text);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`AI moderation failed: ${message}`);
      if (configSettings.failMode === 'closed') {
        const verdict: ModerationVerdict = {
          decision: 'reject',
          allowed: false,
          reason: '内容审核服务暂不可用，请稍后再试',
          categories: [],
          model: provider.model,
          latencyMs: Date.now() - started,
          cached: false,
          failed: true,
          error: message,
        };
        if (options.log !== false) await this.writeLog(targetType, options, text, verdict);
        return verdict;
      }
      const verdict = this.allow('内容审核服务暂不可用，已放行', provider.model, started);
      verdict.failed = true;
      verdict.error = message;
      if (options.log !== false) await this.writeLog(targetType, options, text, verdict);
      return verdict;
    }

    if (!options.skipCache && cacheMinutes > 0) {
      await this.cache.set(cacheKey, JSON.stringify(raw), cacheMinutes * 60);
    }
    const verdict = this.toVerdict(
      raw,
      configSettings.action,
      provider.model,
      Date.now() - started,
      false,
    );
    if (options.log !== false) await this.writeLog(targetType, options, text, verdict);
    return verdict;
  }

  async test(content: string) {
    return this.moderate('comment', content, { skipCache: true, log: false, force: true });
  }

  private async request(
    settings: {
      baseUrl?: string;
      model?: string;
      prompt: string;
      timeoutMs: number;
      maxChars: number;
    },
    provider: { baseUrl: string; model: string; apiKey: string },
    text: string,
  ): Promise<RawVerdict> {
    const base = provider.baseUrl.replace(/\/+$/, '');
    const response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        temperature: 0,
        max_tokens: 300,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: settings.prompt || DEFAULT_MODERATION_PROMPT },
          { role: 'user', content: text },
        ],
      }),
      signal: AbortSignal.timeout(Math.max(500, Number(settings.timeoutMs ?? 6000))),
    });
    if (!response.ok) {
      const body = (await response.text()).slice(0, 300);
      throw new Error(`AI provider returned ${response.status}: ${body}`);
    }
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content ?? '';
    const parsed = parseJson(content);
    if (!parsed || typeof parsed.allowed !== 'boolean') {
      throw new Error('AI provider returned an invalid verdict');
    }
    return {
      allowed: parsed.allowed,
      reason: typeof parsed.reason === 'string' ? parsed.reason.slice(0, 500) : '',
      categories: Array.isArray(parsed.categories)
        ? parsed.categories.filter((item): item is string => typeof item === 'string').slice(0, 12)
        : [],
    };
  }

  private toVerdict(
    raw: RawVerdict,
    action: ModerationAction,
    model: string,
    latencyMs: number,
    cached: boolean,
  ): ModerationVerdict {
    const decision: ModerationDecision = raw.allowed ? 'allow' : action;
    return {
      decision,
      allowed: raw.allowed,
      reason: raw.reason,
      categories: raw.categories,
      model,
      latencyMs,
      cached,
      failed: false,
      error: '',
    };
  }

  private allow(reason: string, model: string, started: number): ModerationVerdict {
    return {
      decision: 'allow',
      allowed: true,
      reason,
      categories: [],
      model,
      latencyMs: Date.now() - started,
      cached: false,
      failed: false,
      error: '',
    };
  }

  private async writeLog(
    targetType: ModerationTarget,
    options: { userId?: string; targetId?: string },
    text: string,
    verdict: ModerationVerdict,
  ): Promise<void> {
    try {
      await this.database.db.insert(aiModerationLogs).values({
        targetType,
        targetId: options.targetId ?? '',
        userId: options.userId ?? null,
        excerpt: text.slice(0, 200),
        allowed: verdict.allowed,
        decision: verdict.decision,
        reason: verdict.reason.slice(0, 1000),
        categories: verdict.categories,
        model: verdict.model.slice(0, 120),
        latencyMs: Math.round(verdict.latencyMs),
        cached: verdict.cached,
        error: verdict.error.slice(0, 2000),
      });
    } catch (error) {
      this.logger.warn(`Unable to write AI moderation log: ${String(error)}`);
    }
  }
}

function parseJson(content: string): Record<string, unknown> | null {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/, '')
    .trim();
  try {
    return JSON.parse(cleaned) as Record<string, unknown>;
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
      } catch {}
    }
    return null;
  }
}
