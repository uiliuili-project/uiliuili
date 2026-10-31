import { buildApp } from './app';
import { createNodeAuth } from './auth';
import { nodeConfig, requireNodeConfig } from './config';
import { createDb, migrate } from './db';
import { NodeStorage } from './storage';
import { TranscodeQueue } from './transcode';

async function main(): Promise<void> {
  requireNodeConfig();
  const db = createDb(nodeConfig.databaseUrl);
  const applied = await migrate(db);
  if (applied.length > 0) {
    console.log(`[video-node] applied migrations: ${applied.join(', ')}`);
  }
  const storage = new NodeStorage(nodeConfig.storageRoot);
  await storage.ensureReady();
  const queue = new TranscodeQueue(db, storage);
  await queue.start();
  const auth = createNodeAuth(db);
  const app = buildApp({ db, storage, queue, auth });

  const cleanup = setInterval(
    () => {
      void db`DELETE FROM "request_nonces" WHERE "expires_at" < now()`.catch(() => undefined);
    },
    5 * 60 * 1000,
  );

  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    clearInterval(cleanup);
    queue.stop();
    await app.close().catch(() => undefined);
    await db.end({ timeout: 5 }).catch(() => undefined);
    process.exit(0);
  };
  process.once('SIGINT', () => void shutdown());
  process.once('SIGTERM', () => void shutdown());

  await app.listen({ port: nodeConfig.port, host: nodeConfig.host });
  app.log.info(
    `video node "${nodeConfig.nodeName}" (${nodeConfig.nodeId}) listening on ${nodeConfig.publicUrl}`,
  );
}

void main().catch((error) => {
  console.error('[video-node] failed to start', error);
  process.exit(1);
});
