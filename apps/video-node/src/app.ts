import crypto from 'node:crypto';
import {
  NODE_HEADERS,
  NODE_PLAYBACK_TOKEN_TTL_SECONDS,
  createAssetSchema,
  deleteAssetResponseSchema,
  playbackSignRequestSchema,
  replicationImportSchema,
  signToken,
  transcodeRequestSchema,
} from '@uiliuili/video-node-contract';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import { createNodeAuth } from './auth';
import { nodeConfig } from './config';
import { type AssetRow, type NodeDb, type OutputRow, assetPayload } from './db';
import { panelPage } from './panel';
import {
  playbackPayload,
  readPlaybackFile,
  resolvePlaybackToken,
  signPlaybackToken,
} from './playback';
import { importReplicaTree } from './replication';
import { NodeStorage } from './storage';
import { TranscodeQueue, extensionOf } from './transcode';

export interface AppContext {
  db: NodeDb;
  storage: NodeStorage;
  queue: TranscodeQueue;
  auth: ReturnType<typeof createNodeAuth>;
}

function payload<T>(request: FastifyRequest): T {
  return (request.body ?? {}) as T;
}

async function outputsFor(db: NodeDb, assetId: string): Promise<OutputRow[]> {
  return db<OutputRow[]>`
    SELECT "quality", "width", "height", "bitrate", "playlist_key"
    FROM "transcode_outputs" WHERE "asset_id" = ${assetId}
    ORDER BY "height" DESC
  `;
}

async function getAsset(db: NodeDb, assetId: string): Promise<AssetRow | null> {
  const [row] = await db<AssetRow[]>`SELECT * FROM "assets" WHERE "id" = ${assetId} LIMIT 1`;
  return row ?? null;
}

function audit(
  db: NodeDb,
  action: string,
  target: string,
  detail: Record<string, unknown>,
): Promise<unknown> {
  return db`
    INSERT INTO "audit_logs" ("action", "actor", "target", "detail")
    VALUES (${action}, 'site', ${target}, ${db.json(detail as never)})
  `;
}

function parseJsonBody<T>(request: FastifyRequest, schema: { parse(value: unknown): T }): T {
  const body = request.body;
  const source = Buffer.isBuffer(body)
    ? JSON.parse(body.length > 0 ? body.toString('utf8') : '{}')
    : (body ?? {});
  return schema.parse(source);
}

function sendError(reply: FastifyReply, status: number, code: string, message: string) {
  return reply.code(status).send({ error: { code, message } });
}

export function buildApp(context: AppContext): FastifyInstance {
  const { db, storage, queue, auth } = context;
  const app = Fastify({
    logger: nodeConfig.logLevel !== 'silent' ? { level: nodeConfig.logLevel } : false,
    bodyLimit: Math.max(nodeConfig.partSizeBytes + 1024 * 1024, 64 * 1024 * 1024),
    trustProxy: nodeConfig.trustProxy,
  });

  // Preserve the exact bytes so HMAC signatures can be verified even though
  // Fastify hands routes a parsed object.
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (request, body, done) => {
    request.rawBody = body as Buffer;
    if (!body || (body as Buffer).length === 0) return done(null, {});
    try {
      done(null, JSON.parse((body as Buffer).toString('utf8')));
    } catch (error) {
      done(error as Error);
    }
  });
  app.addContentTypeParser(
    'application/octet-stream',
    { parseAs: 'buffer' },
    (request, body, done) => {
      request.rawBody = body as Buffer;
      done(null, body);
    },
  );

  app.addHook('onRequest', async (request, reply) => {
    reply.header('access-control-allow-origin', request.headers.origin ?? '*');
    reply.header('vary', 'origin');
    reply.header('access-control-allow-credentials', 'true');
    reply.header(
      'access-control-allow-headers',
      `content-type, range, ${NODE_HEADERS.uploadToken}`,
    );
    reply.header('access-control-allow-methods', 'GET, HEAD, POST, PUT, DELETE, OPTIONS');
    reply.header('access-control-expose-headers', 'content-length, content-range, accept-ranges');
    if (request.method === 'OPTIONS') {
      await reply.code(204).send();
    }
  });

  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof Error && 'issues' in error) {
      return sendError(reply, 400, 'BAD_REQUEST', error.message);
    }
    const status = (error as { statusCode?: number }).statusCode ?? 500;
    if (status >= 500) app.log.error(error);
    return sendError(
      reply,
      status,
      status >= 500 ? 'INTERNAL_ERROR' : 'BAD_REQUEST',
      error.message || 'Request failed',
    );
  });

  app.get('/health', async () => ({
    ok: true,
    nodeId: nodeConfig.nodeId,
    uptimeSeconds: Math.round(process.uptime()),
  }));

  app.get('/api/v1/node/info', { preHandler: auth.verify }, async () => {
    const [usedBytes, pending] = await Promise.all([storage.usageBytes(), queue.pendingCount()]);
    return {
      id: nodeConfig.nodeId,
      name: nodeConfig.nodeName,
      version: '0.1.0',
      region: nodeConfig.region,
      regions:
        nodeConfig.regions.length > 0 ? nodeConfig.regions : [nodeConfig.region].filter(Boolean),
      publicUrl: nodeConfig.publicUrl,
      status: 'online',
      storage: { usedBytes, capacityBytes: nodeConfig.storageCapacityBytes },
      queue: {
        active: queue.activeCount,
        maxConcurrency: nodeConfig.maxConcurrency,
        pending,
      },
    };
  });

  app.post('/api/v1/node/assets', { preHandler: auth.verify }, async (request, reply) => {
    const input = createAssetSchema.parse(request.body ?? {});
    if (input.size > nodeConfig.maxUploadBytes) {
      return sendError(reply, 413, 'PAYLOAD_TOO_LARGE', 'Upload exceeds the node size limit');
    }
    if (nodeConfig.storageCapacityBytes > 0) {
      const used = await storage.usageBytes();
      if (used + input.size > nodeConfig.storageCapacityBytes) {
        return sendError(reply, 507, 'CAPACITY_EXCEEDED', 'Node storage is full');
      }
    }
    const assetId = crypto.randomUUID();
    const extension = extensionOf(input.filename);
    const partSize = input.partSize ?? nodeConfig.partSizeBytes;
    const totalParts = Math.max(1, Math.ceil(input.size / partSize));
    if (totalParts > 100_000) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Too many upload parts');
    }
    await db`
      INSERT INTO "assets"
        ("id", "status", "filename", "content_type", "size", "source_key", "profile", "constraints", "metadata")
      VALUES (
        ${assetId}, 'uploading', ${input.filename}, ${input.contentType}, ${input.size},
        ${`assets/${assetId}/source${extension ? `.${extension}` : ''}`},
        ${input.profile}, ${db.json(input.constraints as never)}, ${db.json(input.metadata as never)}
      )
    `;
    const expiresAt = new Date(Date.now() + nodeConfig.uploadTtlSeconds * 1000);
    const [upload] = await db<{ id: string }[]>`
      INSERT INTO "upload_sessions" ("asset_id", "part_size", "total_parts", "expires_at")
      VALUES (${assetId}, ${partSize}, ${totalParts}, ${expiresAt})
      RETURNING "id"
    `;
    if (!upload) return sendError(reply, 500, 'INTERNAL_ERROR', 'Failed to create upload');
    const uploadToken = signToken(
      {
        scope: 'upload',
        subject: upload.id,
        expiresAt: Math.floor(expiresAt.getTime() / 1000),
        nodeId: nodeConfig.nodeId,
      },
      nodeConfig.secret,
    );
    await audit(db, 'asset.create', assetId, { size: input.size, profile: input.profile });
    return {
      assetId,
      uploadId: upload.id,
      partSize,
      totalParts,
      expiresAt: expiresAt.toISOString(),
      uploadToken,
      publicUrl: nodeConfig.publicUrl,
    };
  });

  async function authorizeUpload(
    request: FastifyRequest,
    reply: FastifyReply,
    uploadId: string,
  ): Promise<boolean> {
    if (auth.verifyUploadToken(request, uploadId)) return true;
    try {
      await auth.verify(request, reply);
      return Boolean(request.nodeAuth);
    } catch {
      return false;
    }
  }

  app.put('/api/v1/node/uploads/:uploadId/parts/:partNumber', async (request, reply) => {
    const { uploadId } = request.params as { uploadId: string; partNumber: string };
    if (!(await authorizeUpload(request, reply, uploadId))) {
      if (!reply.sent) return sendError(reply, 401, 'UNAUTHORIZED', 'Invalid upload token');
      return reply;
    }
    const [session] = await db<
      Array<{
        asset_id: string;
        part_size: string | number;
        total_parts: number;
        status: string;
        expires_at: Date;
      }>
    >`SELECT * FROM "upload_sessions" WHERE "id" = ${uploadId} LIMIT 1`;
    if (!session) return sendError(reply, 404, 'NOT_FOUND', 'Upload session not found');
    if (session.status !== 'uploading') {
      return sendError(reply, 409, 'CONFLICT', 'Upload session is not open');
    }
    if (new Date(session.expires_at).getTime() <= Date.now()) {
      return sendError(reply, 409, 'CONFLICT', 'Upload session expired');
    }
    const partNumber = Number((request.params as { partNumber: string }).partNumber);
    if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > session.total_parts) {
      return sendError(reply, 400, 'BAD_REQUEST', 'Invalid part number');
    }
    const body = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
    if (body.length === 0) return sendError(reply, 400, 'BAD_REQUEST', 'Empty part');
    if (body.length > Number(session.part_size)) {
      return sendError(reply, 413, 'PAYLOAD_TOO_LARGE', 'Part exceeds the agreed part size');
    }
    const etag = await storage.writePart(uploadId, partNumber, body);
    await db`
        INSERT INTO "uploaded_parts" ("upload_id", "part_number", "size", "etag")
        VALUES (${uploadId}, ${partNumber}, ${body.length}, ${etag})
        ON CONFLICT ("upload_id", "part_number")
        DO UPDATE SET "size" = ${body.length}, "etag" = ${etag}
      `;
    await db`UPDATE "upload_sessions" SET "updated_at" = now() WHERE "id" = ${uploadId}`;
    return { partNumber, etag };
  });

  app.post('/api/v1/node/uploads/:uploadId/complete', async (request, reply) => {
    const { uploadId } = request.params as { uploadId: string };
    if (!(await authorizeUpload(request, reply, uploadId))) {
      if (!reply.sent) return sendError(reply, 401, 'UNAUTHORIZED', 'Invalid upload token');
      return reply;
    }
    const [session] = await db<
      Array<{ asset_id: string; total_parts: number; status: string }>
    >`SELECT * FROM "upload_sessions" WHERE "id" = ${uploadId} LIMIT 1`;
    if (!session) return sendError(reply, 404, 'NOT_FOUND', 'Upload session not found');
    if (session.status !== 'uploading') {
      return sendError(reply, 409, 'CONFLICT', 'Upload session is not open');
    }
    const parts = await db<Array<{ part_number: number; size: number }>>`
      SELECT "part_number", "size" FROM "uploaded_parts" WHERE "upload_id" = ${uploadId}
      ORDER BY "part_number"
    `;
    if (parts.length !== session.total_parts) {
      return sendError(
        reply,
        400,
        'BAD_REQUEST',
        `Missing upload parts (${parts.length}/${session.total_parts})`,
      );
    }
    const asset = await getAsset(db, session.asset_id);
    if (!asset) return sendError(reply, 404, 'NOT_FOUND', 'Asset not found');
    const totalSize = parts.reduce((sum, part) => sum + Number(part.size), 0);
    if (totalSize !== Number(asset.size)) {
      await storage.removeUpload(uploadId).catch(() => undefined);
      return sendError(
        reply,
        400,
        'BAD_REQUEST',
        `Uploaded size ${totalSize} does not match the declared size ${asset.size}`,
      );
    }
    const extension = extensionOf(asset.filename);
    const sourceKey = await storage.assemble(uploadId, asset.id, extension);
    await storage.removeUpload(uploadId);
    await db`
      UPDATE "upload_sessions" SET "status" = 'completed', "updated_at" = now() WHERE "id" = ${uploadId}
    `;
    await db`
      UPDATE "assets" SET "source_key" = ${sourceKey}, "status" = 'uploaded', "size" = ${totalSize},
        "updated_at" = now()
      WHERE "id" = ${asset.id}
    `;
    await queue.enqueue(
      asset.id,
      asset.profile,
      (asset.constraints ?? {}) as Record<string, number>,
    );
    await audit(db, 'upload.complete', asset.id, { uploadId, size: totalSize });
    return { assetId: asset.id, status: 'transcoding' };
  });

  app.get('/api/v1/node/assets/:id', { preHandler: auth.verify }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const asset = await getAsset(db, id);
    if (!asset) return sendError(reply, 404, 'NOT_FOUND', 'Asset not found');
    const outputs = await outputsFor(db, id);
    return assetPayload(asset, outputs);
  });

  app.post(
    '/api/v1/node/assets/:id/transcode',
    { preHandler: auth.verify },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const asset = await getAsset(db, id);
      if (!asset) return sendError(reply, 404, 'NOT_FOUND', 'Asset not found');
      const input = transcodeRequestSchema.parse(request.body ?? {});
      if (asset.status === 'transcoding') {
        return { assetId: id, status: 'transcoding' };
      }
      await db`
        UPDATE "assets" SET "status" = 'uploaded', "error" = NULL, "updated_at" = now()
        WHERE "id" = ${id}
      `;
      await queue.enqueue(id, input.profile, input.constraints as Record<string, number>);
      return { assetId: id, status: 'transcoding' };
    },
  );

  app.post(
    '/api/v1/node/assets/:id/replication-grant',
    { preHandler: auth.verify },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const asset = await getAsset(db, id);
      if (!asset || asset.status !== 'ready' || !asset.hls_key) {
        return sendError(reply, 409, 'CONFLICT', 'Asset is not ready for replication');
      }
      const { token, expiresAt } = signPlaybackToken(id, 30 * 60, 'replicate');
      await audit(db, 'replication.grant', id, {});
      return {
        sourceUrl: `${nodeConfig.publicUrl}/p/${token}/master.m3u8`,
        expiresAt: expiresAt.toISOString(),
      };
    },
  );

  app.post('/api/v1/node/replicas/import', { preHandler: auth.verify }, async (request, reply) => {
    const input = replicationImportSchema.parse(request.body ?? {});
    const assetId = crypto.randomUUID();
    await db`
      INSERT INTO "assets"
        ("id", "status", "filename", "content_type", "size", "source_key", "hls_key",
         "profile", "metadata", "imported_from", "progress",
         "duration_seconds", "width", "height")
      VALUES (
        ${assetId}, 'transcoding', ${`replica-${assetId}.m3u8`}, 'application/vnd.apple.mpegurl',
        0, '', ${`assets/${assetId}/hls`}, ${input.profile},
        ${db.json(input.metadata as never)}, ${input.sourceUrl}, 10,
        ${input.durationSeconds}, ${input.width}, ${input.height}
      )
    `;
    try {
      const result = await importReplicaTree(storage, assetId, input.sourceUrl);
      for (const rendition of result.renditions) {
        await db`
          INSERT INTO "transcode_outputs"
            ("asset_id", "quality", "width", "height", "bitrate", "playlist_key")
          VALUES (
            ${assetId}, ${rendition.quality}, ${rendition.width}, ${rendition.height},
            ${rendition.bitrate}, ${rendition.playlistKey}
          )
        `;
      }
      const largest = result.renditions.reduce(
        (best, item) => (item.height > (best?.height ?? 0) ? item : best),
        result.renditions[0],
      );
      await db`
        UPDATE "assets" SET "status" = 'ready', "progress" = 100,
          "width" = ${largest?.width ?? 0}, "height" = ${largest?.height ?? 0},
          "updated_at" = now()
        WHERE "id" = ${assetId}
      `;
      await audit(db, 'replication.import', assetId, { source: input.sourceUrl });
      return { assetId, status: 'ready' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await db`
        UPDATE "assets" SET "status" = 'failed', "error" = ${message.slice(0, 1000)}, "updated_at" = now()
        WHERE "id" = ${assetId}
      `;
      return sendError(reply, 502, 'BAD_REQUEST', message);
    }
  });

  app.post('/api/v1/node/playback/sign', { preHandler: auth.verify }, async (request, reply) => {
    const input = playbackSignRequestSchema.parse(request.body ?? {});
    const asset = await getAsset(db, input.assetId);
    if (!asset) return sendError(reply, 404, 'NOT_FOUND', 'Asset not found');
    if (asset.status !== 'ready' || !asset.hls_key) {
      return sendError(reply, 409, 'CONFLICT', 'Asset is not ready for playback');
    }
    const outputs = await outputsFor(db, input.assetId);
    const { token, expiresAt } = signPlaybackToken(
      input.assetId,
      input.ttlSeconds || NODE_PLAYBACK_TOKEN_TTL_SECONDS,
    );
    const signed = playbackPayload(input.assetId, token, outputs);
    return {
      ...signed,
      expiresAt: expiresAt.toISOString(),
    };
  });

  app.delete('/api/v1/node/assets/:id', { preHandler: auth.verify }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const asset = await getAsset(db, id);
    if (!asset) return sendError(reply, 404, 'NOT_FOUND', 'Asset not found');
    await db`DELETE FROM "assets" WHERE "id" = ${id}`;
    await storage.removeAsset(id).catch(() => undefined);
    await audit(db, 'asset.delete', id, {});
    return deleteAssetResponseSchema.parse({ ok: true });
  });

  app.get('/p/:token/*', async (request, reply) => {
    const { token } = request.params as { token: string };
    const requestedPath = (request.params as Record<string, string>)['*'] ?? '';
    const assetId = resolveAssetFromToken(token);
    if (!assetId) return sendError(reply, 401, 'UNAUTHORIZED', 'Invalid playback token');
    const asset = await getAsset(db, assetId);
    if (!asset || asset.status !== 'ready' || !asset.hls_key) {
      return sendError(reply, 404, 'NOT_FOUND', 'Asset not found');
    }
    const file = await readPlaybackFile(
      storage,
      token,
      asset.hls_key,
      requestedPath,
      request.headers.range,
    );
    if (!file) return sendError(reply, 404, 'NOT_FOUND', 'File not found');
    for (const [name, value] of Object.entries(file.headers ?? {})) reply.header(name, value);
    reply.code(file.status).type(file.contentType);
    return reply.send(file.body);
  });

  // Panel ---------------------------------------------------------------------
  app.get('/panel', async (request, reply) => {
    if (!nodeConfig.panelPassword) {
      return reply.code(404).type('text/plain').send('Panel is disabled');
    }
    const cookieHeader = request.headers.cookie ?? '';
    const cookie = cookieHeader
      .split(';')
      .map((item) => item.trim())
      .find((item) => item.startsWith('vn_panel='))
      ?.slice('vn_panel='.length);
    if (!auth.verifyPanelCookie(cookie)) return reply.type('text/html').send(panelPage.login());
    const assets = await db<AssetRow[]>`
      SELECT * FROM "assets" ORDER BY "created_at" DESC LIMIT 100
    `;
    const usedBytes = await storage.usageBytes();
    return reply
      .type('text/html')
      .send(panelPage.dashboard(nodeConfig.nodeName, assets, usedBytes, nodeConfig));
  });

  app.post('/panel/login', async (request, reply) => {
    const body = (request.body ?? {}) as { password?: string };
    if (!nodeConfig.panelPassword || body.password !== nodeConfig.panelPassword) {
      return reply.code(401).type('text/html').send(panelPage.login('密码错误'));
    }
    reply.header(
      'set-cookie',
      `vn_panel=${auth.issuePanelCookie()}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800`,
    );
    return reply.redirect('/panel');
  });

  app.post('/panel/logout', async (_request, reply) => {
    reply.header('set-cookie', 'vn_panel=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
    return reply.redirect('/panel');
  });

  return app;
}

function resolveAssetFromToken(token: string): string | null {
  return resolvePlaybackToken(token);
}
