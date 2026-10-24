import fs from 'node:fs';
import os from 'node:os';
import { createDb } from '@uiliuili/db';
import { workerConfig } from './config';
import {
  claimJob,
  completeJob,
  currentJobId,
  failJob,
  processJob,
  scheduleRecurringJobs,
} from './jobs';

const logger = {
  info: (message: string) => console.log(`${new Date().toISOString()} [worker] ${message}`),
  warn: (message: string) => console.warn(`${new Date().toISOString()} [worker] ${message}`),
  error: (message: string, error?: unknown) =>
    console.error(`${new Date().toISOString()} [worker] ${message}`, error ?? ''),
};

async function main(): Promise<void> {
  fs.mkdirSync(workerConfig.tempRoot, { recursive: true });
  const { client, db } = createDb(workerConfig.databaseUrl, {
    max: 5,
    onNotice: () => undefined,
  });
  const workerId = `${os.hostname()}:${process.pid}:${Math.random().toString(36).slice(2, 8)}`;
  let running = true;
  let active = 0;

  process.on('SIGINT', () => {
    running = false;
    logger.info(`Stopping after current job ${currentJobId() ?? ''}`);
  });
  process.on('SIGTERM', () => {
    running = false;
    logger.info(`Stopping after current job ${currentJobId() ?? ''}`);
  });

  logger.info(`Started ${workerId} with concurrency ${workerConfig.concurrency}`);
  await scheduleRecurringJobs(db).catch((error) => logger.error('Failed to schedule jobs', error));

  while (running) {
    if (active >= workerConfig.concurrency) {
      await sleep(workerConfig.pollIntervalMs);
      continue;
    }
    let job: Awaited<ReturnType<typeof claimJob>> = null;
    try {
      job = await claimJob(db, workerId);
    } catch (error) {
      logger.error('Failed to claim job', error);
      await sleep(workerConfig.pollIntervalMs * 2);
      continue;
    }
    if (!job) {
      await sleep(workerConfig.pollIntervalMs);
      continue;
    }
    active += 1;
    logger.info(`Running ${job.queue} job ${job.id} (attempt ${job.attempts}/${job.maxAttempts})`);
    void (async () => {
      try {
        const result = await processJob(db, job);
        await completeJob(db, job, result);
        logger.info(`Completed ${job.queue} job ${job.id}`);
      } catch (error) {
        await failJob(db, job, error);
        logger.error(`Job ${job.queue}:${job.id} failed`, error);
      } finally {
        active -= 1;
      }
    })();
  }

  while (active > 0) await sleep(500);
  await client.end({ timeout: 5 });
  logger.info('Worker stopped');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

void main().catch((error) => {
  logger.error('Worker crashed', error);
  process.exit(1);
});
