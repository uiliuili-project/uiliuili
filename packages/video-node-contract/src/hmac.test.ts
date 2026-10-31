import { describe, expect, it } from 'vitest';
import {
  NODE_CLOCK_SKEW_SECONDS,
  NODE_HEADERS,
  bodyDigest,
  canonicalRequest,
  randomNonce,
  signRequest,
  signToken,
  verifyRequest,
  verifyToken,
} from './hmac';

const secret = 'test-secret';
const nodeId = 'node-1';
const keyId = 'default';

function parts(overrides: Partial<Parameters<typeof canonicalRequest>[0]> = {}) {
  return {
    method: 'POST',
    path: '/api/v1/node/assets',
    query: '',
    timestamp: '1700000000',
    nonce: 'nonce-1',
    bodySha256: bodyDigest('{"size":1}'),
    ...overrides,
  };
}

describe('canonicalRequest', () => {
  it('puts every field on its own line', () => {
    expect(canonicalRequest(parts())).toBe(
      [
        'v1',
        'POST',
        '/api/v1/node/assets',
        '',
        '1700000000',
        'nonce-1',
        bodyDigest('{"size":1}'),
      ].join('\n'),
    );
  });

  it('normalizes the method', () => {
    expect(canonicalRequest(parts({ method: 'post' }))).toContain('\nPOST\n');
  });
});

describe('signRequest', () => {
  it('accepts a matching signature', () => {
    const requestParts = parts();
    const signature = signRequest({ ...requestParts, nodeId, keyId, secret });
    expect(verifyRequest({ ...requestParts, nodeId, keyId, secret, signature })).toBe(true);
  });

  it('rejects a tampered body digest', () => {
    const requestParts = parts();
    const signature = signRequest({ ...requestParts, nodeId, keyId, secret });
    expect(
      verifyRequest({
        ...requestParts,
        bodySha256: bodyDigest('{"size":2}'),
        nodeId,
        keyId,
        secret,
        signature,
      }),
    ).toBe(false);
  });

  it('rejects a different node or key id', () => {
    const requestParts = parts();
    const signature = signRequest({ ...requestParts, nodeId, keyId, secret });
    expect(verifyRequest({ ...requestParts, nodeId: 'node-2', keyId, secret, signature })).toBe(
      false,
    );
    expect(verifyRequest({ ...requestParts, nodeId, keyId: 'other', secret, signature })).toBe(
      false,
    );
  });

  it('rejects a different secret', () => {
    const requestParts = parts();
    const signature = signRequest({ ...requestParts, nodeId, keyId, secret });
    expect(verifyRequest({ ...requestParts, nodeId, keyId, secret: 'other', signature })).toBe(
      false,
    );
  });
});

describe('bodyDigest', () => {
  it('hashes an empty body', () => {
    expect(bodyDigest(undefined)).toBe(bodyDigest(''));
    expect(bodyDigest(null)).toBe(bodyDigest(Buffer.alloc(0)));
  });
});

describe('scoped tokens', () => {
  const now = 1_700_000_000;

  it('round-trips a playback token', () => {
    const token = signToken(
      { scope: 'playback', subject: 'asset-1', expiresAt: now + 300, nodeId },
      secret,
    );
    expect(verifyToken(token, secret, { scope: 'playback', nodeId, now })).toMatchObject({
      subject: 'asset-1',
      scope: 'playback',
    });
  });

  it('rejects expired tokens', () => {
    const token = signToken(
      { scope: 'upload', subject: 'upload-1', expiresAt: now - 1, nodeId },
      secret,
    );
    expect(verifyToken(token, secret, { now })).toBeNull();
  });

  it('rejects the wrong scope and node', () => {
    const token = signToken(
      { scope: 'upload', subject: 'upload-1', expiresAt: now + 60, nodeId },
      secret,
    );
    expect(verifyToken(token, secret, { scope: 'playback', now })).toBeNull();
    expect(verifyToken(token, secret, { nodeId: 'node-2', now })).toBeNull();
  });

  it('rejects a tampered payload', () => {
    const token = signToken(
      { scope: 'playback', subject: 'asset-1', expiresAt: now + 300, nodeId },
      secret,
    );
    const [body, signature] = token.split('.');
    const forged = Buffer.from(
      JSON.stringify({ scope: 'playback', subject: 'asset-2', expiresAt: now + 300, nodeId }),
    ).toString('base64url');
    expect(verifyToken(`${forged}.${signature}`, secret, { now })).toBeNull();
    expect(verifyToken(`${body}.${signature}x`, secret, { now })).toBeNull();
  });
});

describe('defaults', () => {
  it('keeps a short clock skew window', () => {
    expect(NODE_CLOCK_SKEW_SECONDS).toBeLessThanOrEqual(600);
  });

  it('uses header names that survive proxies', () => {
    expect(NODE_HEADERS.signature).toMatch(/^x-/);
    expect(NODE_HEADERS.uploadToken).toMatch(/^x-/);
  });

  it('generates unique nonces', () => {
    expect(randomNonce()).not.toBe(randomNonce());
  });
});
