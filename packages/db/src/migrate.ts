import fs from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';

export interface MigrationFile {
  name: string;
  sql: string;
}

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

const TRACKING_DDL = [
  'CREATE SCHEMA IF NOT EXISTS "uiliuili"',
  `CREATE TABLE IF NOT EXISTS "uiliuili"."schema_migrations" (
    "name" text PRIMARY KEY NOT NULL,
    "applied_at" timestamp with time zone DEFAULT now() NOT NULL
  )`,
];

export function readMigrations(directory = MIGRATIONS_DIR): MigrationFile[] {
  if (!fs.existsSync(directory)) return [];
  return fs
    .readdirSync(directory)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => ({
      name: file,
      sql: fs.readFileSync(path.join(directory, file), 'utf8'),
    }));
}

export function splitStatements(sql: string): string[] {
  return sql
    .split('--> statement-breakpoint')
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export async function runMigrations(
  connectionString: string,
  migrations: MigrationFile[] = readMigrations(),
): Promise<string[]> {
  const client = postgres(connectionString, { max: 1, onnotice: () => undefined });
  const applied: string[] = [];
  try {
    await client.begin(async (tx) => {
      await tx.unsafe('SELECT pg_advisory_xact_lock(hashtext($1))', ['uiliuili:migrate']);
      for (const statement of TRACKING_DDL) await tx.unsafe(statement);
      const [{ count: trackingCount }] = await tx<{ count: number }[]>`
        SELECT COUNT(*)::int AS count FROM "uiliuili"."schema_migrations"
      `;
      if (Number(trackingCount) === 0 && migrations[0]) {
        const [{ exists }] = await tx<{ exists: boolean }[]>`
          SELECT to_regclass('uiliuili.app_instance') IS NOT NULL AS exists
        `;
        if (exists) {
          await tx`
            INSERT INTO "uiliuili"."schema_migrations" ("name")
            VALUES (${migrations[0].name}) ON CONFLICT DO NOTHING
          `;
        }
      }
      for (const migration of migrations) {
        const rows = await tx`
          SELECT 1 FROM "uiliuili"."schema_migrations" WHERE name = ${migration.name} LIMIT 1
        `;
        if (rows.length > 0) continue;
        for (const statement of splitStatements(migration.sql)) {
          await tx.unsafe(statement);
        }
        await tx`
          INSERT INTO "uiliuili"."schema_migrations" ("name") VALUES (${migration.name})
        `;
        applied.push(migration.name);
      }
    });
  } finally {
    await client.end({ timeout: 5 });
  }
  return applied;
}

export async function migrationStatus(
  connectionString: string,
  migrations: MigrationFile[] = readMigrations(),
): Promise<{ applied: string[]; pending: string[] }> {
  const client = postgres(connectionString, { max: 1, onnotice: () => undefined });
  try {
    let rows: Array<{ name: string }> = [];
    try {
      rows = await client<{ name: string }[]>`
        SELECT name FROM "uiliuili"."schema_migrations" ORDER BY name
      `;
    } catch {
      rows = [];
    }
    const applied = rows.map((row) => row.name);
    return {
      applied,
      pending: migrations
        .map((migration) => migration.name)
        .filter((name) => !applied.includes(name)),
    };
  } finally {
    await client.end({ timeout: 5 });
  }
}
