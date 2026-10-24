import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(10, '密码至少需要 10 个字符')
  .max(128, '密码不能超过 128 个字符')
  .regex(/[a-zA-Z]/, '密码必须包含字母')
  .regex(/[0-9]/, '密码必须包含数字');

export const databaseConfigSchema = z.object({
  host: z.string().min(1).default('127.0.0.1'),
  port: z.coerce.number().int().min(1).max(65535).default(5432),
  database: z.string().min(1).default('uiliuili'),
  user: z.string().min(1).default('uiliuili'),
  password: z.string().default(''),
  ssl: z.boolean().default(false),
  schema: z
    .string()
    .min(1)
    .max(48)
    .regex(/^[a-z_][a-z0-9_]*$/, 'Schema 只能包含小写字母、数字和下划线')
    .default('uiliuili'),
  createIfMissing: z.boolean().default(true),
});

export const siteConfigSchema = z.object({
  name: z.string().min(1).max(80).default('uiliuili'),
  description: z.string().max(300).default('一个自托管的弹幕视频站'),
  url: z.string().url('站点 URL 格式不正确').default('http://localhost:3000'),
  timezone: z.string().default('Asia/Shanghai'),
  locale: z.enum(['zh-CN', 'en-US']).default('zh-CN'),
  registration: z.enum(['open', 'invite', 'closed']).default('open'),
});

export const adminConfigSchema = z.object({
  username: z
    .string()
    .min(3, '用户名至少 3 个字符')
    .max(32)
    .regex(/^[a-zA-Z0-9_\-]+$/, '用户名只能包含字母、数字、下划线和短横线'),
  email: z.string().email('邮箱格式不正确'),
  password: passwordSchema,
});

export const s3ConfigSchema = z.object({
  endpoint: z.string().url().optional().or(z.literal('')),
  region: z.string().min(1).default('us-east-1'),
  bucket: z.string().min(1),
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
  forcePathStyle: z.boolean().default(false),
  publicBaseUrl: z.string().url().optional().or(z.literal('')),
  prefix: z.string().default('uiliuili'),
});

export const storageConfigSchema = z.discriminatedUnion('driver', [
  z.object({
    driver: z.literal('local'),
    localPath: z.string().min(1).default('./storage/uploads'),
  }),
  z.object({
    driver: z.literal('s3'),
    s3: s3ConfigSchema,
  }),
]);

export const redisConfigSchema = z.object({
  url: z.string().min(1),
});

export const searchConfigSchema = z.discriminatedUnion('driver', [
  z.object({ driver: z.literal('postgres') }),
  z.object({
    driver: z.literal('meilisearch'),
    url: z.string().url(),
    key: z.string().default(''),
    indexPrefix: z.string().default('uiliuili'),
  }),
]);

export const mailConfigSchema = z.object({
  enabled: z.boolean().default(false),
  host: z.string().default(''),
  port: z.coerce.number().int().min(1).max(65535).default(587),
  secure: z.boolean().default(false),
  user: z.string().default(''),
  password: z.string().default(''),
  fromName: z.string().default('uiliuili'),
  fromAddress: z.string().default(''),
  verificationRequired: z.boolean().default(false),
});

const oauthProviderSchema = z.object({
  enabled: z.boolean().default(false),
  clientId: z.string().default(''),
  clientSecret: z.string().default(''),
  issuer: z.string().default(''),
  scopes: z.array(z.string()).default([]),
});

export const oauthConfigSchema = z.object({
  github: oauthProviderSchema.optional(),
  google: oauthProviderSchema.optional(),
  oidc: oauthProviderSchema.optional(),
});

export const installConfigSchema = z.object({
  locale: z.enum(['zh-CN', 'en-US']).default('zh-CN'),
  database: databaseConfigSchema,
  site: siteConfigSchema,
  admin: adminConfigSchema,
  storage: storageConfigSchema.default({ driver: 'local', localPath: './storage/uploads' }),
  redis: redisConfigSchema.nullish(),
  search: searchConfigSchema.default({ driver: 'postgres' }),
  mail: mailConfigSchema.optional(),
  oauth: oauthConfigSchema.optional(),
  demoContent: z.boolean().default(false),
});

export const installDatabaseTestSchema = z.object({
  config: databaseConfigSchema,
});

export const installStorageTestSchema = z.object({
  config: storageConfigSchema,
});

export const installMailTestSchema = z.object({
  config: mailConfigSchema.extend({ to: z.string().email() }),
});

export type DatabaseConfig = z.infer<typeof databaseConfigSchema>;
export type SiteConfig = z.infer<typeof siteConfigSchema>;
export type AdminConfig = z.infer<typeof adminConfigSchema>;
export type S3Config = z.infer<typeof s3ConfigSchema>;
export type StorageConfig = z.infer<typeof storageConfigSchema>;
export type RedisConfig = z.infer<typeof redisConfigSchema>;
export type SearchConfig = z.infer<typeof searchConfigSchema>;
export type MailConfig = z.infer<typeof mailConfigSchema>;
export type OAuthConfig = z.infer<typeof oauthConfigSchema>;
export type InstallConfig = z.infer<typeof installConfigSchema>;
