import { csrfHeader } from './api';

/** Response of `POST /api/v1/studio/videos/:id/upload`. */
export interface UploadSession {
  mode: 'local' | 's3' | 'remote';
  uploadId: string;
  storageKey?: string;
  partSize: number;
  totalChunks: number;
  parts?: Array<{ partNumber: number; url: string | null }>;
  nodeId?: string;
  nodeName?: string;
  nodeBaseUrl?: string;
  remoteUploadId?: string;
  uploadToken?: string;
  expiresAt?: string;
}

interface PutOptions {
  headers?: Record<string, string>;
  withCredentials?: boolean;
  signal?: AbortSignal;
  onProgress?: (loaded: number) => void;
}

function readError(xhr: XMLHttpRequest): string | null {
  try {
    const body = JSON.parse(xhr.responseText) as { error?: { message?: string } };
    return body?.error?.message || null;
  } catch {
    return null;
  }
}

function putChunk(url: string, chunk: Blob, options: PutOptions): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.withCredentials = Boolean(options.withCredentials);
    for (const [name, value] of Object.entries(options.headers ?? {})) {
      xhr.setRequestHeader(name, value);
    }
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) options.onProgress?.(event.loaded);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(xhr.getResponseHeader('ETag'));
        return;
      }
      reject(new Error(readError(xhr) ?? `HTTP ${xhr.status}`));
    };
    xhr.onerror = () => reject(new Error('Network error'));
    xhr.onabort = () => reject(new DOMException('Upload aborted', 'AbortError'));
    options.signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(chunk);
  });
}

function chunkTarget(
  session: UploadSession,
  index: number,
): { url: string; headers: Record<string, string>; withCredentials: boolean } {
  const partNumber = index + 1;
  if (session.mode === 'local') {
    return {
      url: `/api/v1/studio/uploads/${session.uploadId}/parts/${partNumber}`,
      headers: { 'Content-Type': 'application/octet-stream', ...csrfHeader() },
      withCredentials: true,
    };
  }
  if (session.mode === 'remote') {
    return {
      url: `${session.nodeBaseUrl}/api/v1/node/uploads/${encodeURIComponent(
        session.remoteUploadId ?? '',
      )}/parts/${partNumber}`,
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-Upload-Token': session.uploadToken ?? '',
      },
      withCredentials: false,
    };
  }
  const url = session.parts?.[index]?.url;
  if (!url) throw new Error('MISSING_PART_URL');
  return { url, headers: {}, withCredentials: false };
}

/**
 * Sends every part of a video and reports cumulative progress, including the
 * bytes of the part currently in flight. S3 parts return their ETag so the
 * caller can finish the multipart upload.
 */
export async function uploadVideoParts(
  session: UploadSession,
  file: File,
  options: {
    signal?: AbortSignal;
    onProgress?: (loaded: number, total: number) => void;
  } = {},
): Promise<Array<{ partNumber: number; etag: string }>> {
  const uploaded: Array<{ partNumber: number; etag: string }> = [];
  const total = file.size;
  for (let index = 0; index < session.totalChunks; index += 1) {
    if (options.signal?.aborted) throw new DOMException('Upload aborted', 'AbortError');
    const start = index * session.partSize;
    const end = Math.min(file.size, start + session.partSize);
    const target = chunkTarget(session, index);
    const base = start;
    const etag = await putChunk(target.url, file.slice(start, end), {
      headers: target.headers,
      withCredentials: target.withCredentials,
      signal: options.signal,
      onProgress: (loaded) => options.onProgress?.(Math.min(total, base + loaded), total),
    });
    if (session.mode === 's3') {
      uploaded.push({ partNumber: index + 1, etag: etag ?? '' });
    }
    options.onProgress?.(end, total);
  }
  return uploaded;
}
