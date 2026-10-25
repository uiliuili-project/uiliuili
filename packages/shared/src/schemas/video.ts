import { z } from 'zod';
import { DANMAKU_MODES, DANMAKU_POOLS, VIDEO_VISIBILITIES } from '../constants';

export const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const videoCreateSchema = z.object({
  title: z.string().min(1, '请输入标题').max(120),
  description: z.string().max(5000).default(''),
  categoryId: z.string().uuid().optional(),
  tags: z.array(z.string().min(1).max(24)).max(12).default([]),
  visibility: z.enum(VIDEO_VISIBILITIES).default('public'),
});

export const videoUpdateSchema = videoCreateSchema.partial().extend({
  coverUrl: z.string().max(500).optional(),
});

export const uploadInitSchema = z.object({
  filename: z.string().min(1).max(255),
  size: z.number().int().positive(),
  contentType: z.string().min(1).max(100),
  chunks: z.number().int().positive().optional(),
  partId: z.string().uuid().optional(),
});

export const videoPartCreateSchema = z.object({
  title: z.string().min(1).max(80).default('正片'),
  sort: z.number().int().min(0).max(999).optional(),
});

export const videoPartUpdateSchema = z.object({
  title: z.string().min(1).max(80).optional(),
  sort: z.number().int().min(0).max(999).optional(),
});

export const collectionCreateSchema = z.object({
  title: z.string().min(1).max(80),
  description: z.string().max(2000).default(''),
  kind: z.enum(['collection', 'series']).default('collection'),
  visibility: z.enum(VIDEO_VISIBILITIES).default('public'),
});

export const collectionUpdateSchema = collectionCreateSchema.partial().extend({
  coverUrl: z.string().max(500).nullable().optional(),
});

export const collectionItemSchema = z.object({
  videoId: z.string().uuid(),
  sort: z.number().int().min(0).max(9999).optional(),
});

export const followGroupSchema = z.object({
  name: z.string().min(1).max(20),
  sort: z.number().int().min(0).max(999).optional(),
});

export const followGroupAssignSchema = z.object({
  groupId: z.string().uuid().nullable().optional(),
});

export const pinCommentSchema = z.object({
  pinned: z.boolean(),
});

export const uploadCompleteSchema = z.object({
  uploadId: z.string().uuid(),
  parts: z
    .array(
      z.object({
        partNumber: z.number().int().positive(),
        etag: z.string().min(1),
      }),
    )
    .optional(),
});

export const presignPartsSchema = z.object({
  partNumbers: z.array(z.number().int().positive()).min(1).max(1000),
});

export const recordPartSchema = z.object({
  partNumber: z.number().int().positive(),
  etag: z.string().min(1),
  size: z.number().int().positive().optional(),
});

export const publishVideoSchema = z.object({
  publishAt: z.string().datetime().optional(),
});

export const videoListQuerySchema = paginationSchema.extend({
  category: z.string().optional(),
  tag: z.string().optional(),
  author: z.string().max(40).optional(),
  sort: z.enum(['new', 'hot', 'recommended']).default('new'),
  q: z.string().max(100).optional(),
});

export const commentCreateSchema = z.object({
  content: z.string().min(1).max(1000),
  parentId: z.string().uuid().optional(),
});

export const commentListQuerySchema = paginationSchema.extend({
  sort: z.enum(['hot', 'new']).default('hot'),
});

export const danmakuCreateSchema = z.object({
  progressMs: z
    .number()
    .int()
    .min(0)
    .max(24 * 60 * 60 * 1000),
  partId: z.string().uuid().optional(),
  pool: z.enum(DANMAKU_POOLS).default('normal'),
  mode: z.enum(DANMAKU_MODES).default('scroll'),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default('#ffffff'),
  fontSize: z.number().int().min(12).max(48).default(25),
  content: z.string().min(1).max(100),
});

export const danmakuQuerySchema = z.object({
  segment: z.coerce.number().int().min(0).default(0),
  partId: z.string().uuid().optional(),
});

export const progressSchema = z.object({
  positionMs: z.number().int().min(0),
  durationMs: z.number().int().min(0).optional(),
  partId: z.string().uuid().optional(),
  completed: z.boolean().optional().default(false),
});

export const reportSchema = z.object({
  targetType: z.enum(['video', 'comment', 'danmaku', 'user']),
  targetId: z.string().uuid(),
  reason: z.enum(['spam', 'abuse', 'porn', 'violence', 'copyright', 'misinformation', 'other']),
  detail: z.string().max(1000).optional(),
});

export const coinSchema = z.object({
  amount: z.number().int().min(1).max(2).default(1),
});

export const favoriteSchema = z.object({
  folderId: z.string().uuid().optional(),
});

export const feedbackSchema = z.object({
  videoId: z.string().uuid(),
  action: z.enum(['not_interested', 'hide_uploader']),
});

export type VideoCreateInput = z.infer<typeof videoCreateSchema>;
export type DanmakuCreateInput = z.infer<typeof danmakuCreateSchema>;
export type CommentCreateInput = z.infer<typeof commentCreateSchema>;
