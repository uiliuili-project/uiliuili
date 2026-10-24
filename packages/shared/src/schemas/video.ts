import { z } from 'zod';
import { DANMAKU_MODES, VIDEO_VISIBILITIES } from '../constants';

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
});

export const progressSchema = z.object({
  positionMs: z.number().int().min(0),
  durationMs: z.number().int().min(0).optional(),
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
