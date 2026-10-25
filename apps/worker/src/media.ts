import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Db } from '@uiliuili/db';
import { siteSettings, videoParts, videoRenditions, videos } from '@uiliuili/db';
import {
  type StorageProvider,
  type TranscodeResult,
  probeVideo,
  transcodeToHls,
} from '@uiliuili/media';
import { and, asc, eq, isNull, ne } from 'drizzle-orm';
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
  partId?: string | null,
): Promise<void> {
  const rows = await db.select().from(videos).where(eq(videos.id, videoId)).limit(1);
  const video = rows[0];
  if (!video) throw new Error(`Video ${videoId} not found`);
  const part = partId
    ? (
        await db
          .select()
          .from(videoParts)
          .where(and(eq(videoParts.id, partId), eq(videoParts.videoId, videoId)))
          .limit(1)
      )[0]
    : undefined;
  if (partId && !part) throw new Error(`Video part ${partId} not found`);
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
    const uploadRows = await db
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.key, 'upload'))
      .limit(1);
    const uploadSettings = (uploadRows[0]?.value ?? {}) as {
      maxDurationSeconds?: number;
      maxResolution?: number;
    };
    if (
      uploadSettings.maxDurationSeconds &&
      probe.durationSeconds > uploadSettings.maxDurationSeconds
    ) {
      throw new Error(
        `视频时长超过限制（${probe.durationSeconds}s > ${uploadSettings.maxDurationSeconds}s）`,
      );
    }
    const maxHeight = Math.min(1080, Number(uploadSettings.maxResolution ?? 1080));
    const result = await transcodeToHls(sourcePath, outputDir, {
      ffmpegPath: workerConfig.ffmpegPath,
      ffprobePath: workerConfig.ffprobePath,
      maxHeight,
      onProgress: async (progress) => {
        await onProgress(Math.min(90, 8 + Math.round(progress.percent * 0.82)));
      },
    });

    const hlsPrefix = partId ? `videos/${videoId}/parts/${partId}/hls` : `videos/${videoId}/hls`;
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

    const coverKey = partId
      ? `covers/${videoId}/parts/${partId}.jpg`
      : `covers/${videoId}/cover.jpg`;
    await provider.putObject(coverKey, await fsp.readFile(result.coverPath), 'image/jpeg');
    const coverUrl = `/media/${coverKey
      .split('/')
      .map((part) => encodeURIComponent(part))
      .join('/')}`;

    await db.transaction(async (tx) => {
      await tx
        .delete(videoRenditions)
        .where(
          partId
            ? and(eq(videoRenditions.videoId, videoId), eq(videoRenditions.partId, partId))
            : and(eq(videoRenditions.videoId, videoId), isNull(videoRenditions.partId)),
        );
      for (const rendition of result.renditions) {
        await tx.insert(videoRenditions).values({
          videoId,
          partId: partId ?? null,
          quality: rendition.quality,
          width: rendition.width,
          height: rendition.height,
          bitrate: rendition.videoBitrate + rendition.audioBitrate,
          playlistKey: `${hlsPrefix}/${rendition.quality}/index.m3u8`,
        });
      }
      if (partId) {
        await tx
          .update(videoParts)
          .set({
            status: 'ready',
            durationSeconds: probe.durationSeconds,
            width: probe.width,
            height: probe.height,
            playlistKey: `${hlsPrefix}/master.m3u8`,
            spriteKey: result.spritePath ? `${hlsPrefix}/sprite.jpg` : null,
            previewVttKey: result.previewVttPath ? `${hlsPrefix}/preview.vtt` : null,
            updatedAt: new Date(),
          })
          .where(eq(videoParts.id, partId));
      }
      const firstPart = partId
        ? (
            await tx
              .select({ id: videoParts.id })
              .from(videoParts)
              .where(eq(videoParts.videoId, videoId))
              .orderBy(asc(videoParts.sort), asc(videoParts.createdAt))
              .limit(1)
          )[0]
        : undefined;
      const isPrimary = !partId || firstPart?.id === partId;
      if (isPrimary) {
        await tx
          .update(videos)
          .set({
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
      }
      if (!partId) {
        await tx
          .update(videos)
          .set({ status: video.publishedAt ? 'published' : 'ready' })
          .where(eq(videos.id, videoId));
      } else {
        const remaining = await tx
          .select({ id: videoParts.id })
          .from(videoParts)
          .where(and(eq(videoParts.videoId, videoId), ne(videoParts.status, 'ready')));
        if (remaining.length === 0) {
          await tx
            .update(videos)
            .set({ status: video.publishedAt ? 'published' : 'ready', updatedAt: new Date() })
            .where(eq(videos.id, videoId));
        }
      }
    });
    await onProgress(100);
  } finally {
    await fsp.rm(tempDir, { recursive: true, force: true });
  }
}
