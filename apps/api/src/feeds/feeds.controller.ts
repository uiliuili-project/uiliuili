import { Controller, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser, OptionalAuth, Public } from '../common/decorators';
import { zodQuery } from '../common/zod';
import { FeedsService } from './feeds.service';

const pageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

@Controller('api/v1/feed')
export class FeedsController {
  constructor(private readonly feeds: FeedsService) {}

  @Public()
  @OptionalAuth()
  @Get('home')
  async home(@CurrentUser() viewer?: AuthUser) {
    return this.feeds.home(viewer);
  }

  @Get('following')
  async following(
    @CurrentUser() user: AuthUser,
    @Query(zodQuery(pageSchema)) query: z.infer<typeof pageSchema>,
  ) {
    return this.feeds.following(user, query.page, query.limit);
  }

  @Public()
  @OptionalAuth()
  @Get('popular')
  async popular() {
    return this.feeds.popular();
  }

  @Get('continue')
  async continueWatching(@CurrentUser() user: AuthUser) {
    return this.feeds.continueWatching(user.id);
  }
}
