import { NODE_HEADERS, bodyDigest, randomNonce, signRequest } from '@uiliuili/video-node-contract';

export interface NodeCredentials {
  id: string;
  baseUrl: string;
  keyId: string;
  secret: string;
}

export class VideoNodeHttpError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'VideoNodeHttpError';
    this.status = status;
    this.code = code;
  }
}

/**
 * Minimal server-to-server client. Every request is signed with HMAC-SHA256;
 * the secret never leaves the API process.
 */
export class VideoNodeClient {
  constructor(private readonly node: NodeCredentials) {}

  private url(path: string, query?: Record<string, string | number | undefined>): string {
    const base = this.node.baseUrl.replace(/\/$/, '');
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== '') params.set(key, String(value));
    }
    const queryString = params.toString();
    return `${base}${path}${queryString ? `?${queryString}` : ''}`;
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
    options: {
      query?: Record<string, string | number | undefined>;
      timeoutMs?: number;
      rawBody?: Buffer;
    } = {},
  ): Promise<T> {
    const raw =
      options.rawBody ?? (body === undefined ? Buffer.alloc(0) : Buffer.from(JSON.stringify(body)));
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = randomNonce();
    const digest = bodyDigest(raw);
    const query = options.query
      ? new URLSearchParams(
          Object.entries(options.query)
            .filter(([, value]) => value !== undefined && value !== '')
            .map(([key, value]) => [key, String(value)]),
        ).toString()
      : '';
    const signature = signRequest({
      method,
      path,
      query,
      timestamp,
      nonce,
      bodySha256: digest,
      nodeId: this.node.id,
      keyId: this.node.keyId,
      secret: this.node.secret,
    });
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 15_000);
    try {
      const response = await fetch(this.url(path, options.query), {
        method,
        headers: {
          [NODE_HEADERS.node]: this.node.id,
          [NODE_HEADERS.keyId]: this.node.keyId,
          [NODE_HEADERS.timestamp]: timestamp,
          [NODE_HEADERS.nonce]: nonce,
          [NODE_HEADERS.contentSha256]: digest,
          [NODE_HEADERS.signature]: signature,
          ...(raw.length > 0 ? { 'content-type': 'application/json' } : {}),
        },
        body: raw.length > 0 ? new Uint8Array(raw) : undefined,
        signal: controller.signal,
      });
      const text = await response.text();
      let payload: unknown = null;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        payload = null;
      }
      if (!response.ok) {
        const error = (payload as { error?: { code?: string; message?: string } } | null)?.error;
        throw new VideoNodeHttpError(
          response.status,
          error?.code ?? 'NODE_ERROR',
          error?.message ?? `Video node responded ${response.status}`,
        );
      }
      return payload as T;
    } catch (error) {
      if (error instanceof VideoNodeHttpError) throw error;
      if ((error as Error).name === 'AbortError') {
        throw new VideoNodeHttpError(504, 'NODE_TIMEOUT', '视频节点响应超时');
      }
      throw new VideoNodeHttpError(
        502,
        'NODE_UNREACHABLE',
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
