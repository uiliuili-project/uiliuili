import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { adminReportQuerySchema, moderationActionSchema } from '@uiliuili/shared';
import { z } from 'zod';
import { AdminService } from '../admin/admin.service';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser, RequireAnyPermission, RequirePermissions } from '../common/decorators';
import { zodBody, zodQuery } from '../common/zod';
import {
  ReviewService,
  reviewCommentQuerySchema,
  reviewVideoDecisionSchema,
  reviewVideoQuerySchema,
} from './review.service';

@Controller('api/v1/review')
export class ReviewController {
  constructor(
    private readonly review: ReviewService,
    private readonly admin: AdminService,
  ) {}

  @Get('summary')
  @RequireAnyPermission('video:review', 'comment:manage', 'report:manage')
  async summary() {
    return this.review.summary();
  }

  @Get('videos')
  @RequirePermissions('video:review')
  async videos(
    @Query(zodQuery(reviewVideoQuerySchema)) query: z.infer<typeof reviewVideoQuerySchema>,
  ) {
    return this.review.listVideos(query);
  }

  @Post('videos/:id/decision')
  @RequirePermissions('video:review')
  async decideVideo(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(reviewVideoDecisionSchema)) body: z.infer<typeof reviewVideoDecisionSchema>,
  ) {
    return this.review.decideVideo(actor, id, body);
  }

  @Get('comments')
  @RequirePermissions('comment:manage')
  async comments(
    @Query(zodQuery(reviewCommentQuerySchema)) query: z.infer<typeof reviewCommentQuerySchema>,
  ) {
    return this.review.listComments(query);
  }

  @Post('comments/:id/action')
  @RequirePermissions('comment:manage')
  async actOnComment(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(moderationActionSchema)) body: z.infer<typeof moderationActionSchema>,
  ) {
    return this.review.actOnComment(actor, id, body.action, body.reason);
  }

  @Get('reports')
  @RequirePermissions('report:manage')
  async reports(
    @Query(zodQuery(adminReportQuerySchema)) query: z.infer<typeof adminReportQuerySchema>,
  ) {
    return this.admin.listReports(query);
  }

  @Post('reports/:id/handle')
  @RequirePermissions('report:manage')
  async handleReport(
    @CurrentUser() actor: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(moderationActionSchema)) body: z.infer<typeof moderationActionSchema>,
  ) {
    return this.admin.handleReport(actor.id, id, body);
  }
}
