import type { DatabaseConfig } from '@uiliuili/shared';
import postgres from 'postgres';
import { buildDatabaseUrl } from './env';

export interface DatabaseTestResult {
  ok: boolean;
  serverVersion: string;
  databaseExists: boolean;
  createdDatabase: boolean;
  schemaReady: boolean;
  canCreateTables: boolean;
  warnings: string[];
}

function assertIdentifier(value: string, label: string): void {
  if (!/^[a-z_][a-z0-9_]*$/.test(value)) {
    throw new Error(`${label} 只能包含小写字母、数字和下划线`);
  }
}

async function databaseExists(config: DatabaseConfig): Promise<boolean> {
  const adminUrl = buildDatabaseUrl(config, 'postgres');
  const client = postgres(adminUrl, { max: 1, onnotice: () => undefined });
  try {
    const rows = await client<{ exists: boolean }[]>`
      SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = ${config.database}) AS exists
    `;
    return Boolean(rows[0]?.exists);
  } finally {
    await client.end({ timeout: 5 });
  }
}

async function createDatabase(config: DatabaseConfig): Promise<void> {
  assertIdentifier(config.database, '数据库名');
  const adminUrl = buildDatabaseUrl(config, 'postgres');
  const client = postgres(adminUrl, { max: 1, onnotice: () => undefined });
  try {
    await client.unsafe(`CREATE DATABASE "${config.database}"`);
  } finally {
    await client.end({ timeout: 5 });
  }
}

export async function testDatabase(config: DatabaseConfig): Promise<DatabaseTestResult> {
  if (config.schema !== 'uiliuili') {
    throw new Error('当前版本仅支持固定的 uiliuili schema');
  }
  const warnings: string[] = [];
  let createdDatabase = false;
  let exists = await databaseExists(config);

  if (!exists && config.createIfMissing) {
    await createDatabase(config);
    exists = true;
    createdDatabase = true;
  } else if (!exists) {
    throw new Error(`数据库 ${config.database} 不存在，请先创建或启用自动创建`);
  }

  const client = postgres(buildDatabaseUrl(config), { max: 1, onnotice: () => undefined });
  try {
    const versionRows = await client<{ version: string }[]>`SELECT version() AS version`;
    const serverVersion = versionRows[0]?.version ?? '';
    const major = Number.parseInt(serverVersion.match(/PostgreSQL (\d+)/)?.[1] ?? '0', 10);
    if (major < 14) {
      warnings.push(`当前 PostgreSQL 版本为 ${major || '未知'}，建议使用 16 或更高版本`);
    }
    assertIdentifier(config.schema, 'Schema');
    let schemaReady = false;
    let canCreateTables = false;
    try {
      await client.unsafe(`CREATE SCHEMA IF NOT EXISTS "${config.schema}"`);
      schemaReady = true;
    } catch (error) {
      warnings.push(
        `无法创建 schema ${config.schema}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (schemaReady) {
      try {
        await client.begin(async (tx) => {
          await tx.unsafe(
            `CREATE TABLE "${config.schema}"."__uiliuili_write_test" (id integer PRIMARY KEY)`,
          );
          await tx.unsafe(`DROP TABLE "${config.schema}"."__uiliuili_write_test"`);
        });
        canCreateTables = true;
      } catch (error) {
        warnings.push(
          `无法在 schema ${config.schema} 中建表: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    if (!canCreateTables) {
      throw new Error('数据库用户没有创建表的权限');
    }

    return {
      ok: true,
      serverVersion,
      databaseExists: true,
      createdDatabase,
      schemaReady,
      canCreateTables,
      warnings,
    };
  } finally {
    await client.end({ timeout: 5 });
  }
}
