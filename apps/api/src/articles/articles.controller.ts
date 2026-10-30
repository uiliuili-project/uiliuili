import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import {
  articleCommentCreateSchema,
  articleCreateSchema,
  articleListQuerySchema,
  articleUpdateSchema,
} from '@uiliuili/shared';
import type { FastifyRequest } from 'fastify';
import { z } from 'zod';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser, OptionalAuth, Public, RequirePermissions } from '../common/decorators';
import { zodBody, zodQuery } from '../common/zod';
import { ArticlesService } from './articles.service';

const studioListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const adminListSchema = studioListSchema.extend({
  status: z.enum(['draft', 'pending_review', 'published', 'blocked', 'deleted']).optional(),
  q: z.string().max(100).optional(),
});

const adminModerateSchema = z.object({
  status: z.enum(['published', 'blocked', 'pending_review', 'deleted']),
  note: z.string().max(500).optional(),
});

/** Public columns. */
@Controller('api/v1/articles')
export class ArticlesController {
  constructor(private readonly articles: ArticlesService) {}

  @Public()
  @OptionalAuth()
  @Get()
  async list(
    @Query(zodQuery(articleListQuerySchema)) query: z.infer<typeof articleListQuerySchema>,
  ) {
    return this.articles.list(query);
  }

  @Public()
  @OptionalAuth()
  @Get(':id')
  async detail(@Param('id') id: string, @CurrentUser() viewer?: AuthUser) {
    return this.articles.detail(id, viewer);
  }

  @Post(':id/like')
  async like(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.articles.toggleLike(id, user, true);
  }

  @Delete(':id/like')
  async unlike(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.articles.toggleLike(id, user, false);
  }

  @Post(':id/favorite')
  async favorite(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.articles.toggleFavorite(id, user, true);
  }

  @Delete(':id/favorite')
  async unfavorite(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.articles.toggleFavorite(id, user, false);
  }

  @Public()
  @OptionalAuth()
  @Get(':id/comments')
  async comments(@Param('id') id: string, @CurrentUser() viewer?: AuthUser) {
    return this.articles.comments(id, viewer);
  }

  @Post(':id/comments')
  async createComment(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body(zodBody(articleCommentCreateSchema)) body: z.infer<typeof articleCommentCreateSchema>,
    @Req() request: FastifyRequest,
  ) {
    return this.articles.createComment(id, user, body, request.ip);
  }

  @Delete(':id/comments/:commentId')
  async removeComment(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.articles.removeComment(id, commentId, user);
  }
}

/** Creator-column management. */
@Controller('api/v1/studio/articles')
export class StudioArticlesController {
  constructor(private readonly articles: ArticlesService) {}

  @Get()
  @RequirePermissions('video:upload')
  async list(
    @CurrentUser() user: AuthUser,
    @Query(zodQuery(studioListSchema)) query: z.infer<typeof studioListSchema>,
  ) {
    return this.articles.myArticles(user.id, query.page, query.limit);
  }

  @Post()
  @RequirePermissions('video:upload')
  async create(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(articleCreateSchema)) body: z.infer<typeof articleCreateSchema>,
  ) {
    return this.articles.create(user.id, body);
  }

  @Get(':id')
  @RequirePermissions('video:upload')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.articles.myArticle(user.id, id);
  }

  @Patch(':id')
  @RequirePermissions('video:upload')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(articleUpdateSchema)) body: z.infer<typeof articleUpdateSchema>,
  ) {
    return this.articles.update(user.id, id, body);
  }

  @Delete(':id')
  @RequirePermissions('video:upload')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.articles.remove(user.id, id);
  }

  @Post(':id/publish')
  @RequirePermissions('video:upload')
  async publish(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.articles.publish(user.id, id, user.permissions.includes('video:review'));
  }

  @Post(':id/unpublish')
  @RequirePermissions('video:upload')
  async unpublish(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.articles.unpublish(user.id, id);
  }
}

/** Column review for staff. */
@Controller('api/v1/admin/articles')
export class AdminArticlesController {
  constructor(private readonly articles: ArticlesService) {}

  @Get()
  @RequirePermissions('video:review')
  async list(@Query(zodQuery(adminListSchema)) query: z.infer<typeof adminListSchema>) {
    return this.articles.adminList(query);
  }

  @Post(':id/moderate')
  @RequirePermissions('video:review')
  async moderate(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(adminModerateSchema)) body: z.infer<typeof adminModerateSchema>,
  ) {
    return this.articles.adminModerate(user.id, id, body.status, body.note);
  }
}
