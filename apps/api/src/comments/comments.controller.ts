import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import {
  type CommentCreateInput,
  commentCreateSchema,
  commentListQuerySchema,
} from '@uiliuili/shared';
import { z } from 'zod';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser, OptionalAuth, Public } from '../common/decorators';
import { zodBody, zodQuery } from '../common/zod';
import { CommentsService } from './comments.service';

@Controller('api/v1/videos')
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Public()
  @OptionalAuth()
  @Get(':id/comments')
  async list(
    @Param('id') id: string,
    @Query(zodQuery(commentListQuerySchema)) query: z.infer<typeof commentListQuerySchema>,
    @CurrentUser() viewer?: AuthUser,
  ) {
    return this.comments.list(id, query, viewer);
  }

  @Post(':id/comments')
  async create(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body(zodBody(commentCreateSchema)) body: CommentCreateInput,
  ) {
    return this.comments.create(id, user, body);
  }

  @Delete(':id/comments/:commentId')
  async remove(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.comments.remove(id, commentId, user);
  }

  @Post(':id/comments/:commentId/like')
  async like(@Param('commentId') commentId: string, @CurrentUser() user: AuthUser) {
    return this.comments.toggleLike(commentId, user, true);
  }

  @Delete(':id/comments/:commentId/like')
  async unlike(@Param('commentId') commentId: string, @CurrentUser() user: AuthUser) {
    return this.comments.toggleLike(commentId, user, false);
  }
}
