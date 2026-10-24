import { Injectable } from '@nestjs/common';
import { backgroundJobs } from '@uiliuili/db';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { DatabaseService } from './database.service';

export interface EnqueueOptions {
  priority?: number;
  delaySeconds?: number;
  maxAttempts?: number;
  idempotencyKey?: string;
}

@Injectable()
export class QueueService {
  constructor(private readonly database: DatabaseService) {}

  async enqueue<T extends Record<string, unknown>>(
    queue: string,
    payload: T,
    options: EnqueueOptions = {},
  ): Promise<string> {
    const runAt = new Date(Date.now() + (options.delaySeconds ?? 0) * 1000);
    const rows = await this.database.db
      .insert(backgroundJobs)
      .values({
        queue,
        payload,
        priority: options.priority ?? 0,
        runAt,
        maxAttempts: options.maxAttempts ?? 3,
        idempotencyKey: options.idempotencyKey ?? null,
      })
      .onConflictDoNothing()
      .returning({ id: backgroundJobs.id });
    if (rows[0]?.id) return rows[0].id;
    const existing = await this.database.db
      .select({ id: backgroundJobs.id })
      .from(backgroundJobs)
      .where(eq(backgroundJobs.idempotencyKey, options.idempotencyKey ?? ''))
      .limit(1);
    return existing[0]?.id ?? '';
  }

  async stats() {
    const rows = await this.database.db.execute<{
      queue: string;
      status: string;
      count: number;
    }>(sql`
      SELECT queue, status, COUNT(*)::int AS count
      FROM "uiliuili"."background_jobs"
      GROUP BY queue, status
    `);
    return rows;
  }

  async retry(id: string): Promise<void> {
    await this.database.db
      .update(backgroundJobs)
      .set({
        status: 'created',
        runAt: new Date(),
        lockedAt: null,
        lockedBy: null,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(
        and(eq(backgroundJobs.id, id), inArray(backgroundJobs.status, ['failed', 'cancelled'])),
      );
  }

  async cancel(id: string): Promise<void> {
    await this.database.db
      .update(backgroundJobs)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(inArray(backgroundJobs.status, ['created', 'retry']));
  }
}
