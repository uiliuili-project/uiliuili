#!/usr/bin/env node
import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {
  type Db,
  createDb,
  ensureDefaultFolders,
  migrationStatus,
  readMigrations,
  runMigrations,
  users,
} from '@uiliuili/db';
import {
  type InstallProgress,
  buildInstallConfigFromEnv,
  checkEnvironment,
  instanceExists,
  readInstance,
  removeInstanceFile,
  resolveInstallerPaths,
  runInstall,
  runtimeRoot,
} from '@uiliuili/installer';
import { APP_VERSION, type InstallConfig, installConfigSchema } from '@uiliuili/shared';
import argon2 from 'argon2';
import { Command } from 'commander';
import { eq, sql } from 'drizzle-orm';
import postgres from 'postgres';

const program = new Command();

function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('缺少 DATABASE_URL。请先完成安装或加载 .env。');
    process.exit(1);
  }
  return url;
}

function logProgress(progress: InstallProgress): void {
  const width = 24;
  const filled = Math.round((progress.percent / 100) * width);
  const bar = `${'█'.repeat(filled)}${'░'.repeat(Math.max(0, width - filled))}`;
  console.log(`${bar} ${String(progress.percent).padStart(3)}%  ${progress.message}`);
}

function readInstallConfigFile(file: string): InstallConfig {
  const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as unknown;
  const parsed = installConfigSchema.safeParse(raw);
  if (!parsed.success) {
    console.error('安装配置校验失败：');
    console.error(JSON.stringify(parsed.error.flatten(), null, 2));
    process.exit(1);
  }
  return parsed.data;
}

async function stampInstanceVersion(url: string): Promise<void> {
  const { client, db } = createDb(url, { max: 1 });
  try {
    await db.execute(
      sql`UPDATE "uiliuili"."app_instance" SET version = ${APP_VERSION}, updated_at = now()`,
    );
  } finally {
    await client.end({ timeout: 5 });
  }
}

async function migrateToLatest(): Promise<string[]> {
  const url = requireDatabaseUrl();
  const applied = await runMigrations(url);
  await stampInstanceVersion(url);
  return applied;
}

async function runInstallCommand(config: InstallConfig): Promise<void> {
  const root = runtimeRoot();
  if (instanceExists(root)) {
    console.error('uiliuili 已经安装。如需重装请先执行 reset --force。');
    process.exit(1);
  }
  try {
    const result = await runInstall(config, {
      root,
      production: process.env.NODE_ENV === 'production' || config.site.url.startsWith('https://'),
      onProgress: logProgress,
    });
    console.log('');
    console.log('安装完成。');
    console.log(`实例 ID：${result.instance.instanceId}`);
    console.log('');
    console.log('本站还没有站长账号。请打开站点并注册第一个账号，该账号将成为站长。');
    console.log(`站长认领码：${result.ownerClaimToken}`);
    console.log(
      '从服务器本机（localhost）注册时无需填写认领码。认领码只会显示这一次，请妥善保存。',
    );
    if (result.warnings.length) {
      console.log('警告：');
      for (const warning of result.warnings) console.log(`  - ${warning}`);
    }
    console.log('请启动 API、Worker、Web 与 Admin 进程。');
  } catch (error) {
    console.error('安装失败：', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

program.name('uiliuili').description('uiliuili 安装与运维命令行工具').version(APP_VERSION);

program
  .command('install')
  .description('执行无人值守安装（JSON 配置或环境变量）')
  .option('-c, --config <path>', '安装配置文件路径')
  .option('--from-env', '从环境变量读取安装配置（容器与自动化部署）')
  .option('--no-restart', '不做任何服务重启提示（CLI 默认为此行为）')
  .action(async (options: { config?: string; fromEnv?: boolean }) => {
    if (options.fromEnv && options.config) {
      console.error('--config 与 --from-env 不能同时使用。');
      process.exit(1);
    }
    if (options.fromEnv) {
      await runInstallCommand(buildInstallConfigFromEnv());
      return;
    }
    if (!options.config) {
      console.error('请提供 -c/--config <path> 或 --from-env。');
      process.exit(1);
    }
    await runInstallCommand(readInstallConfigFile(options.config));
  });

program
  .command('bootstrap')
  .description('容器引导：未安装时按环境变量安装，已安装时执行迁移')
  .action(async () => {
    const root = runtimeRoot();
    if (!instanceExists(root)) {
      console.log('未检测到安装标记，开始按环境变量安装…');
      await runInstallCommand(buildInstallConfigFromEnv());
      return;
    }
    const applied = await migrateToLatest();
    if (applied.length === 0) {
      console.log('实例已安装，数据库已是最新版本。');
    } else {
      for (const name of applied) console.log(`✓ ${name}`);
      console.log(`已应用 ${applied.length} 个迁移。`);
    }
    console.log('引导完成。');
  });

program
  .command('doctor')
  .description('检查环境、数据库与 FFmpeg')
  .action(async () => {
    const environment = await checkEnvironment(runtimeRoot());
    console.log(`Node.js ${environment.nodeVersion} · ${environment.platform}/${environment.arch}`);
    for (const check of environment.checks) {
      console.log(
        `${check.ok ? '✓' : check.required ? '✗' : '!'} ${check.label} — ${check.detail}`,
      );
    }
    if (!process.env.DATABASE_URL) {
      console.log('! DATABASE_URL 未配置（未安装或未加载 .env）');
    } else {
      const client = postgres(process.env.DATABASE_URL, { max: 1, onnotice: () => undefined });
      try {
        const rows = await client<{ version: string }[]>`SELECT version() AS version`;
        console.log(`✓ PostgreSQL — ${(rows[0]?.version ?? '').split(',')[0]}`);
      } catch (error) {
        console.log(`✗ PostgreSQL — ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        await client.end({ timeout: 5 });
      }
      const status = await migrationStatus(process.env.DATABASE_URL);
      console.log(`✓ 迁移 — 已应用 ${status.applied.length}，待应用 ${status.pending.length}`);
    }
    if (!environment.ok) process.exit(1);
  });

program
  .command('status')
  .description('显示实例与迁移状态')
  .action(async () => {
    const instance = readInstance(runtimeRoot());
    if (!instance) {
      console.log('尚未安装。');
      return;
    }
    console.log(`实例 ID：${instance.instanceId}`);
    console.log(`版本：${instance.version}`);
    console.log(`站点：${instance.siteUrl}`);
    console.log(`安装时间：${instance.installedAt}`);
    if (process.env.DATABASE_URL) {
      const status = await migrationStatus(process.env.DATABASE_URL);
      console.log(`迁移：已应用 ${status.applied.length}，待应用 ${status.pending.length}`);
      if (status.pending.length) console.log(`待应用：${status.pending.join(', ')}`);
    }
  });

program
  .command('migrate')
  .description('执行待应用的数据库迁移')
  .action(async () => {
    const applied = await migrateToLatest();
    if (applied.length === 0) {
      console.log('数据库已是最新版本。');
    } else {
      for (const name of applied) console.log(`✓ ${name}`);
      console.log(`已应用 ${applied.length} 个迁移。`);
    }
  });

program
  .command('owner:promote')
  .alias('admin:create')
  .description('恢复站长账号：创建或提升一个用户为站长')
  .option('-u, --username <username>', '用户名')
  .option('-e, --email <email>', '邮箱')
  .option('-p, --password <password>', '密码（不填则随机生成）')
  .action(async (options: { username?: string; email?: string; password?: string }) => {
    const url = requireDatabaseUrl();
    const username = options.username ?? `owner_${crypto.randomBytes(3).toString('hex')}`;
    const email = options.email ?? `${username}@example.com`;
    const password = options.password ?? crypto.randomBytes(12).toString('base64url');
    if (password.length < 10) {
      console.error('密码至少 10 个字符。');
      process.exit(1);
    }
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
    const { client, db } = createDb(url, { max: 1 });
    try {
      await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('uiliuili:owner'))`);
        const existing = await tx
          .select({ id: users.id })
          .from(users)
          .where(sql`lower(${users.username}) = ${username.toLowerCase()}`)
          .limit(1);
        if (existing[0]) {
          await tx
            .update(users)
            .set({ roles: ['ADMIN'], userGroup: 'ADMIN', updatedAt: new Date() })
            .where(
              sql`${users.id} <> ${existing[0].id} AND ${users.roles} @> ARRAY['SUPER_ADMIN']::text[]`,
            );
          await tx
            .update(users)
            .set({ roles: ['SUPER_ADMIN'], userGroup: 'OWNER', banned: false, passwordHash })
            .where(eq(users.id, existing[0].id));
          console.log(`已将用户 ${username} 恢复为站长。`);
        } else {
          await tx
            .update(users)
            .set({ roles: ['ADMIN'], userGroup: 'ADMIN', updatedAt: new Date() })
            .where(sql`${users.roles} @> ARRAY['SUPER_ADMIN']::text[]`);
          const [created] = await tx
            .insert(users)
            .values({
              username,
              email: email.toLowerCase(),
              displayName: username,
              passwordHash,
              emailVerified: true,
              roles: ['SUPER_ADMIN'],
              userGroup: 'OWNER',
              level: 6,
            })
            .returning();
          if (created) await ensureDefaultFolders(tx as unknown as Db, created.id);
          console.log(`已创建站长 ${username} <${email}>`);
        }
      });
      console.log(`密码：${password}`);
      console.log('请立即登录并修改密码。');
    } finally {
      await client.end({ timeout: 5 });
    }
  });

program
  .command('reset')
  .description('移除安装标记，可选清空数据库 schema')
  .option('--force', '确认执行危险操作')
  .option('--drop', '同时删除 uiliuili schema 与 .env')
  .action(async (options: { force?: boolean; drop?: boolean }) => {
    if (!options.force) {
      console.error('危险操作：请附加 --force 确认。');
      process.exit(1);
    }
    const root = runtimeRoot();
    if (options.drop && process.env.DATABASE_URL) {
      const client = postgres(process.env.DATABASE_URL, { max: 1 });
      try {
        await client.unsafe('DROP SCHEMA IF EXISTS "uiliuili" CASCADE');
        console.log('已删除 uiliuili schema。');
      } finally {
        await client.end({ timeout: 5 });
      }
    }
    removeInstanceFile(root);
    if (options.drop) {
      const paths = resolveInstallerPaths(root);
      fs.rmSync(paths.envFile, { force: true });
      console.log('已删除 config/instance.json 与 .env。');
    } else {
      console.log('已删除 config/instance.json；数据库保持不变。');
    }
  });

program
  .command('migrations:list')
  .description('列出迁移文件')
  .action(() => {
    for (const migration of readMigrations()) console.log(migration.name);
  });

void program.parseAsync(process.argv).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
