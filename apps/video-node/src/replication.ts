import fsp from 'node:fs/promises';
import path from 'node:path';
import { nodeConfig } from './config';
import type { NodeStorage } from './storage';

export interface ImportedRendition {
  quality: string;
  width: number;
  height: number;
  bitrate: number;
  playlistKey: string;
}

export interface ImportResult {
  renditions: ImportedRendition[];
}

function allowedHost(url: URL): boolean {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
  return nodeConfig.replicaAllowedHosts.some((entry) => {
    const normalized = entry.toLowerCase();
    return normalized === host || normalized === url.host.toLowerCase();
  });
}

async function fetchWithLimit(url: string, maxBytes: number): Promise<Buffer> {
  const parsed = new URL(url);
  if (!allowedHost(parsed)) {
    throw new Error(`Replication source host is not allowed: ${parsed.host}`);
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(parsed, { signal: controller.signal, redirect: 'error' });
    if (!response.ok) throw new Error(`Source responded ${response.status} for ${parsed.pathname}`);
    const length = Number(response.headers.get('content-length') ?? 0);
    if (length > maxBytes) throw new Error(`Replication file is too large (${length} bytes)`);
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > maxBytes) {
      throw new Error(`Replication file is too large (${arrayBuffer.byteLength} bytes)`);
    }
    return Buffer.from(arrayBuffer);
  } finally {
    clearTimeout(timeout);
  }
}

/** Extracts the storage key from a signed playback URL, if present. */
function keyFor(url: string, currentKey: string, isPlaylist: boolean): string {
  const parsed = new URL(url);
  const parts = parsed.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const marker = parts.indexOf('p');
  if (marker >= 0 && parts.length > marker + 2) {
    return parts.slice(marker + 2).join('/');
  }
  const base = path.posix.basename(parts[parts.length - 1] ?? `file-${Date.now()}`);
  // A nested playlist keeps its own directory; segments live beside it.
  return path.posix.join(path.posix.dirname(currentKey), base);
}

function parseMaster(text: string, baseKey: string): ImportedRendition[] {
  const lines = text.split('\n');
  const renditions: ImportedRendition[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? '';
    if (!line.startsWith('#EXT-X-STREAM-INF')) continue;
    const resolution = /RESOLUTION=(\d+)x(\d+)/i.exec(line);
    const bandwidth = /BANDWIDTH=(\d+)/i.exec(line);
    const next = lines[index + 1]?.trim();
    if (!next || next.startsWith('#')) continue;
    const height = Number(resolution?.[2] ?? 0);
    const width = Number(resolution?.[1] ?? 0);
    const playlistKey = path.posix
      .normalize(path.posix.join(path.posix.dirname(baseKey), next))
      .replace(/^\/+/, '');
    renditions.push({
      quality: height > 0 ? `${height}p` : next.replace(/[^a-z0-9]+/gi, '-'),
      width,
      height,
      bitrate: Number(bandwidth?.[1] ?? 0),
      playlistKey,
    });
  }
  return renditions;
}

/**
 * Mirrors an HLS tree behind a signed replication grant into local storage.
 * Only whitelisted hosts are contacted, redirects are refused, and every file
 * is size-capped so a malicious source cannot exhaust the node.
 */
export async function importReplicaTree(
  storage: NodeStorage,
  assetId: string,
  sourceUrl: string,
): Promise<ImportResult> {
  const parsed = new URL(sourceUrl);
  if (!allowedHost(parsed)) {
    throw new Error(`Replication source host is not allowed: ${parsed.host}`);
  }
  const hlsDir = storage.resolve(`assets/${assetId}/hls`);
  await fsp.mkdir(hlsDir, { recursive: true });
  let fileCount = 0;
  let masterText = '';
  let masterRenditions: ImportedRendition[] = [];

  const visit = async (url: string, key: string, isRoot = false): Promise<void> => {
    fileCount += 1;
    if (fileCount > 20_000) throw new Error('Replication file count exceeded the limit');
    const body = await fetchWithLimit(url, 8 * 1024 * 1024 * 1024);
    const target = storage.resolve(`assets/${assetId}/hls/${key}`);
    await fsp.mkdir(path.dirname(target), { recursive: true });

    if (!key.endsWith('.m3u8')) {
      await fsp.writeFile(target, body);
      return;
    }

    const text = body.toString('utf8');
    if (isRoot) {
      masterText = text;
      masterRenditions = parseMaster(text, key);
    }
    const lines = text.split('\n');
    const rewritten: string[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        rewritten.push(line);
        continue;
      }
      const resolved = new URL(trimmed, url).toString();
      const childIsPlaylist = new URL(resolved).pathname.endsWith('.m3u8');
      const childKey = keyFor(resolved, key, childIsPlaylist);
      if (childIsPlaylist) await visit(resolved, childKey);
      else {
        fileCount += 1;
        if (fileCount > 20_000) throw new Error('Replication file count exceeded the limit');
        const data = await fetchWithLimit(resolved, 8 * 1024 * 1024 * 1024);
        const childTarget = storage.resolve(`assets/${assetId}/hls/${childKey}`);
        await fsp.mkdir(path.dirname(childTarget), { recursive: true });
        await fsp.writeFile(childTarget, data);
      }
      rewritten.push(path.posix.relative(path.posix.dirname(key), childKey));
    }
    await fsp.writeFile(target, rewritten.join('\n'), 'utf8');
  };

  await visit(sourceUrl, 'master.m3u8', true);
  if (!masterText) throw new Error('The replication source did not return a master playlist');
  return { renditions: masterRenditions };
}
