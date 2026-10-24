import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LocalStorageProvider } from './local';

const roots: string[] = [];

function createProvider() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'uiliuili-media-'));
  roots.push(root);
  return new LocalStorageProvider({ root });
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe('LocalStorageProvider', () => {
  it('writes, reads, ranges, and deletes objects', async () => {
    const provider = createProvider();
    await provider.putObject('covers/1/test.txt', Buffer.from('abcdef'));
    expect((await provider.getBuffer('covers/1/test.txt')).toString()).toBe('abcdef');
    expect((await provider.headObject('covers/1/test.txt'))?.size).toBe(6);

    const range = await provider.readRange('covers/1/test.txt', 1, 3);
    const chunks: Buffer[] = [];
    for await (const chunk of range!.stream) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks).toString()).toBe('bcd');

    await provider.deleteObject('covers/1/test.txt');
    expect(await provider.headObject('covers/1/test.txt')).toBeNull();
  });

  it('assembles multipart uploads in order', async () => {
    const provider = createProvider();
    const init = await provider.initMultipart('videos/1/source.mp4', 'video/mp4');
    await provider.putPart('videos/1/source.mp4', init.uploadId, 2, Buffer.from('world'));
    await provider.putPart('videos/1/source.mp4', init.uploadId, 1, Buffer.from('hello '));
    await provider.completeMultipart('videos/1/source.mp4', init.uploadId, [
      { partNumber: 1, etag: '6' },
      { partNumber: 2, etag: '5' },
    ]);
    expect((await provider.getBuffer('videos/1/source.mp4')).toString()).toBe('hello world');
  });

  it('rejects path traversal', async () => {
    const provider = createProvider();
    await expect(provider.putObject('../escape.txt', Buffer.from('x'))).rejects.toThrow();
  });
});
