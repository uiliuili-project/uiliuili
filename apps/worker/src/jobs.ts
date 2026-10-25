import {
  type Db,
  backgroundJobs,
  grantDailyCoins,
  siteSettings,
  videoParts,
  videos,
} from '@uiliuili/db';
import { and, desc, eq, inArray, lte, sql } from 'drizzle-orm';
import { runCleanup } from './cleanup';
import { transcodeVideo } from './media';
import { notifyFollowersOfNewVideo } from './notifications';
import { rebuildSimilarities } from './recommend';
import { indexVideo, reindexAll } from './search';

export type Job = typeof backgroundJobs.$inferSelect;

let activeJobId: string | null = null;

export async function claimJob(db: Db, workerId: string): Promise<Job | null> {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(backgroundJobs)
      .where(
        and(
          inArray(backgroundJobs.status, ['created', 'retry']),
          lte(backgroundJobs.runAt, new Date()),
        ),
      )
      .orderBy(desc(backgroundJobs.priority), backgroundJobs.runAt)
      .limit(1)
      .for('update', { skipLocked: true });
    const job = rows[0];
    if (!job) return null;
    const updated = await tx
      .update(backgroundJobs)
      .set({
        status: 'active',
        lockedAt: new Date(),
        lockedBy: workerId,
        attempts: sql`${backgroundJobs.attempts} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(backgroundJobs.id, job.id))
      .returning();
    return updated[0] ?? null;
  });
}

export async function completeJob(db: Db, job: Job, result?: unknown): Promise<void> {
  await db
    .update(backgroundJobs)
    .set({
      status: 'completed',
      progress: 100,
      result: result ?? null,
      lockedAt: null,
      lockedBy: null,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(backgroundJobs.id, job.id));
}

export async function failJob(db: Db, job: Job, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  const shouldRetry = job.attempts < job.maxAttempts;
  const delaySeconds = Math.min(3600, job.attempts ** 2 * 30);
  await db
    .update(backgroundJobs)
    .set({
      status: shouldRetry ? 'retry' : 'failed',
      lastError: message.slice(0, 4000),
      runAt: shouldRetry ? new Date(Date.now() + delaySeconds * 1000) : job.runAt,
      lockedAt: null,
      lockedBy: null,
      updatedAt: new Date(),
    })
    .where(eq(backgroundJobs.id, job.id));
}

async function updateProgress(db: Db, jobId: string, progress: number): Promise<void> {
  await db
    .update(backgroundJobs)
    .set({ progress: Math.max(0, Math.min(100, Math.round(progress))), updatedAt: new Date() })
    .where(eq(backgroundJobs.id, jobId));
}

export async function processJob(db: Db, job: Job): Promise<unknown> {
  activeJobId = job.id;
  try {
    const payload = (job.payload ?? {}) as Record<string, unknown>;
    switch (job.queue) {
      case 'transcode': {
        const videoId = String(payload.videoId ?? '');
        const sourceKey = String(payload.sourceKey ?? '');
        const partId = payload.partId ? String(payload.partId) : null;
        if (!videoId || !sourceKey) throw new Error('Invalid transcode payload');
        try {
          await transcodeVideo(
            db,
            videoId,
            sourceKey,
            job.id,
            async (progress) => {
              await updateProgress(db, job.id, progress);
            },
            partId,
          );
        } catch (error) {
          if (partId) {
            await db
              .update(videoParts)
              .set({ status: 'failed', updatedAt: new Date() })
              .where(eq(videoParts.id, partId));
          }
          await db
            .update(videos)
            .set({ status: 'failed', updatedAt: new Date() })
            .where(eq(videos.id, videoId));
          throw error;
        }
        await enqueue(
          db,
          'search-index',
          { videoId },
          { idempotencyKey: `search:${videoId}:${Date.now()}` },
        );
        return { videoId };
      }
      case 'search-index': {
        if (payload.all) {
          const indexed = await reindexAll(db);
          return { indexed };
        }
        const videoId = String(payload.videoId ?? '');
        if (videoId) await indexVideo(db, videoId);
        return { videoId };
      }
      case 'recommend': {
        await rebuildSimilarities(db);
        return { ok: true };
      }
      case 'cleanup': {
        await runCleanup(db);
        return { ok: true };
      }
      case 'daily-coins': {
        const rows = await db
          .select()
          .from(siteSettings)
          .where(eq(siteSettings.key, 'social'))
          .limit(1);
        const social = (rows[0]?.value ?? {}) as { dailyCoins?: number };
        await grantDailyCoins(db, Number(social.dailyCoins ?? 2));
        return { ok: true };
      }
      case 'notify-followers': {
        await notifyFollowersOfNewVideo(db, String(payload.videoId ?? ''));
        return { ok: true };
      }
      default:
        throw new Error(`Unknown queue: ${job.queue}`);
    }
  } finally {
    activeJobId = null;
  }
}

export function currentJobId(): string | null {
  return activeJobId;
}

export async function enqueue(
  db: Db,
  queue: string,
  payload: Record<string, unknown>,
  options: { idempotencyKey?: string; delaySeconds?: number; maxAttempts?: number } = {},
): Promise<void> {
  await db
    .insert(backgroundJobs)
    .values({
      queue,
      payload,
      idempotencyKey: options.idempotencyKey ?? null,
      runAt: new Date(Date.now() + (options.delaySeconds ?? 0) * 1000),
      maxAttempts: options.maxAttempts ?? 3,
    })
    .onConflictDoNothing();
}

export async function scheduleRecurringJobs(db: Db): Promise<void> {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const hour = now.toISOString().slice(0, 13);
  await enqueue(db, 'daily-coins', {}, { idempotencyKey: `daily-coins:${date}` });
  await enqueue(db, 'cleanup', {}, { idempotencyKey: `cleanup:${hour}` });
  await enqueue(db, 'recommend', {}, { idempotencyKey: `recommend:${date}`, maxAttempts: 1 });
}
