import fs from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';

export interface MigrationFile {
  name: string;
  sql: string;
}

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

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
): Promise<void> {
  const client = postgres(connectionString, { max: 1, onnotice: () => undefined });
  try {
    await client.begin(async (tx) => {
      await tx.unsafe('SELECT pg_advisory_xact_lock(hashtext($1))', ['uiliuili:migrate']);
      for (const migration of migrations) {
        for (const statement of splitStatements(migration.sql)) {
          await tx.unsafe(statement);
        }
      }
    });
  } finally {
    await client.end({ timeout: 5 });
  }
}
