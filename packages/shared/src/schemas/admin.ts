import { z } from 'zod';
import { USER_ROLES, VIDEO_STATUSES } from '../constants';

export const adminPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().max(100).optional(),
});

export const adminUserQuerySchema = adminPaginationSchema.extend({
  role: z.enum(USER_ROLES).optional(),
  banned: z.coerce.boolean().optional(),
});

export const adminUserUpdateSchema = z.object({
  role: z.enum(USER_ROLES).optional(),
  banned: z.boolean().optional(),
  mutedUntil: z.string().datetime().nullable().optional(),
  level: z.number().int().min(0).max(6).optional(),
});

export const adminVideoQuerySchema = adminPaginationSchema.extend({
  status: z.enum(VIDEO_STATUSES).optional(),
  categoryId: z.string().uuid().optional(),
  featured: z.coerce.boolean().optional(),
});

export const adminVideoUpdateSchema = z.object({
  status: z.enum(VIDEO_STATUSES).optional(),
  featured: z.boolean().optional(),
  recommendWeight: z.number().min(-100).max(100).optional(),
  blockReason: z.string().max(500).optional(),
});

export const adminDanmakuQuerySchema = adminPaginationSchema.extend({
  status: z.enum(['visible', 'hidden', 'pending', 'deleted']).optional(),
  videoId: z.string().uuid().optional(),
});

export const adminCommentQuerySchema = adminPaginationSchema.extend({
  status: z.enum(['visible', 'hidden', 'deleted']).optional(),
  videoId: z.string().uuid().optional(),
});

export const adminReportQuerySchema = adminPaginationSchema.extend({
  status: z.enum(['open', 'resolved', 'rejected']).optional(),
  targetType: z.enum(['video', 'comment', 'danmaku', 'user']).optional(),
});

export const moderationActionSchema = z.object({
  action: z.enum(['hide', 'restore', 'delete', 'ban', 'unban', 'mute', 'unmute']),
  reason: z.string().max(500).optional(),
  durationHours: z
    .number()
    .int()
    .min(1)
    .max(24 * 365)
    .optional(),
});

export const settingsUpdateSchema = z.object({
  patches: z.record(z.string(), z.unknown()),
});

export const categoryCreateSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(32)
    .regex(/^[a-z0-9\-]+$/),
  name: z.string().min(1).max(40),
  sort: z.number().int().default(0),
  parentId: z.string().uuid().nullable().optional(),
});

export const categoryUpdateSchema = categoryCreateSchema.partial();

export const announcementCreateSchema = z.object({
  title: z.string().min(1).max(120),
  content: z.string().min(1).max(2000),
  active: z.boolean().default(true),
  startsAt: z.string().datetime().optional(),
  endsAt: z.string().datetime().optional(),
});

export const jobQuerySchema = adminPaginationSchema.extend({
  status: z.enum(['created', 'retry', 'active', 'completed', 'cancelled', 'failed']).optional(),
  queue: z.string().optional(),
});

export const updateCheckSchema = z.object({}).optional();

export type AdminPagination = z.infer<typeof adminPaginationSchema>;
