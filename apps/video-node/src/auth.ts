import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  NODE_CLOCK_SKEW_SECONDS,
  NODE_HEADERS,
  bodyDigest,
  verifyRequest,
  verifyToken,
} from '@uiliuili/video-node-contract';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { nodeConfig } from './config';
import type { NodeDb } from './db';

declare module 'fastify' {
  interface FastifyRequest {
    rawBody?: Buffer;
    nodeAuth?: { keyId: string };
  }
}

export interface NodeAuth {
  verify(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  verifyUploadToken(request: FastifyRequest, uploadId: string): boolean;
  issuePanelCookie(): string;
  verifyPanelCookie(value: string | undefined): boolean;
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export function createNodeAuth(db: NodeDb): NodeAuth {
  async function verify(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const nodeId = request.headers[NODE_HEADERS.node];
    const keyId = request.headers[NODE_HEADERS.keyId];
    const timestamp = request.headers[NODE_HEADERS.timestamp];
    const nonce = request.headers[NODE_HEADERS.nonce];
    const signature = request.headers[NODE_HEADERS.signature];
    const contentSha = request.headers[NODE_HEADERS.contentSha256];
    if (
      typeof nodeId !== 'string' ||
      typeof keyId !== 'string' ||
      typeof timestamp !== 'string' ||
      typeof nonce !== 'string' ||
      typeof signature !== 'string'
    ) {
      await reply
        .code(401)
        .send({ error: { code: 'UNAUTHORIZED', message: 'Missing signature headers' } });
      return;
    }
    if (nodeId !== nodeConfig.nodeId || keyId !== nodeConfig.keyId) {
      await reply
        .code(401)
        .send({ error: { code: 'UNAUTHORIZED', message: 'Unknown node or key id' } });
      return;
    }
    const issued = Number(timestamp);
    const now = Math.floor(Date.now() / 1000);
    if (!Number.isFinite(issued) || Math.abs(now - issued) > NODE_CLOCK_SKEW_SECONDS) {
      await reply
        .code(401)
        .send({ error: { code: 'UNAUTHORIZED', message: 'Request timestamp is out of range' } });
      return;
    }
    const raw = request.rawBody ?? Buffer.alloc(0);
    const digest = bodyDigest(raw);
    if (typeof contentSha === 'string' && !safeEqual(contentSha, digest)) {
      await reply
        .code(401)
        .send({ error: { code: 'UNAUTHORIZED', message: 'Body digest mismatch' } });
      return;
    }
    const url = request.raw.url ?? '';
    const question = url.indexOf('?');
    const requestPath = question >= 0 ? url.slice(0, question) : url;
    const query = question >= 0 ? url.slice(question + 1) : '';
    const valid = verifyRequest({
      method: request.method,
      path: requestPath,
      query,
      timestamp,
      nonce,
      bodySha256: digest,
      nodeId,
      keyId,
      secret: nodeConfig.secret,
      signature,
    });
    if (!valid) {
      await reply.code(401).send({ error: { code: 'UNAUTHORIZED', message: 'Invalid signature' } });
      return;
    }
    try {
      await db`
        INSERT INTO "request_nonces" ("nonce", "key_id", "expires_at")
        VALUES (${nonce}, ${keyId}, ${new Date(Date.now() + (NODE_CLOCK_SKEW_SECONDS + 60) * 1000)})
      `;
    } catch {
      await reply
        .code(401)
        .send({ error: { code: 'UNAUTHORIZED', message: 'Replayed request nonce' } });
      return;
    }
    request.nodeAuth = { keyId };
  }

  return {
    verify,
    verifyUploadToken(request, uploadId) {
      const token = request.headers[NODE_HEADERS.uploadToken];
      const header = Array.isArray(token) ? token[0] : token;
      const queryToken =
        typeof request.query === 'object' && request.query
          ? (request.query as Record<string, unknown>).token
          : undefined;
      const candidate = header ?? (typeof queryToken === 'string' ? queryToken : '');
      if (!candidate) return false;
      const payload = verifyToken(candidate, nodeConfig.secret, {
        scope: 'upload',
        nodeId: nodeConfig.nodeId,
      });
      return Boolean(payload && payload.subject === uploadId);
    },
    issuePanelCookie() {
      const expires = Math.floor(Date.now() / 1000) + 8 * 3600;
      const signature = createHmac('sha256', nodeConfig.panelCookieSecret)
        .update(`panel:${expires}`)
        .digest('base64url');
      return `${expires}.${signature}`;
    },
    verifyPanelCookie(value) {
      if (!value) return false;
      const [expires, signature] = value.split('.');
      if (!expires || !signature) return false;
      const expected = createHmac('sha256', nodeConfig.panelCookieSecret)
        .update(`panel:${expires}`)
        .digest('base64url');
      if (!safeEqual(expected, signature)) return false;
      return Number(expires) > Math.floor(Date.now() / 1000);
    },
  };
}
