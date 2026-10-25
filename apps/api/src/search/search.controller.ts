import { Controller, Delete, Get, Query } from '@nestjs/common';
import { z } from 'zod';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser, OptionalAuth, Public } from '../common/decorators';
import { zodQuery } from '../common/zod';
import { SearchService } from './search.service';

const searchSchema = z.object({
  q: z.string().max(100).default(''),
  type: z.enum(['videos', 'users', 'tags']).default('videos'),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  category: z.string().optional(),
  sort: z.enum(['new', 'hot']).default('hot'),
  duration: z.enum(['short', 'medium', 'long']).optional(),
  date: z.enum(['week', 'month', 'year']).optional(),
  author: z.string().max(40).optional(),
  tag: z.string().max(24).optional(),
});

const suggestSchema = z.object({ q: z.string().max(100).default('') });

@Controller('api/v1/search')
export class SearchController {
  constructor(private readonly search: SearchService) {}

  @Public()
  @OptionalAuth()
  @Get()
  async run(
    @Query(zodQuery(searchSchema)) query: z.infer<typeof searchSchema>,
    @CurrentUser() viewer?: AuthUser,
  ) {
    return this.search.search(query, viewer);
  }

  @Public()
  @Get('suggest')
  async suggest(@Query(zodQuery(suggestSchema)) query: z.infer<typeof suggestSchema>) {
    return this.search.suggest(query.q);
  }

  @Public()
  @Get('hot')
  async hot() {
    return this.search.hot();
  }

  @Get('history')
  async history(@CurrentUser() user: AuthUser) {
    return this.search.history(user.id);
  }

  @Delete('history')
  async clearHistory(@CurrentUser() user: AuthUser) {
    return this.search.clearHistory(user.id);
  }
}
