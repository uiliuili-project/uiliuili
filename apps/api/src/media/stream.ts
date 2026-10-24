import type { StorageProvider } from '@uiliuili/media';
import type { FastifyReply } from 'fastify';
import mime from 'mime-types';

export async function streamStorageObject(
  reply: FastifyReply,
  provider: StorageProvider,
  key: string,
  rangeHeader?: string,
  contentTypeOverride?: string,
): Promise<void> {
  const head = await provider.headObject(key);
  if (!head) {
    await reply.status(404).send('Not found');
    return;
  }
  const contentType =
    contentTypeOverride ?? head.contentType ?? (mime.lookup(key) || 'application/octet-stream');
  let start = 0;
  let end = head.size - 1;
  let status = 200;
  if (rangeHeader) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
    if (match) {
      if (match[1]) start = Number(match[1]);
      if (match[2]) end = Number(match[2]);
      if (Number.isFinite(start) && Number.isFinite(end) && start <= end) {
        status = 206;
      }
    }
  }
  const length = Math.max(0, end - start + 1);
  reply.header('Accept-Ranges', 'bytes');
  reply.header('Content-Type', String(contentType));
  reply.header('Content-Length', String(length));
  if (status === 206) {
    reply.header('Content-Range', `bytes ${start}-${end}/${head.size}`);
  }
  reply.status(status);
  if (head.size === 0) {
    await reply.send('');
    return;
  }
  const range = await provider.readRange(key, start, end);
  if (!range) {
    await reply.status(416).send('Range not satisfiable');
    return;
  }
  await reply.send(range.stream);
}
