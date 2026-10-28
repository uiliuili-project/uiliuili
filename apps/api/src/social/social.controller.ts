import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  dynamicCreateSchema,
  dynamicListQuerySchema,
  messageSendSchema,
  pushSubscriptionSchema,
  rankingQuerySchema,
  topicCreateSchema,
  topicListQuerySchema,
  topicUpdateSchema,
} from '@uiliuili/shared';
import { z } from 'zod';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser, OptionalAuth, Public, RequirePermissions } from '../common/decorators';
import { zodBody, zodQuery } from '../common/zod';
import { SocialService } from './social.service';

@Controller('api/v1')
export class SocialController {
  constructor(private readonly social: SocialService) {}

  @Public()
  @OptionalAuth()
  @Get('dynamics')
  async dynamics(
    @Query(zodQuery(dynamicListQuerySchema)) query: z.infer<typeof dynamicListQuerySchema>,
    @CurrentUser() viewer?: AuthUser,
  ) {
    return this.social.dynamicList(viewer, query);
  }

  @Post('dynamics')
  async createDynamic(
    @CurrentUser() viewer: AuthUser,
    @Body(zodBody(dynamicCreateSchema)) body: z.infer<typeof dynamicCreateSchema>,
  ) {
    return this.social.createDynamic(viewer, body);
  }

  @Delete('dynamics/:id')
  async removeDynamic(@CurrentUser() viewer: AuthUser, @Param('id') id: string) {
    return this.social.removeDynamic(viewer, id);
  }

  @Post('dynamics/:id/like')
  async likeDynamic(@CurrentUser() viewer: AuthUser, @Param('id') id: string) {
    return this.social.toggleDynamicLike(viewer, id, true);
  }

  @Delete('dynamics/:id/like')
  async unlikeDynamic(@CurrentUser() viewer: AuthUser, @Param('id') id: string) {
    return this.social.toggleDynamicLike(viewer, id, false);
  }

  @Public()
  @Get('topics')
  async topics(@Query(zodQuery(topicListQuerySchema)) query: z.infer<typeof topicListQuerySchema>) {
    return this.social.topicsList(query);
  }

  @Public()
  @Get('topics/:slug')
  async topic(@Param('slug') slug: string) {
    return this.social.topicBySlug(slug);
  }

  @Post('topics')
  @RequirePermissions('settings:content')
  async createTopic(@Body(zodBody(topicCreateSchema)) body: z.infer<typeof topicCreateSchema>) {
    return this.social.createTopic(body);
  }

  @Patch('topics/:id')
  @RequirePermissions('settings:content')
  async updateTopic(
    @Param('id') id: string,
    @Body(zodBody(topicUpdateSchema)) body: z.infer<typeof topicUpdateSchema>,
  ) {
    return this.social.updateTopic(id, body);
  }

  @Delete('topics/:id')
  @RequirePermissions('settings:content')
  async removeTopic(@Param('id') id: string) {
    return this.social.removeTopic(id);
  }

  @Public()
  @Get('rankings')
  async rankings(@Query(zodQuery(rankingQuerySchema)) query: z.infer<typeof rankingQuerySchema>) {
    return this.social.rankings(query.period, query.limit);
  }

  @Get('messages/conversations')
  async conversations(@CurrentUser() viewer: AuthUser) {
    return this.social.conversations(viewer);
  }

  @Get('messages/conversations/:id')
  async messages(@CurrentUser() viewer: AuthUser, @Param('id') id: string) {
    return this.social.messages(viewer, id);
  }

  @Post('messages/conversations/:id')
  async sendToConversation(
    @CurrentUser() viewer: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(messageSendSchema)) body: z.infer<typeof messageSendSchema>,
  ) {
    return this.social.sendMessage(viewer, { ...body, conversationId: id });
  }

  @Post('messages')
  async sendMessage(
    @CurrentUser() viewer: AuthUser,
    @Body(zodBody(messageSendSchema)) body: z.infer<typeof messageSendSchema>,
  ) {
    return this.social.sendMessage(viewer, body);
  }

  @Post('me/push-subscriptions')
  async registerPush(
    @CurrentUser() viewer: AuthUser,
    @Body(zodBody(pushSubscriptionSchema)) body: z.infer<typeof pushSubscriptionSchema>,
  ) {
    return this.social.registerPush(viewer, body);
  }

  @Delete('me/push-subscriptions')
  async removePush(@CurrentUser() viewer: AuthUser, @Query('endpoint') endpoint?: string) {
    return this.social.removePush(viewer, endpoint ?? '');
  }
}
