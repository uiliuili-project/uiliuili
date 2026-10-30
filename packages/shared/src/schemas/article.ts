import { z } from 'zod';
import { ARTICLE_STATUSES, VIDEO_VISIBILITIES } from '../constants';
import { paginationSchema } from './video';

export const articleCreateSchema = z.object({
  title: z.string().min(1, '请输入标题').max(120),
  summary: z.string().max(300).default(''),
  content: z.string().max(200_000).default(''),
  coverUrl: z.string().max(500).nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  visibility: z.enum(VIDEO_VISIBILITIES).default('public'),
  allowComments: z.boolean().default(true),
});

export const articleUpdateSchema = articleCreateSchema.partial();

export const articleListQuerySchema = paginationSchema.extend({
  q: z.string().max(100).optional(),
  category: z.string().uuid().optional(),
  author: z.string().max(40).optional(),
  status: z.enum(ARTICLE_STATUSES).optional(),
  sort: z.enum(['new', 'hot']).default('new'),
});

export const articleCommentCreateSchema = z.object({
  content: z.string().min(1).max(1000),
  parentId: z.string().uuid().optional(),
});

export const articleCommentListQuerySchema = paginationSchema.extend({
  sort: z.enum(['hot', 'new']).default('new'),
});

export type ArticleCreateInput = z.infer<typeof articleCreateSchema>;
export type ArticleListQuery = z.infer<typeof articleListQuerySchema>;
