import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Db } from '@uiliuili/db';
import { videoRenditions, videoSubtitles, videos } from '@uiliuili/db';
import {
  type StorageProvider,
  type TranscodeResult,
  probeVideo,
  transcodeToHls,
} from '@uiliuili/media';
import { eq } from 'drizzle-orm';
import { workerConfig } from './config';
import { getStorage } from './storage';

async function walk(directory: string): Promise<string[]> {
  const entries = await fsp.readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

async function download(provider: StorageProvider, key: string, target: string): Promise<void> {
  await fsp.mkdir(path.dirname(target), { recursive: true });
  const stream = await provider.getObject(key);
  await pipeline(stream, fs.createWriteStream(target));
}

export async function transcodeVideo(
  db: Db,
  videoId: string,
  sourceKey: string,
  jobId: string,
  onProgress: (progress: number) => Promise<void>,
): Promise<void> {
  const rows = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
  const video = rows[0];
  if (!video) throw new Error(`Video ${videoId} not found`);
  const provider = await getStorage(db);
  const tempDir = path.join(workerConfig.tempRoot, jobId);
  const extension = path.extname(sourceKey) || '.mp4';
  const sourcePath = path.join(tempDir, `source${extension}`);
  const outputDir = path.join(tempDir, 'hls');
  await fsp.mkdir(tempDir, { recursive: true });

  try {
    await onProgress(3);
    await download(provider, sourceKey, sourcePath);
    await onProgress(8);
    const probe = await probeVideo(sourcePath, {
      ffmpegPath: workerConfig.ffmpegPath,
      ffprobePath: workerConfig.ffprobePath,
    });
    const result = await transcodeToHls(sourcePath, outputDir, {
      ffmpegPath: workerConfig.ffmpegPath,
      ffprobePath: workerConfig.ffprobePath,
      maxHeight: 1080,
      onProgress: async (progress) => {
        await onProgress(Math.min(90, 8 + Math.round(progress.percent * 0.82)));
      },
    });

    const hlsPrefix = `videos/${videoId}/hls`;
    const files = await walk(outputDir);
    for (const file of files) {
      const relative = path.relative(outputDir, file).split(path.sep).join('/');
      const key = `${hlsPrefix}/${relative}`;
      const contentType = relative.endsWith('.m3u8')
        ? 'application/vnd.apple.mpegurl'
        : relative.endsWith('.ts')
          ? 'video/mp2t'
          : relative.endsWith('.vtt')
            ? 'text/vtt'
            : relative.endsWith('.jpg')
              ? 'image/jpeg'
              : 'application/octet-stream';
      await provider.putObject(key, await fsp.readFile(file), contentType);
    }

    const coverKey = `covers/${videoId}/cover.jpg`;
    await provider.putObject(coverKey, await fsp.readFile(result.coverPath), 'image/jpeg');
    const coverUrl = `/media/${coverKey
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/')}`;

    await db.transaction(async (tx) => {
      await tx.delete(videoRenditions).where(eq(videoRenditions.videoId, videoId));
      for (const rendition of result.renditions) {
        await tx.insert(videoRenditions).values({
          videoId,
          quality: rendition.quality,
          width: rendition.width,
          height: rendition.height,
          bitrate: rendition.videoBitrate + rendition.audioBitrate,
          playlistKey: `${hlsPrefix}/${rendition.quality}/index.m3u8`,
        });
      }
      await tx
        .update(videos)
        .set({
          status: 'ready',
          durationSeconds: probe.durationSeconds,
          width: probe.width,
          height: probe.height,
          playlistKey: `${hlsPrefix}/master.m3u8`,
          coverUrl: video.coverUrl || coverUrl,
          spriteKey: result.spritePath ? `${hlsPrefix}/sprite.jpg` : null,
          previewVttKey: result.previewVttPath ? `${hlsPrefix}/preview.vtt` : null,
          updatedAt: new Date(),
        })
        .where(eq(videos.id, videoId));
    });
    await onProgress(100);
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}

export async function cleanupStaleSubtitles(_db: Db): Promise<void> {
  // Placeholder for future subtitle cleanup hooks.
}
