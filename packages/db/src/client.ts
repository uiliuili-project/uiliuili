import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export interface CreateDbOptions {
  max?: number;
  onNotice?: (notice: postgres.Notice) => void;
}

export function createDb(url: string, options: CreateDbOptions = {}) {
  const client = postgres(url, {
    max: options.max ?? 10,
    onnotice: options.onNotice ?? (() => undefined),
  });
  const db = drizzle(client, { schema, casing: 'snake_case' });
  return { client, db };
}

export type Db = ReturnType<typeof createDb>['db'];
export type DbClient = ReturnType<typeof createDb>['client'];
