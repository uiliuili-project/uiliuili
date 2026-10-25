import { z } from 'zod';
import { VIDEO_VISIBILITIES } from '../constants';

export const dynamicCreateSchema = z
  .object({
    content: z.string().max(2000).default(''),
    images: z.array(z.string().max(500)).max(9).default([]),
    videoId: z.string().uuid().optional(),
    topicId: z.string().uuid().optional(),
    visibility: z.enum(VIDEO_VISIBILITIES).default('public'),
  })
  .refine((value) => value.content.trim().length > 0 || value.videoId || value.images.length > 0, {
    message: '动态内容不能为空',
  });

export const dynamicListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  feed: z.enum(['all', 'following', 'user', 'topic']).default('all'),
  username: z.string().max(40).optional(),
  topicId: z.string().uuid().optional(),
});

export const topicCreateSchema = z.object({
  title: z.string().min(1).max(60),
  description: z.string().max(2000).default(''),
  kind: z.enum(['topic', 'activity']).default('topic'),
  coverUrl: z.string().max(500).nullable().optional(),
  startsAt: z.string().datetime().nullable().optional(),
  endsAt: z.string().datetime().nullable().optional(),
});

export const topicUpdateSchema = topicCreateSchema.partial();

export const messageSendSchema = z.object({
  content: z.string().min(1).max(2000),
  recipientId: z.string().uuid().optional(),
  conversationId: z.string().uuid().optional(),
});

export const rankingQuerySchema = z.object({
  period: z.enum(['day', 'week', 'month', 'all']).default('week'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const topicListQuerySchema = z.object({
  kind: z.enum(['topic', 'activity']).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const topicSlugSchema = z.object({
  slug: z.string().min(1).max(64),
});

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(1000),
  keys: z.object({
    p256dh: z.string().min(1).max(500),
    auth: z.string().min(1).max(500),
  }),
});

export type DynamicCreateInput = z.infer<typeof dynamicCreateSchema>;
export type TopicCreateInput = z.infer<typeof topicCreateSchema>;
