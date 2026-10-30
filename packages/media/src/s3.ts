import { Readable } from 'node:stream';
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { CompletedPart, MultipartInit, S3StorageOptions, StorageProvider } from './types';

function joinKey(prefix: string | undefined, key: string): string {
  const normalized = key.replace(/^\/+/, '');
  if (!prefix) return normalized;
  return `${prefix.replace(/^\/+|\/+$/g, '')}/${normalized}`;
}

export class S3StorageProvider implements StorageProvider {
  readonly driver = 's3' as const;
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;
  private readonly prefix: string;

  constructor(options: S3StorageOptions) {
    this.bucket = options.bucket;
    this.prefix = options.prefix ?? '';
    this.publicBaseUrl = (options.publicBaseUrl ?? '').replace(/\/$/, '');
    this.client = new S3Client({
      region: options.region,
      endpoint: options.endpoint || undefined,
      forcePathStyle: options.forcePathStyle ?? false,
      credentials: {
        accessKeyId: options.accessKeyId,
        secretAccessKey: options.secretAccessKey,
      },
    });
  }

  async putObject(key: string, body: Buffer | Readable, contentType?: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: joinKey(this.prefix, key),
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async getObject(key: string): Promise<Readable> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: joinKey(this.prefix, key) }),
    );
    return result.Body as Readable;
  }

  async getBuffer(key: string): Promise<Buffer> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: joinKey(this.prefix, key) }),
    );
    const bytes = await result.Body?.transformToByteArray();
    return Buffer.from(bytes ?? new Uint8Array());
  }

  async headObject(key: string): Promise<{ size: number; contentType: string | null } | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: joinKey(this.prefix, key) }),
      );
      return { size: result.ContentLength ?? 0, contentType: result.ContentType ?? null };
    } catch {
      return null;
    }
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: joinKey(this.prefix, key) }),
    );
  }

  async deletePrefix(prefix: string): Promise<void> {
    const normalized = prefix.replace(/^\/+|\/+$/g, '');
    if (!normalized) return;
    const keyPrefix = `${joinKey(this.prefix, normalized)}/`;
    let continuationToken: string | undefined;
    do {
      const listed = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: keyPrefix,
          ContinuationToken: continuationToken,
        }),
      );
      const objects = (listed.Contents ?? [])
        .map((item) => item.Key)
        .filter((key): key is string => Boolean(key))
        .map((key) => ({ Key: key }));
      if (objects.length > 0) {
        await this.client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: { Objects: objects, Quiet: true },
          }),
        );
      }
      continuationToken = listed.IsTruncated ? listed.NextContinuationToken : undefined;
    } while (continuationToken);
  }

  publicUrl(key: string): string | null {
    return this.publicBaseUrl ? `${this.publicBaseUrl}/${joinKey(this.prefix, key)}` : null;
  }

  async signedUrl(key: string, expiresInSeconds: number): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: joinKey(this.prefix, key) }),
      { expiresIn: expiresInSeconds },
    );
  }

  async readRange(
    key: string,
    start: number,
    end: number,
  ): Promise<{ stream: Readable; size: number; contentType: string | null } | null> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: joinKey(this.prefix, key),
          Range: `bytes=${start}-${end}`,
        }),
      );
      return {
        stream: result.Body as Readable,
        size: end - start + 1,
        contentType: result.ContentType ?? null,
      };
    } catch {
      return null;
    }
  }

  async initMultipart(key: string, contentType: string): Promise<MultipartInit> {
    const result = await this.client.send(
      new CreateMultipartUploadCommand({
        Bucket: this.bucket,
        Key: joinKey(this.prefix, key),
        ContentType: contentType,
      }),
    );
    if (!result.UploadId) throw new Error('Failed to create S3 multipart upload');
    return { uploadId: result.UploadId, key };
  }

  async presignPart(
    key: string,
    uploadId: string | null,
    partNumber: number,
    expiresInSeconds: number,
  ): Promise<string | null> {
    if (!uploadId) return null;
    return getSignedUrl(
      this.client,
      new UploadPartCommand({
        Bucket: this.bucket,
        Key: joinKey(this.prefix, key),
        UploadId: uploadId,
        PartNumber: partNumber,
      }),
      { expiresIn: expiresInSeconds },
    );
  }

  async putPart(
    key: string,
    uploadId: string | null,
    partNumber: number,
    body: Buffer,
    _contentType?: string,
  ): Promise<CompletedPart> {
    if (!uploadId) throw new Error('Missing uploadId');
    const result = await this.client.send(
      new UploadPartCommand({
        Bucket: this.bucket,
        Key: joinKey(this.prefix, key),
        UploadId: uploadId,
        PartNumber: partNumber,
        Body: body,
      }),
    );
    return { partNumber, etag: result.ETag ?? '' };
  }

  async completeMultipart(
    key: string,
    uploadId: string | null,
    parts: CompletedPart[],
  ): Promise<void> {
    if (!uploadId) throw new Error('Missing uploadId');
    await this.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: this.bucket,
        Key: joinKey(this.prefix, key),
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts
            .sort((a, b) => a.partNumber - b.partNumber)
            .map((part) => ({ PartNumber: part.partNumber, ETag: part.etag })),
        },
      }),
    );
  }

  async abortMultipart(key: string, uploadId: string | null): Promise<void> {
    if (!uploadId) return;
    await this.client.send(
      new AbortMultipartUploadCommand({
        Bucket: this.bucket,
        Key: joinKey(this.prefix, key),
        UploadId: uploadId,
      }),
    );
  }

  async test(): Promise<void> {
    const key = `.healthcheck/${Date.now()}.txt`;
    await this.putObject(key, Buffer.from('ok'), 'text/plain');
    const buffer = await this.getBuffer(key);
    await this.deleteObject(key);
    if (buffer.toString() !== 'ok') throw new Error('S3 storage test failed');
  }
}
