import { z } from 'zod';

export const NODE_TRANSCODE_PROFILES = ['auto', '1080p', '720p', '480p'] as const;
export type NodeTranscodeProfile = (typeof NODE_TRANSCODE_PROFILES)[number];

export const NODE_ASSET_STATUSES = [
  'created',
  'uploading',
  'uploaded',
  'transcoding',
  'ready',
  'failed',
] as const;
export type NodeAssetStatus = (typeof NODE_ASSET_STATUSES)[number];

export const NODE_ERROR_CODES = {
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  CAPACITY_EXCEEDED: 'CAPACITY_EXCEEDED',
  TRANSCODE_FAILED: 'TRANSCODE_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;
export type NodeErrorCode = (typeof NODE_ERROR_CODES)[keyof typeof NODE_ERROR_CODES];

export const transcodeConstraintsSchema = z.object({
  maxHeight: z.number().int().min(144).max(4320).optional(),
  maxBitrateKbps: z.number().int().min(200).max(200_000).optional(),
  maxDurationSeconds: z
    .number()
    .int()
    .min(1)
    .max(24 * 60 * 60)
    .optional(),
});
export type TranscodeConstraints = z.infer<typeof transcodeConstraintsSchema>;

export const createAssetSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  size: z.number().int().min(1),
  contentType: z.string().trim().min(1).max(120).default('application/octet-stream'),
  profile: z.enum(NODE_TRANSCODE_PROFILES).default('auto'),
  constraints: transcodeConstraintsSchema.default({}),
  /** Preferred part size in bytes; the node may clamp it. */
  partSize: z
    .number()
    .int()
    .min(1024 * 1024)
    .max(64 * 1024 * 1024)
    .optional(),
  metadata: z
    .object({
      siteVideoId: z.string().max(64).optional(),
      partId: z.string().max(64).optional(),
    })
    .default({}),
});
export type CreateAssetInput = z.infer<typeof createAssetSchema>;

export const createAssetResponseSchema = z.object({
  assetId: z.string().min(1),
  uploadId: z.string().min(1),
  partSize: z.number().int().positive(),
  totalParts: z.number().int().positive(),
  expiresAt: z.string(),
  uploadToken: z.string().min(1),
  /** Public base URL used by browsers for direct part uploads and playback. */
  publicUrl: z.string().url(),
});
export type CreateAssetResponse = z.infer<typeof createAssetResponseSchema>;

export const completeUploadSchema = z.object({
  parts: z
    .array(
      z.object({
        partNumber: z.number().int().positive(),
        etag: z.string().max(200).optional(),
        size: z.number().int().min(0).optional(),
      }),
    )
    .optional(),
});
export type CompleteUploadInput = z.infer<typeof completeUploadSchema>;

export const transcodeRequestSchema = z.object({
  profile: z.enum(NODE_TRANSCODE_PROFILES).default('auto'),
  constraints: transcodeConstraintsSchema.default({}),
});
export type TranscodeRequest = z.infer<typeof transcodeRequestSchema>;

export const renditionSchema = z.object({
  quality: z.string().min(1).max(32),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  bitrate: z.number().int().nonnegative(),
  playlistUrl: z.string().url(),
});
export type NodeRendition = z.infer<typeof renditionSchema>;

export const assetStatusSchema = z.object({
  assetId: z.string().min(1),
  status: z.enum(NODE_ASSET_STATUSES),
  progress: z.number().min(0).max(100).default(0),
  error: z.string().nullable().optional(),
  durationSeconds: z.number().nonnegative().default(0),
  width: z.number().int().nonnegative().default(0),
  height: z.number().int().nonnegative().default(0),
  size: z.number().int().nonnegative().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
  renditions: z.array(
    z.object({
      quality: z.string(),
      width: z.number().int(),
      height: z.number().int(),
      bitrate: z.number().int(),
    }),
  ),
});
export type AssetStatus = z.infer<typeof assetStatusSchema>;

export const playbackSignRequestSchema = z.object({
  assetId: z.string().min(1),
  ttlSeconds: z
    .number()
    .int()
    .min(30)
    .max(24 * 60 * 60)
    .default(300),
  quality: z.string().max(32).optional(),
});
export type PlaybackSignRequest = z.infer<typeof playbackSignRequestSchema>;

export const playbackSignResponseSchema = z.object({
  assetId: z.string().min(1),
  masterUrl: z.string().url(),
  expiresAt: z.string(),
  renditions: z.array(
    z.object({
      quality: z.string(),
      width: z.number().int(),
      height: z.number().int(),
      bitrate: z.number().int(),
      playlistUrl: z.string().url(),
    }),
  ),
});
export type PlaybackSignResponse = z.infer<typeof playbackSignResponseSchema>;

export const replicationImportSchema = z.object({
  /** Signed master playlist URL on the source node. */
  sourceUrl: z.string().url(),
  profile: z.enum(NODE_TRANSCODE_PROFILES).default('auto'),
  /** Source metadata so the target can report the video without probing. */
  durationSeconds: z.number().int().nonnegative().default(0),
  width: z.number().int().nonnegative().default(0),
  height: z.number().int().nonnegative().default(0),
  metadata: z
    .object({
      siteVideoId: z.string().max(64).optional(),
      partId: z.string().max(64).optional(),
    })
    .default({}),
});
export type ReplicationImportInput = z.infer<typeof replicationImportSchema>;

export const replicationImportResponseSchema = z.object({
  assetId: z.string().min(1),
  status: z.enum(NODE_ASSET_STATUSES),
});
export type ReplicationImportResponse = z.infer<typeof replicationImportResponseSchema>;

export const nodeInfoSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  region: z.string().max(8).default(''),
  regions: z.array(z.string().max(8)).default([]),
  publicUrl: z.string().url(),
  status: z.enum(['online', 'degraded', 'offline']).default('online'),
  storage: z.object({
    usedBytes: z.number().nonnegative().default(0),
    capacityBytes: z.number().nonnegative().default(0),
  }),
  queue: z.object({
    active: z.number().int().nonnegative().default(0),
    maxConcurrency: z.number().int().positive().default(1),
    pending: z.number().int().nonnegative().default(0),
  }),
});
export type NodeInfo = z.infer<typeof nodeInfoSchema>;

export const deleteAssetResponseSchema = z.object({ ok: z.boolean() });

export interface NodeErrorBody {
  error: {
    code: NodeErrorCode;
    message: string;
  };
}
