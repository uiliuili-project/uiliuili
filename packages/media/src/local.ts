import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { CompletedPart, LocalStorageOptions, MultipartInit, StorageProvider } from './types';

function normalizeKey(key: string): string {
  const normalized = path.posix.normalize(key.replaceAll('\\', '/')).replace(/^\/+/, '');
  if (normalized.startsWith('../') || normalized.includes('/../') || normalized === '..') {
    throw new Error('Invalid storage key');
  }
  return normalized;
}

export class LocalStorageProvider implements StorageProvider {
  readonly driver = 'local' as const;
  private readonly root: string;
  private readonly publicBasePath: string;
  private readonly tempRoot: string;

  constructor(options: LocalStorageOptions) {
    this.root = path.resolve(options.root);
    this.publicBasePath = (options.publicBasePath ?? '/media').replace(/\/$/, '');
    this.tempRoot = path.join(this.root, '.multipart');
  }

  private resolve(key: string): string {
    return path.join(this.root, normalizeKey(key));
  }

  async ensureReady(): Promise<void> {
    await fsp.mkdir(this.root, { recursive: true });
    await fsp.mkdir(this.tempRoot, { recursive: true });
  }

  async putObject(key: string, body: Buffer | Readable, _contentType?: string): Promise<void> {
    const target = this.resolve(key);
    await fsp.mkdir(path.dirname(target), { recursive: true });
    if (Buffer.isBuffer(body)) {
      await fsp.writeFile(target, body);
      return;
    }
    await new Promise<void>((resolve, reject) => {
      const stream = fs.createWriteStream(target);
      body.pipe(stream);
      body.on('error', reject);
      stream.on('error', reject);
      stream.on('finish', () => resolve());
    });
  }

  async getObject(key: string): Promise<Readable> {
    return fs.createReadStream(this.resolve(key));
  }

  async getBuffer(key: string): Promise<Buffer> {
    return fsp.readFile(this.resolve(key));
  }

  async headObject(key: string): Promise<{ size: number; contentType: string | null } | null> {
    try {
      const stat = await fsp.stat(this.resolve(key));
      return { size: stat.size, contentType: null };
    } catch {
      return null;
    }
  }

  async deleteObject(key: string): Promise<void> {
    await fsp.rm(this.resolve(key), { force: true });
  }

  publicUrl(key: string): string | null {
    return `${this.publicBasePath}/${normalizeKey(key)}`;
  }

  async signedUrl(key: string, _expiresInSeconds: number): Promise<string> {
    return this.publicUrl(key) ?? '';
  }

  async readRange(
    key: string,
    start: number,
    end: number,
  ): Promise<{ stream: Readable; size: number; contentType: string | null } | null> {
    const target = this.resolve(key);
    let stat: fs.Stats;
    try {
      stat = await fsp.stat(target);
    } catch {
      return null;
    }
    if (start < 0 || end < start || start >= stat.size) return null;
    const safeEnd = Math.min(end, stat.size - 1);
    return {
      stream: fs.createReadStream(target, { start, end: safeEnd }),
      size: safeEnd - start + 1,
      contentType: null,
    };
  }

  async initMultipart(key: string, _contentType: string): Promise<MultipartInit> {
    await this.ensureReady();
    const uploadId = normalizeKey(key).replaceAll('/', '_');
    const dir = path.join(this.tempRoot, uploadId);
    await fsp.mkdir(dir, { recursive: true });
    return { uploadId, key };
  }

  async presignPart(
    _key: string,
    _uploadId: string | null,
    _partNumber: number,
    _expiresInSeconds: number,
  ): Promise<string | null> {
    return null;
  }

  async putPart(
    key: string,
    uploadId: string | null,
    partNumber: number,
    body: Buffer,
    _contentType?: string,
  ): Promise<CompletedPart> {
    if (!uploadId) throw new Error('Missing uploadId');
    const dir = path.join(this.tempRoot, uploadId);
    await fsp.mkdir(dir, { recursive: true });
    const partPath = path.join(dir, `${String(partNumber).padStart(8, '0')}.part`);
    await fsp.writeFile(partPath, body);
    return { partNumber, etag: `${body.length}` };
  }

  async completeMultipart(
    key: string,
    uploadId: string | null,
    parts: CompletedPart[],
  ): Promise<void> {
    if (!uploadId) throw new Error('Missing uploadId');
    const dir = path.join(this.tempRoot, uploadId);
    const target = this.resolve(key);
    await fsp.mkdir(path.dirname(target), { recursive: true });
    const output = fs.createWriteStream(target);
    try {
      for (const part of [...parts].sort((a, b) => a.partNumber - b.partNumber)) {
        const partPath = path.join(dir, `${String(part.partNumber).padStart(8, '0')}.part`);
        await pipeline(fs.createReadStream(partPath), output, { end: false });
      }
    } finally {
      output.end();
    }
    await new Promise<void>((resolve, reject) => {
      output.on('finish', resolve);
      output.on('error', reject);
    });
    await fsp.rm(dir, { recursive: true, force: true });
  }

  async abortMultipart(_key: string, uploadId: string | null): Promise<void> {
    if (!uploadId) return;
    await fsp.rm(path.join(this.tempRoot, uploadId), { recursive: true, force: true });
  }

  async test(): Promise<void> {
    await this.ensureReady();
    const key = `.healthcheck/${Date.now()}.txt`;
    await this.putObject(key, Buffer.from('ok'));
    const buffer = await this.getBuffer(key);
    await this.deleteObject(key);
    if (buffer.toString() !== 'ok') throw new Error('Local storage test failed');
  }
}
