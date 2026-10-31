import fsp from 'node:fs/promises';
import path from 'node:path';
import { probeVideo, transcodeToHls } from '@uiliuili/media';
import { NODE_TRANSCODE_PROFILES, type TranscodeConstraints } from '@uiliuili/video-node-contract';
import { nodeConfig } from './config';
import type { NodeDb } from './db';
import type { NodeStorage } from './storage';

interface JobRow {
  id: string;
  asset_id: string;
  profile: string;
  constraints: TranscodeConstraints;
}

const PROFILE_HEIGHTS: Record<string, number> = {
  '1080p': 1080,
  '720p': 720,
  '480p': 480,
};

export class TranscodeQueue {
  private timer: NodeJS.Timeout | null = null;
  private active = new Set<string>();
  private ticking = false;

  constructor(
    private readonly db: NodeDb,
    private readonly storage: NodeStorage,
  ) {}

  async start(): Promise<void> {
    await this.db`
      UPDATE "transcode_jobs" SET "status" = 'pending', "updated_at" = now()
      WHERE "status" = 'running'
    `;
    await this.db`
      UPDATE "assets" SET "status" = 'uploaded', "updated_at" = now()
      WHERE "status" = 'transcoding'
    `;
    this.timer = setInterval(() => void this.tick(), 1000);
    void this.tick();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  get activeCount(): number {
    return this.active.size;
  }

  async pendingCount(): Promise<number> {
    const [row] = await this.db<{ count: number }[]>`
      SELECT COUNT(*)::int AS count FROM "transcode_jobs" WHERE "status" IN ('pending', 'running')
    `;
    return Number(row?.count ?? 0);
  }

  async enqueue(
    assetId: string,
    profile: string,
    constraints: TranscodeConstraints,
  ): Promise<void> {
    await this.db`
      INSERT INTO "transcode_jobs" ("asset_id", "profile", "constraints")
      VALUES (${assetId}, ${profile}, ${this.db.json(constraints as never)})
    `;
    void this.tick();
  }

  private async tick(): Promise<void> {
    if (this.ticking) return;
    this.ticking = true;
    try {
      while (this.active.size < nodeConfig.maxConcurrency) {
        const [job] = await this.db<JobRow[]>`
          UPDATE "transcode_jobs" SET "status" = 'running', "started_at" = now(), "updated_at" = now()
          WHERE "id" = (
            SELECT "id" FROM "transcode_jobs"
            WHERE "status" = 'pending'
            ORDER BY "created_at"
            LIMIT 1
            FOR UPDATE SKIP LOCKED
          )
          RETURNING "id", "asset_id", "profile", "constraints"
        `;
        if (!job) break;
        this.active.add(job.id);
        void this.run(job).finally(() => this.active.delete(job.id));
      }
    } finally {
      this.ticking = false;
    }
  }

  private async run(job: JobRow): Promise<void> {
    const [asset] = await this.db<
      Array<{ source_key: string; size: string | number; hls_key: string | null }>
    >`SELECT "source_key", "size", "hls_key" FROM "assets" WHERE "id" = ${job.asset_id} LIMIT 1`;
    if (!asset) {
      await this.failJob(job.id, job.asset_id, 'Asset disappeared before transcode');
      return;
    }
    const sourcePath = this.storage.resolve(asset.source_key);
    const outputDir = this.storage.resolve(`assets/${job.asset_id}/hls`);
    try {
      await this.db`
        UPDATE "assets" SET "status" = 'transcoding', "progress" = 0, "error" = NULL, "updated_at" = now()
        WHERE "id" = ${job.asset_id}
      `;
      const constraints = job.constraints ?? {};
      const probe = await probeVideo(sourcePath, {
        ffmpegPath: nodeConfig.ffmpegPath,
        ffprobePath: nodeConfig.ffprobePath,
      });
      const maxDuration = Math.min(
        nodeConfig.maxDurationSeconds,
        constraints.maxDurationSeconds ?? nodeConfig.maxDurationSeconds,
      );
      if (probe.durationSeconds > maxDuration) {
        throw new Error(
          `Video duration ${probe.durationSeconds}s exceeds the node limit of ${maxDuration}s`,
        );
      }
      const profileHeight =
        job.profile !== 'auto' ? (PROFILE_HEIGHTS[job.profile] ?? nodeConfig.maxHeight) : undefined;
      const maxHeight = Math.min(
        nodeConfig.maxHeight,
        profileHeight ?? nodeConfig.maxHeight,
        constraints.maxHeight ?? nodeConfig.maxHeight,
      );
      let lastProgress = -1;
      const result = await transcodeToHls(sourcePath, outputDir, {
        ffmpegPath: nodeConfig.ffmpegPath,
        ffprobePath: nodeConfig.ffprobePath,
        maxHeight,
        onProgress: (progress) => {
          const rounded = Math.round(progress.percent);
          if (rounded === lastProgress) return;
          lastProgress = rounded;
          void this.db`
            UPDATE "transcode_jobs" SET "progress" = ${rounded}, "updated_at" = now()
            WHERE "id" = ${job.id}
          `;
          void this.db`
            UPDATE "assets" SET "progress" = ${rounded}, "updated_at" = now()
            WHERE "id" = ${job.asset_id}
          `;
        },
      });

      await this.db`DELETE FROM "transcode_outputs" WHERE "asset_id" = ${job.asset_id}`;
      for (const rendition of result.renditions) {
        const relative = path
          .relative(this.storage.resolve(`assets/${job.asset_id}/hls`), rendition.playlist)
          .split(path.sep)
          .join('/');
        await this.db`
          INSERT INTO "transcode_outputs"
            ("asset_id", "job_id", "quality", "width", "height", "bitrate", "playlist_key")
          VALUES (
            ${job.asset_id}, ${job.id}, ${rendition.quality}, ${rendition.width},
            ${rendition.height}, ${rendition.videoBitrate + rendition.audioBitrate}, ${relative}
          )
        `;
      }
      const largest = result.renditions.reduce(
        (best, item) => (item.height > (best?.height ?? 0) ? item : best),
        result.renditions[0],
      );
      await this.db`
        UPDATE "assets" SET
          "status" = 'ready',
          "progress" = 100,
          "hls_key" = ${`assets/${job.asset_id}/hls`},
          "cover_key" = ${`assets/${job.asset_id}/hls/cover.jpg`},
          "duration_seconds" = ${result.durationSeconds},
          "width" = ${largest?.width ?? 0},
          "height" = ${largest?.height ?? 0},
          "error" = NULL,
          "updated_at" = now()
        WHERE "id" = ${job.asset_id}
      `;
      await this.db`
        UPDATE "transcode_jobs" SET "status" = 'done', "progress" = 100, "finished_at" = now(), "updated_at" = now()
        WHERE "id" = ${job.id}
      `;
      await this.audit('transcode.complete', job.asset_id, {
        profile: job.profile,
        renditions: result.renditions.map((item) => item.quality),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.failJob(job.id, job.asset_id, message);
    } finally {
      await fsp.rm(this.storage.resolve(`assets/${job.asset_id}/source.tmp`), { force: true });
    }
  }

  private async failJob(jobId: string, assetId: string, message: string): Promise<void> {
    await this.db`
      UPDATE "assets" SET "status" = 'failed', "error" = ${message.slice(0, 1000)}, "updated_at" = now()
      WHERE "id" = ${assetId}
    `;
    await this.db`
      UPDATE "transcode_jobs" SET "status" = 'failed', "error" = ${message.slice(0, 1000)},
        "finished_at" = now(), "updated_at" = now()
      WHERE "id" = ${jobId}
    `;
    await this.audit('transcode.failed', assetId, { error: message.slice(0, 1000) });
  }

  private async audit(action: string, target: string, detail: Record<string, unknown>) {
    await this.db`
      INSERT INTO "audit_logs" ("action", "actor", "target", "detail")
      VALUES (${action}, 'transcoder', ${target}, ${this.db.json(detail as never)})
    `;
  }
}

export function extensionOf(filename: string): string {
  return path.extname(filename).replace('.', '').toLowerCase().slice(0, 12);
}

export function isProfile(value: string): boolean {
  return (NODE_TRANSCODE_PROFILES as readonly string[]).includes(value);
}
