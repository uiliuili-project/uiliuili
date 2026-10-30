import type { Readable } from 'node:stream';

export type StorageDriver = 'local' | 's3';

export interface MultipartInit {
  uploadId: string | null;
  key: string;
}

export interface CompletedPart {
  partNumber: number;
  etag: string;
}

export interface StorageProvider {
  readonly driver: StorageDriver;
  putObject(key: string, body: Buffer | Readable, contentType?: string): Promise<void>;
  getObject(key: string): Promise<Readable>;
  getBuffer(key: string): Promise<Buffer>;
  headObject(key: string): Promise<{ size: number; contentType: string | null } | null>;
  deleteObject(key: string): Promise<void>;
  /** Deletes every object whose key starts with the given prefix. */
  deletePrefix(prefix: string): Promise<void>;
  publicUrl(key: string): string | null;
  signedUrl(key: string, expiresInSeconds: number): Promise<string>;
  readRange(
    key: string,
    start: number,
    end: number,
  ): Promise<{ stream: Readable; size: number; contentType: string | null } | null>;
  initMultipart(key: string, contentType: string): Promise<MultipartInit>;
  presignPart(
    key: string,
    uploadId: string | null,
    partNumber: number,
    expiresInSeconds: number,
  ): Promise<string | null>;
  putPart(
    key: string,
    uploadId: string | null,
    partNumber: number,
    body: Buffer,
    contentType?: string,
  ): Promise<CompletedPart>;
  completeMultipart(key: string, uploadId: string | null, parts: CompletedPart[]): Promise<void>;
  abortMultipart(key: string, uploadId: string | null): Promise<void>;
  test(): Promise<void>;
}

export interface LocalStorageOptions {
  root: string;
  publicBasePath?: string;
}

export interface S3StorageOptions {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
  publicBaseUrl?: string;
  prefix?: string;
}

export interface ProbeResult {
  durationSeconds: number;
  width: number;
  height: number;
  bitrate: number;
  videoCodec: string;
  audioCodec: string | null;
  hasAudio: boolean;
  sizeBytes: number;
}

export interface RenditionPlan {
  quality: string;
  width: number;
  height: number;
  videoBitrate: number;
  audioBitrate: number;
}

export interface TranscodeResult {
  masterPlaylist: string;
  renditions: Array<RenditionPlan & { playlist: string; directory: string }>;
  coverPath: string;
  spritePath: string | null;
  previewVttPath: string | null;
  durationSeconds: number;
}

export interface TranscodeProgress {
  stage: 'probe' | 'video' | 'sprite' | 'cover' | 'complete';
  percent: number;
  rendition?: string;
}
