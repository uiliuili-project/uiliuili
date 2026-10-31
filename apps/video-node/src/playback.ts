import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { signToken, verifyToken } from '@uiliuili/video-node-contract';
import { nodeConfig } from './config';
import type { OutputRow } from './db';
import type { NodeStorage } from './storage';

export function signPlaybackToken(
  assetId: string,
  ttlSeconds: number,
  scope: 'playback' | 'replicate' = 'playback',
): {
  token: string;
  expiresAt: Date;
} {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  return {
    token: signToken(
      { scope, subject: assetId, expiresAt, nodeId: nodeConfig.nodeId },
      nodeConfig.secret,
    ),
    expiresAt: new Date(expiresAt * 1000),
  };
}

export function playbackPayload(assetId: string, token: string, outputs: OutputRow[]) {
  const base = `${nodeConfig.publicUrl}/p/${token}`;
  return {
    assetId,
    masterUrl: `${base}/master.m3u8`,
    renditions: outputs.map((output) => ({
      quality: output.quality,
      width: output.width,
      height: output.height,
      bitrate: output.bitrate,
      playlistUrl: `${base}/${output.playlist_key}`,
    })),
  };
}

export function resolvePlaybackToken(token: string): string | null {
  const payload = verifyToken(token, nodeConfig.secret, { nodeId: nodeConfig.nodeId });
  if (!payload) return null;
  if (payload.scope !== 'playback' && payload.scope !== 'replicate') return null;
  return payload.subject;
}

const CONTENT_TYPES: Record<string, string> = {
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
  '.m4s': 'video/iso.segment',
  '.mp4': 'video/mp4',
  '.aac': 'audio/aac',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.vtt': 'text/vtt',
};

export interface PlaybackFile {
  status: number;
  contentType: string;
  body: Buffer | fs.ReadStream;
  headers?: Record<string, string>;
}

function rewritePlaylist(text: string, token: string, requestedPath: string): string {
  const directory = path.posix.dirname(requestedPath);
  return `${text
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return line;
      if (/^https?:\/\//i.test(trimmed)) return line;
      const resolved = path.posix
        .normalize(trimmed.startsWith('/') ? trimmed.slice(1) : path.posix.join(directory, trimmed))
        .replace(/^\/+/, '');
      return `/p/${token}/${resolved}`;
    })
    .join('\n')}`;
}

/** Reads one HLS file belonging to an asset behind a playback token. */
export async function readPlaybackFile(
  storage: NodeStorage,
  token: string,
  hlsKey: string,
  requestedPath: string,
  range?: string,
): Promise<PlaybackFile | null> {
  const normalized = path.posix.normalize(decodeURIComponent(requestedPath)).replace(/^\/+/, '');
  if (!normalized || normalized.startsWith('..') || normalized.includes('/../')) return null;
  const key = `${hlsKey}/${normalized}`;
  let absolute: string;
  try {
    absolute = storage.resolve(key);
  } catch {
    return null;
  }
  let stat: fs.Stats;
  try {
    stat = await fsp.stat(absolute);
  } catch {
    return null;
  }
  if (!stat.isFile()) return null;
  const extension = path.extname(absolute).toLowerCase();
  const contentType = CONTENT_TYPES[extension] ?? 'application/octet-stream';
  if (extension === '.m3u8') {
    const text = await fsp.readFile(absolute, 'utf8');
    return {
      status: 200,
      contentType,
      body: Buffer.from(rewritePlaylist(text, token, normalized), 'utf8'),
      headers: { 'cache-control': 'private, max-age=30' },
    };
  }
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Number(match[2]) : stat.size - 1;
      if (Number.isFinite(start) && Number.isFinite(end) && start <= end && start < stat.size) {
        const safeEnd = Math.min(end, stat.size - 1);
        return {
          status: 206,
          contentType,
          body: fs.createReadStream(absolute, { start, end: safeEnd }),
          headers: {
            'content-range': `bytes ${start}-${safeEnd}/${stat.size}`,
            'accept-ranges': 'bytes',
            'content-length': String(safeEnd - start + 1),
            'cache-control': 'private, max-age=3600',
          },
        };
      }
    }
  }
  return {
    status: 200,
    contentType,
    body: fs.createReadStream(absolute),
    headers: {
      'content-length': String(stat.size),
      'accept-ranges': 'bytes',
      'cache-control': 'private, max-age=3600',
    },
  };
}
