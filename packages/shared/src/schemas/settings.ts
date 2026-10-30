import { z } from 'zod';
import {
  CAPTCHA_ACTIONS,
  CAPTCHA_PROVIDERS,
  MODERATION_ACTIONS,
  MODERATION_FAIL_MODES,
  MODERATION_TARGETS,
  NAV_ICONS,
  NAV_VISIBILITIES,
  RATE_LIMIT_ACTIONS,
} from '../constants';

const countryCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{2}$/);

export const countryBadgeSchema = z.object({
  enabled: z.boolean().default(true),
  showName: z.boolean().default(true),
  hideForGuests: z.boolean().default(false),
  trustedOnly: z.boolean().default(true),
  blockedCountries: z.array(countryCode).max(300).default([]),
});

export const brandingSettingsSchema = z.object({
  /** Show the site name next to the logo in the header. */
  showName: z.boolean().default(true),
  countryBadge: countryBadgeSchema,
});

export const navigationItemSchema = z.object({
  id: z.string().max(64).default(''),
  label: z.string().trim().min(1).max(40),
  href: z.string().trim().min(1).max(500),
  icon: z.enum(NAV_ICONS).default('link'),
  newTab: z.boolean().default(false),
  visibility: z.enum(NAV_VISIBILITIES).default('all'),
  enabled: z.boolean().default(true),
  highlight: z.boolean().default(false),
  sort: z.number().int().min(-10000).max(10000).default(0),
});

export const navigationSettingsSchema = z.object({
  header: z.array(navigationItemSchema).max(12).default([]),
  footer: z.array(navigationItemSchema).max(12).default([]),
});

export const customCodeSettingsSchema = z.object({
  headerEnabled: z.boolean().default(false),
  headerHtml: z.string().max(200_000).default(''),
  footerEnabled: z.boolean().default(false),
  footerHtml: z.string().max(200_000).default(''),
});

export const analyticsSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  measurementId: z
    .string()
    .trim()
    .max(40)
    .refine((value) => value === '' || /^G-[A-Z0-9]{4,}$/i.test(value), {
      message: '请输入 G- 开头的 GA4 衡量 ID',
    })
    .default(''),
  anonymizeIp: z.boolean().default(true),
  trackAdmin: z.boolean().default(false),
  respectDnt: z.boolean().default(true),
});

export const legalSettingsSchema = z.object({
  termsHtml: z.string().max(200_000).default(''),
  privacyHtml: z.string().max(200_000).default(''),
  termsVersion: z.string().trim().min(1).max(40).default('1'),
  requireConsent: z.boolean().default(true),
});

const captchaAlwaysSchema = z.object(
  Object.fromEntries(CAPTCHA_ACTIONS.map((action) => [action, z.boolean().default(false)])) as {
    [K in (typeof CAPTCHA_ACTIONS)[number]]: z.ZodDefault<z.ZodBoolean>;
  },
);

export const captchaSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  provider: z.enum(CAPTCHA_PROVIDERS).default('turnstile'),
  siteKey: z.string().trim().max(200).default(''),
  minScore: z.number().min(0).max(1).default(0.5),
  always: captchaAlwaysSchema,
  skipStaff: z.boolean().default(true),
});

export const captchaConfigSchema = z.object({
  secretKey: z.string().trim().max(500).default(''),
});

export const captchaVerifySchema = z.object({
  token: z.string().min(1).max(4096),
  action: z.enum(CAPTCHA_ACTIONS).default('login'),
});

const rateActionSchema = z
  .object({
    windowSeconds: z.number().int().min(5).max(86_400).default(60),
    soft: z.number().int().min(0).max(10_000).default(0),
    hard: z.number().int().min(1).max(10_000).default(10),
  })
  // The hard limit is evaluated first, so a soft threshold at or above it could
  // never trigger the captcha step. Zero disables the soft threshold.
  .refine((value) => value.soft === 0 || value.hard > value.soft, {
    message: '硬阈值必须大于软阈值（软阈值为 0 表示不启用）',
    path: ['hard'],
  });

export const rateLimitSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  passMinutes: z.number().int().min(1).max(1440).default(15),
  actions: z.object(
    Object.fromEntries(RATE_LIMIT_ACTIONS.map((action) => [action, rateActionSchema])) as {
      [K in (typeof RATE_LIMIT_ACTIONS)[number]]: typeof rateActionSchema;
    },
  ),
});

export const aiModerationSettingsSchema = z.object({
  enabled: z.boolean().default(false),
  targets: z.object(
    Object.fromEntries(MODERATION_TARGETS.map((target) => [target, z.boolean().default(true)])) as {
      [K in (typeof MODERATION_TARGETS)[number]]: z.ZodDefault<z.ZodBoolean>;
    },
  ),
  action: z.enum(MODERATION_ACTIONS).default('pending'),
  failMode: z.enum(MODERATION_FAIL_MODES).default('open'),
  timeoutMs: z.number().int().min(500).max(60_000).default(6000),
  maxChars: z.number().int().min(100).max(20_000).default(4000),
  cacheMinutes: z.number().int().min(0).max(1440).default(10),
  prompt: z.string().min(10).max(20_000),
});

export const aiConfigSchema = z.object({
  baseUrl: z.string().trim().max(500).default('https://api.openai.com/v1'),
  model: z.string().trim().min(1).max(120).default('gpt-4o-mini'),
  apiKey: z.string().trim().max(500).default(''),
});

export const reviewSettingsSchema = z.object({
  comments: z.boolean().default(false),
  dynamics: z.boolean().default(false),
  articles: z.boolean().default(false),
});

/** Group names accepted by the settings update endpoint. */
export const SETTINGS_GROUP_SCHEMAS = {
  branding: brandingSettingsSchema,
  navigation: navigationSettingsSchema,
  customCode: customCodeSettingsSchema,
  analytics: analyticsSettingsSchema,
  legal: legalSettingsSchema,
  captcha: captchaSettingsSchema,
  rateLimit: rateLimitSettingsSchema,
  aiModeration: aiModerationSettingsSchema,
  review: reviewSettingsSchema,
} as const;

export type SettingsGroupKey = keyof typeof SETTINGS_GROUP_SCHEMAS;
