import 'dotenv/config';
import path from 'node:path';

function bool(value: string | undefined, fallback = false): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function number(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function list(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export const nodeConfig = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: number(process.env.VIDEO_NODE_PORT, 3100),
  host: process.env.VIDEO_NODE_HOST ?? '0.0.0.0',
  /** Stable identifier shared with the site record. */
  nodeId: process.env.VIDEO_NODE_ID ?? 'video-node-1',
  nodeName: process.env.VIDEO_NODE_NAME ?? '视频节点 1',
  /** Public origin browsers and the site use to reach this node. */
  publicUrl: (process.env.VIDEO_NODE_PUBLIC_URL ?? 'http://localhost:3100').replace(/\/$/, ''),
  region: (process.env.VIDEO_NODE_REGION ?? '').trim().toUpperCase().slice(0, 8),
  regions: list(process.env.VIDEO_NODE_REGIONS).map((item) => item.toUpperCase().slice(0, 8)),
  databaseUrl: process.env.VIDEO_NODE_DATABASE_URL ?? '',
  /** HMAC secret shared with the site, hex or base64 string. */
  secret: process.env.VIDEO_NODE_SECRET ?? '',
  keyId: process.env.VIDEO_NODE_KEY_ID ?? 'default',
  storageRoot: path.resolve(process.env.VIDEO_NODE_STORAGE_ROOT ?? './storage/video-node'),
  storageCapacityBytes: number(process.env.VIDEO_NODE_STORAGE_CAPACITY_BYTES, 0),
  maxConcurrency: Math.max(1, number(process.env.VIDEO_NODE_TRANSCODE_CONCURRENCY, 2)),
  maxHeight: Math.max(144, number(process.env.VIDEO_NODE_MAX_HEIGHT, 1080)),
  maxDurationSeconds: Math.max(60, number(process.env.VIDEO_NODE_MAX_DURATION_SECONDS, 6 * 3600)),
  maxUploadBytes: number(process.env.VIDEO_NODE_MAX_UPLOAD_BYTES, 8 * 1024 * 1024 * 1024),
  partSizeBytes: Math.min(
    64 * 1024 * 1024,
    Math.max(8 * 1024 * 1024, number(process.env.VIDEO_NODE_PART_SIZE_BYTES, 16 * 1024 * 1024)),
  ),
  uploadTtlSeconds: Math.max(600, number(process.env.VIDEO_NODE_UPLOAD_TTL_SECONDS, 6 * 3600)),
  playbackTtlSeconds: Math.max(30, number(process.env.VIDEO_NODE_PLAYBACK_TTL_SECONDS, 300)),
  panelPassword: process.env.VIDEO_NODE_PANEL_PASSWORD ?? '',
  panelCookieSecret: process.env.VIDEO_NODE_PANEL_SECRET ?? '',
  replicaAllowedHosts: list(process.env.VIDEO_NODE_REPLICA_ALLOWED_HOSTS),
  ffmpegPath: process.env.FFMPEG_PATH ?? 'ffmpeg',
  ffprobePath: process.env.FFPROBE_PATH ?? 'ffprobe',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  trustProxy: bool(process.env.TRUST_PROXY),
};

export function requireNodeConfig(): void {
  if (!nodeConfig.databaseUrl) throw new Error('VIDEO_NODE_DATABASE_URL is required');
  if (!nodeConfig.secret) throw new Error('VIDEO_NODE_SECRET is required');
  if (!nodeConfig.panelCookieSecret) {
    nodeConfig.panelCookieSecret = nodeConfig.secret;
  }
}
