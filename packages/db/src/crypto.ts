import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

function keyFromHex(value: string): Buffer {
  const key = Buffer.from(value, 'hex');
  if (key.length !== 32) throw new Error('APP_KEY must be a 32-byte hex string');
  return key;
}

export function encryptSecret(value: unknown, appKey: string): string {
  const plaintext = JSON.stringify(value);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, keyFromHex(appKey), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

export function decryptSecret<T = unknown>(payload: string, appKey: string): T {
  if (!payload) return {} as T;
  const [version, ivPart, tagPart, dataPart] = payload.split(':');
  if (version !== 'v1' || !ivPart || !tagPart || !dataPart) {
    throw new Error('Invalid encrypted secret payload');
  }
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    keyFromHex(appKey),
    Buffer.from(ivPart, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataPart, 'base64url')),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString('utf8')) as T;
}

export function generateAppKey(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}
