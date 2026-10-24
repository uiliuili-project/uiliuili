import crypto from 'node:crypto';
import {
  type Db,
  authProviders,
  createDb,
  encryptSecret,
  readMigrations,
  seedInstance,
  siteSettings,
  splitStatements,
} from '@uiliuili/db';
import {
  APP_VERSION,
  DEFAULT_SETTINGS,
  type InstallConfig,
  type MailConfig,
} from '@uiliuili/shared';
import argon2 from 'argon2';
import { sql } from 'drizzle-orm';
import { testDatabase } from './database';
import { buildEnvFile, writeEnvFile } from './env';
import { type InstanceRecord, instanceExists, writeInstance } from './instance';
import { resolveInstallerPaths } from './paths';
import { clearInstallToken, getOrCreateInstallToken } from './token';

export type InstallStage =
  | 'validate'
  | 'database'
  | 'config'
  | 'migrate'
  | 'seed'
  | 'admin'
  | 'providers'
  | 'finalize'
  | 'restart';

export interface InstallProgress {
  stage: InstallStage;
  percent: number;
  message: string;
}

export interface InstallOptions {
  root?: string;
  appKey?: string;
  production?: boolean;
  instanceId?: string;
  onProgress?: (progress: InstallProgress) => void;
}

export interface InstallResult {
  instance: InstanceRecord;
  appKey: string;
  adminId: string;
  warnings: string[];
}

function progress(options: InstallOptions, stage: InstallStage, percent: number, message: string) {
  options.onProgress?.({ stage, percent, message });
}

async function applySettings(
  db: Db,
  values: Array<{ key: string; value: unknown; isSecret: boolean }>,
): Promise<void> {
  for (const item of values) {
    await db
      .insert(siteSettings)
      .values(item)
      .onConflictDoUpdate({
        target: siteSettings.key,
        set: { value: item.value, isSecret: item.isSecret, updatedAt: new Date() },
      });
  }
}

export async function runInstall(
  config: InstallConfig,
  options: InstallOptions = {},
): Promise<InstallResult> {
  const root = options.root ?? process.cwd();
  const warnings: string[] = [];
  if (instanceExists(root)) {
    throw new Error('uiliuili 已经安装。如需重装请使用 CLI reset 命令。');
  }

  progress(options, 'validate', 5, '正在检查数据库');
  const dbTest = await testDatabase(config.database);
  warnings.push(...dbTest.warnings);
  progress(options, 'database', 15, '数据库连接正常');

  const instanceId = options.instanceId ?? crypto.randomUUID();
  const appKey = options.appKey ?? process.env.APP_KEY ?? crypto.randomBytes(32).toString('hex');
  if (!/^[0-9a-f]{64}$/.test(appKey)) {
    throw new Error('APP_KEY 必须是 64 个十六进制字符');
  }
  getOrCreateInstallToken(root);
  const paths = resolveInstallerPaths(root);

  progress(options, 'config', 22, '正在写入运行配置');
  const envContent = buildEnvFile(config, {
    production:
      options.production ??
      (process.env.NODE_ENV === 'production' || config.site.url.startsWith('https://')),
    appKey,
  });
  writeEnvFile(paths.envFile, envContent);

  const passwordHash = await argon2.hash(config.admin.password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  const migrations = readMigrations();
  if (migrations.length === 0) throw new Error('安装包缺少数据库迁移文件');

  const { client, db } = createDb(
    `postgres://${encodeURIComponent(config.database.user)}:${encodeURIComponent(config.database.password)}@${config.database.host.includes(':') ? `[${config.database.host}]` : config.database.host}:${config.database.port}/${encodeURIComponent(config.database.database)}${config.database.ssl ? '?sslmode=require' : ''}`,
    { max: 3, onNotice: () => undefined },
  );

  let adminId = '';
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('uiliuili:install'))`);

      progress(options, 'migrate', 35, '正在创建数据表');
      await tx.execute(sql`CREATE SCHEMA IF NOT EXISTS "uiliuili"`);
      await tx.execute(
        sql`CREATE TABLE IF NOT EXISTS "uiliuili"."schema_migrations" (
          "name" text PRIMARY KEY NOT NULL,
          "applied_at" timestamp with time zone DEFAULT now() NOT NULL
        )`,
      );
      const trackingRows = await tx.execute<{ count: number }>(
        sql`SELECT COUNT(*)::int AS count FROM "uiliuili"."schema_migrations"`,
      );
      if (Number(trackingRows[0]?.count ?? 0) === 0 && migrations[0]) {
        const existing = await tx.execute<{ exists: boolean }>(
          sql`SELECT to_regclass('uiliuili.app_instance') IS NOT NULL AS exists`,
        );
        if (existing[0]?.exists) {
          await tx.execute(
            sql`INSERT INTO "uiliuili"."schema_migrations" ("name") VALUES (${migrations[0].name}) ON CONFLICT DO NOTHING`,
          );
        }
      }
      for (const migration of migrations) {
        const applied = await tx.execute<{ name: string }>(
          sql`SELECT name FROM "uiliuili"."schema_migrations" WHERE name = ${migration.name} LIMIT 1`,
        );
        if (applied.length > 0) continue;
        for (const statement of splitStatements(migration.sql)) {
          await tx.execute(sql.raw(statement));
        }
        await tx.execute(
          sql`INSERT INTO "uiliuili"."schema_migrations" ("name") VALUES (${migration.name})`,
        );
      }

      progress(options, 'seed', 55, '正在初始化站点数据');
      await seedInstance(tx as unknown as Db, {
        admin: config.admin,
        site: config.site,
        passwordHash,
        instanceId,
        version: APP_VERSION,
        appKey,
      });

      progress(options, 'admin', 70, '管理员账号已创建');
      const secretSettings: Array<{ key: string; value: unknown; isSecret: boolean }> = [
        { key: 'storage_config', value: encryptSecret(config.storage, appKey), isSecret: true },
        { key: 'redis_config', value: encryptSecret(config.redis ?? null, appKey), isSecret: true },
        { key: 'search_config', value: encryptSecret(config.search, appKey), isSecret: true },
        {
          key: 'mail_config',
          value: encryptSecret(config.mail ?? { enabled: false }, appKey),
          isSecret: true,
        },
        {
          key: 'mail',
          value: {
            ...DEFAULT_SETTINGS.mail,
            enabled: Boolean(config.mail?.enabled),
            verificationRequired: Boolean(config.mail?.verificationRequired),
          },
          isSecret: false,
        },
        {
          key: 'cache',
          value: { driver: config.redis ? 'redis' : 'memory' },
          isSecret: false,
        },
        {
          key: 'search',
          value: { driver: config.search.driver },
          isSecret: false,
        },
        {
          key: 'storage',
          value: { driver: config.storage.driver },
          isSecret: false,
        },
      ];
      await applySettings(tx as unknown as Db, secretSettings);

      progress(options, 'providers', 82, '正在配置登录方式');
      if (config.oauth) {
        for (const [provider, providerConfig] of Object.entries(config.oauth)) {
          if (!providerConfig) continue;
          await tx
            .insert(authProviders)
            .values({
              provider,
              enabled: providerConfig.enabled,
              configEncrypted: encryptSecret(providerConfig, appKey),
            })
            .onConflictDoUpdate({
              target: authProviders.provider,
              set: {
                enabled: providerConfig.enabled,
                configEncrypted: encryptSecret(providerConfig, appKey),
                updatedAt: new Date(),
              },
            });
        }
      }

      const rows = await tx.execute<{ id: string }>(
        sql`SELECT id FROM "uiliuili"."users" WHERE roles @> ARRAY['SUPER_ADMIN']::text[] LIMIT 1`,
      );
      adminId = rows[0]?.id ?? '';
    });

    progress(options, 'finalize', 94, '正在写入安装标记');
    const instance = writeInstance(root, config, instanceId);
    clearInstallToken(root);
    progress(options, 'restart', 100, '安装完成，服务即将重启');
    return { instance, appKey, adminId, warnings };
  } finally {
    await client.end({ timeout: 5 });
  }
}

export function mailConfigFromInstall(config: InstallConfig): MailConfig | null {
  return config.mail?.enabled ? config.mail : null;
}
