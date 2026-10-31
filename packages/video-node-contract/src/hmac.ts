import crypto from 'node:crypto';

/**
 * Header names shared by the site and every video node.
 *
 * The site signs every server-to-server request with the node secret; browsers
 * never see that secret and instead present a short-lived upload or playback
 * token issued by the node.
 */
export const NODE_HEADERS = {
  node: 'x-my-node',
  keyId: 'x-my-key-id',
  timestamp: 'x-my-timestamp',
  nonce: 'x-my-nonce',
  contentSha256: 'x-my-content-sha256',
  signature: 'x-my-signature',
  uploadToken: 'x-upload-token',
} as const;

export const NODE_SIGNATURE_VERSION = 'v1';

/** Requests dated further than this from the node clock are rejected. */
export const NODE_CLOCK_SKEW_SECONDS = 300;

/** Default lifetime of a browser upload token. */
export const NODE_UPLOAD_TOKEN_TTL_SECONDS = 6 * 60 * 60;

/** Default lifetime of a playback URL. */
export const NODE_PLAYBACK_TOKEN_TTL_SECONDS = 300;

export interface NodeRequestParts {
  method: string;
  /** Path only, without the query string, e.g. `/api/v1/node/assets`. */
  path: string;
  /** Raw query string without the leading `?`; empty when absent. */
  query?: string;
  timestamp: string | number;
  nonce: string;
  /** SHA-256 hex digest of the raw request body; empty body uses `''`. */
  bodySha256: string;
}

export interface NodeSignatureInput extends NodeRequestParts {
  nodeId: string;
  keyId: string;
  secret: string;
}

export function sha256Hex(body: string | Buffer | Uint8Array): string {
  return crypto.createHash('sha256').update(body).digest('hex');
}

/**
 * Canonical request string:
 *
 *   v1
 *   METHOD
 *   PATH
 *   QUERY
 *   TIMESTAMP
 *   NONCE
 *   BODY_SHA256
 *
 * Line breaks make ambiguous values impossible to splice together.
 */
export function canonicalRequest(parts: NodeRequestParts): string {
  return [
    NODE_SIGNATURE_VERSION,
    parts.method.toUpperCase(),
    parts.path,
    parts.query ?? '',
    String(parts.timestamp),
    parts.nonce,
    parts.bodySha256,
  ].join('\n');
}

export function signRequest(input: NodeSignatureInput): string {
  const canonical = [canonicalRequest(input), `node:${input.nodeId}`, `key:${input.keyId}`].join(
    '\n',
  );
  return crypto.createHmac('sha256', input.secret).update(canonical).digest('hex');
}

/** Constant-time comparison that tolerates malformed signatures. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function verifyRequest(input: NodeSignatureInput & { signature: string }): boolean {
  return safeEqual(signRequest(input), input.signature);
}

export function randomNonce(): string {
  return crypto.randomBytes(18).toString('base64url');
}

/** Computes the body digest header value for a request body. */
export function bodyDigest(body: string | Buffer | Uint8Array | null | undefined): string {
  if (body === null || body === undefined) return sha256Hex('');
  return sha256Hex(body);
}

export interface ScopedTokenPayload {
  /** Token purpose: browser upload, playback or replication. */
  scope: 'upload' | 'playback' | 'replicate';
  subject: string;
  expiresAt: number;
  /** Optional node id binding so a token cannot be replayed on another node. */
  nodeId?: string;
}

function base64url(value: Buffer | string): string {
  return Buffer.from(value).toString('base64url');
}

function fromBase64url(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

/** Signs a compact `payload.signature` token with the node secret. */
export function signToken(payload: ScopedTokenPayload, secret: string): string {
  const body = base64url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

export function verifyToken(
  token: string,
  secret: string,
  expected?: { scope?: ScopedTokenPayload['scope']; nodeId?: string; now?: number },
): ScopedTokenPayload | null {
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;
  const expectedSignature = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  if (!safeEqual(expectedSignature, signature)) return null;
  let payload: ScopedTokenPayload;
  try {
    payload = JSON.parse(fromBase64url(body).toString('utf8')) as ScopedTokenPayload;
  } catch {
    return null;
  }
  if (!payload || typeof payload.subject !== 'string' || typeof payload.expiresAt !== 'number') {
    return null;
  }
  const now = expected?.now ?? Math.floor(Date.now() / 1000);
  if (payload.expiresAt <= now) return null;
  if (expected?.scope && payload.scope !== expected.scope) return null;
  if (expected?.nodeId && payload.nodeId && payload.nodeId !== expected.nodeId) return null;
  return payload;
}
