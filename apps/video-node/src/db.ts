import fs from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';

export type NodeDb = ReturnType<typeof postgres>;

const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

export function createDb(url: string): NodeDb {
  return postgres(url, { max: 10, onnotice: () => undefined });
}

export async function migrate(client: NodeDb): Promise<string[]> {
  await client.unsafe(
    `CREATE TABLE IF NOT EXISTS "schema_migrations" (
       "name" text PRIMARY KEY NOT NULL,
       "applied_at" timestamp with time zone DEFAULT now() NOT NULL
     )`,
  );
  if (!fs.existsSync(MIGRATIONS_DIR)) return [];
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith('.sql'))
    .sort();
  const applied: string[] = [];
  for (const file of files) {
    const rows = await client`SELECT 1 FROM "schema_migrations" WHERE "name" = ${file} LIMIT 1`;
    if (rows.length > 0) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    await client.begin(async (tx) => {
      await tx.unsafe('SELECT pg_advisory_xact_lock(hashtext($1))', ['video-node:migrate']);
      for (const statement of sql
        .split('--> statement-breakpoint')
        .map((item) => item.trim())
        .filter(Boolean)) {
        await tx.unsafe(statement);
      }
      await tx`INSERT INTO "schema_migrations" ("name") VALUES (${file})`;
    });
    applied.push(file);
  }
  return applied;
}

export interface AssetRow {
  id: string;
  status: string;
  filename: string;
  content_type: string;
  size: string | number;
  source_key: string;
  hls_key: string | null;
  cover_key: string | null;
  duration_seconds: number;
  width: number;
  height: number;
  profile: string;
  constraints: Record<string, unknown>;
  metadata: Record<string, unknown>;
  progress: number;
  error: string | null;
  imported_from: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface UploadRow {
  id: string;
  asset_id: string;
  part_size: string | number;
  total_parts: number;
  status: string;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}

export interface OutputRow {
  quality: string;
  width: number;
  height: number;
  bitrate: number;
  playlist_key: string;
}

export function assetPayload(asset: AssetRow, outputs: OutputRow[]) {
  return {
    assetId: asset.id,
    status: asset.status,
    progress: asset.progress,
    error: asset.error,
    durationSeconds: asset.duration_seconds,
    width: asset.width,
    height: asset.height,
    size: Number(asset.size),
    createdAt: asset.created_at.toISOString(),
    updatedAt: asset.updated_at.toISOString(),
    renditions: outputs.map((output) => ({
      quality: output.quality,
      width: output.width,
      height: output.height,
      bitrate: output.bitrate,
    })),
  };
}
