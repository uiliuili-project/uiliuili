import {
  type DatabaseConfig,
  type InstallConfig,
  type MailConfig,
  type StorageConfig,
  installConfigSchema,
} from '@uiliuili/shared';

export class InstallEnvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InstallEnvError';
  }
}

function bool(value: string | undefined, fallback = false): boolean {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function optional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseDatabaseUrl(raw: string): DatabaseConfig {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new InstallEnvError('DATABASE_URL 不是合法的 URL');
  }
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:') {
    throw new InstallEnvError('DATABASE_URL 必须使用 postgres:// 或 postgresql:// 协议');
  }
  const database = decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (!database) throw new InstallEnvError('DATABASE_URL 缺少数据库名');
  const sslMode = url.searchParams.get('sslmode') ?? '';
  return {
    host: url.hostname.replace(/^\[(.*)\]$/, '$1') || '127.0.0.1',
    port: Number(url.port || 5432),
    database,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    ssl: ['require', 'verify-ca', 'verify-full'].includes(sslMode),
    schema: optional(url.searchParams.get('schema') ?? undefined) ?? 'uiliuili',
    createIfMissing: true,
  };
}

function databaseFromEnv(env: NodeJS.ProcessEnv): DatabaseConfig {
  const schema = optional(env.DB_SCHEMA) ?? 'uiliuili';
  const hasParts = Boolean(optional(env.DB_HOST) ?? optional(env.DB_NAME) ?? optional(env.DB_USER));
  if (!hasParts) {
    const url = optional(env.DATABASE_URL);
    if (!url) {
      throw new InstallEnvError('缺少 DATABASE_URL（或 DB_HOST/DB_NAME/DB_USER）');
    }
    return { ...parseDatabaseUrl(url), schema };
  }
  const database = optional(env.DB_NAME);
  const user = optional(env.DB_USER);
  if (!database || !user) {
    throw new InstallEnvError('DB_NAME 与 DB_USER 必须同时提供');
  }
  return {
    host: optional(env.DB_HOST) ?? '127.0.0.1',
    port: Number(env.DB_PORT ?? 5432),
    database,
    user,
    password: env.DB_PASSWORD ?? '',
    ssl: bool(env.DB_SSL, false),
    schema,
    createIfMissing: bool(env.DB_CREATE_IF_MISSING, true),
  };
}

function storageFromEnv(env: NodeJS.ProcessEnv): StorageConfig {
  const driver = (optional(env.STORAGE_DRIVER) ?? 'local').toLowerCase();
  if (driver === 's3') {
    const bucket = optional(env.S3_BUCKET);
    const accessKeyId = optional(env.S3_ACCESS_KEY_ID);
    const secretAccessKey = optional(env.S3_SECRET_ACCESS_KEY);
    if (!bucket || !accessKeyId || !secretAccessKey) {
      throw new InstallEnvError('S3 存储需要 S3_BUCKET、S3_ACCESS_KEY_ID 与 S3_SECRET_ACCESS_KEY');
    }
    return {
      driver: 's3',
      s3: {
        endpoint: optional(env.S3_ENDPOINT) ?? '',
        region: optional(env.S3_REGION) ?? 'us-east-1',
        bucket,
        accessKeyId,
        secretAccessKey,
        forcePathStyle: bool(env.S3_FORCE_PATH_STYLE, false),
        publicBaseUrl: optional(env.S3_PUBLIC_BASE_URL) ?? '',
        prefix: optional(env.S3_PREFIX) ?? 'uiliuili',
      },
    };
  }
  if (driver !== 'local') {
    throw new InstallEnvError(`不支持的 STORAGE_DRIVER: ${driver}`);
  }
  return {
    driver: 'local',
    localPath:
      optional(env.STORAGE_LOCAL_PATH) ?? optional(env.STORAGE_ROOT) ?? './storage/uploads',
  };
}

function mailFromEnv(env: NodeJS.ProcessEnv): MailConfig | undefined {
  const host = optional(env.MAIL_HOST);
  if (!host && !bool(env.MAIL_ENABLED, false)) return undefined;
  return {
    enabled: bool(env.MAIL_ENABLED, Boolean(host)),
    host: host ?? '',
    port: Number(env.MAIL_PORT ?? 587),
    secure: bool(env.MAIL_SECURE, false),
    user: optional(env.MAIL_USER) ?? '',
    password: env.MAIL_PASSWORD ?? '',
    fromName: optional(env.MAIL_FROM_NAME) ?? 'uiliuili',
    fromAddress: optional(env.MAIL_FROM_ADDRESS) ?? '',
    verificationRequired: bool(env.MAIL_VERIFICATION_REQUIRED, false),
  };
}

/**
 * Build a validated install configuration from environment variables.
 *
 * Used by containers and unattended provisioning, where there is no browser
 * wizard. Any missing or invalid value fails loudly instead of guessing
 * credentials.
 */
export function buildInstallConfigFromEnv(env: NodeJS.ProcessEnv = process.env): InstallConfig {
  const username = optional(env.ADMIN_USERNAME);
  const email = optional(env.ADMIN_EMAIL);
  const password = env.ADMIN_PASSWORD;
  if (!username || !email || !password) {
    throw new InstallEnvError(
      '需要 ADMIN_USERNAME、ADMIN_EMAIL 与 ADMIN_PASSWORD 才能无人值守安装',
    );
  }

  const locale = (optional(env.INSTALL_LOCALE) ?? optional(env.SITE_LOCALE) ?? 'zh-CN') as
    | 'zh-CN'
    | 'en-US';

  const meilisearchUrl = optional(env.MEILISEARCH_URL);
  const redisUrl = optional(env.REDIS_URL);

  const parsed = installConfigSchema.safeParse({
    locale,
    database: databaseFromEnv(env),
    site: {
      name: optional(env.SITE_NAME) ?? 'uiliuili',
      description: optional(env.SITE_DESCRIPTION) ?? '一个自托管的弹幕视频站',
      url: optional(env.APP_URL) ?? 'http://localhost:3000',
      timezone: optional(env.SITE_TIMEZONE) ?? 'Asia/Shanghai',
      locale,
      registration: optional(env.SITE_REGISTRATION) ?? 'open',
    },
    admin: { username, email, password },
    storage: storageFromEnv(env),
    redis: redisUrl ? { url: redisUrl } : null,
    search: meilisearchUrl
      ? {
          driver: 'meilisearch',
          url: meilisearchUrl,
          key: optional(env.MEILISEARCH_KEY) ?? '',
          indexPrefix: optional(env.MEILISEARCH_INDEX_PREFIX) ?? 'uiliuili',
        }
      : { driver: 'postgres' },
    mail: mailFromEnv(env),
    demoContent: bool(env.INSTALL_DEMO_CONTENT, false),
  });

  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'config'}: ${issue.message}`)
      .join('; ');
    throw new InstallEnvError(`安装配置校验失败：${details}`);
  }
  return parsed.data;
}
