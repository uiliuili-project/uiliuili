import 'dotenv/config';
import path from 'node:path';

export const workerConfig = {
  databaseUrl: process.env.DATABASE_URL ?? '',
  appKey: process.env.APP_KEY ?? '',
  storageRoot: path.resolve(process.env.STORAGE_ROOT ?? './storage/uploads'),
  tempRoot: path.resolve(process.env.WORKER_TEMP_ROOT ?? './storage/tmp'),
  ffmpegPath: process.env.FFMPEG_PATH ?? 'ffmpeg',
  ffprobePath: process.env.FFPROBE_PATH ?? 'ffprobe',
  concurrency: Math.max(
    1,
    Number(process.env.WORKER_CONCURRENCY ?? process.env.TRANSCODE_CONCURRENCY ?? 1),
  ),
  pollIntervalMs: Math.max(250, Number(process.env.WORKER_POLL_INTERVAL_MS ?? 1500)),
  meilisearchUrl: process.env.MEILISEARCH_URL ?? '',
  meilisearchKey: process.env.MEILISEARCH_KEY ?? '',
};

if (!workerConfig.databaseUrl) {
  console.error('DATABASE_URL is required for the worker');
  process.exit(1);
}
if (!workerConfig.appKey) {
  console.error('APP_KEY is required for the worker');
  process.exit(1);
}
