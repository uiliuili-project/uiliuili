import { Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { AppError, ERROR_CODES } from '@uiliuili/shared';
import { z } from 'zod';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser, OptionalAuth, Public } from '../common/decorators';
import { zodQuery } from '../common/zod';
import { UsersService } from './users.service';

const pageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

@Controller('api/v1/users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Public()
  @OptionalAuth()
  @Get(':username')
  async profile(@Param('username') username: string, @CurrentUser() viewer?: AuthUser) {
    const profile = await this.users.profile(username, viewer);
    if (!profile) throw new AppError(ERROR_CODES.NOT_FOUND, '用户不存在', 404);
    return profile;
  }

  @Public()
  @Get(':username/followers')
  async followers(
    @Param('username') username: string,
    @Query(zodQuery(pageSchema)) query: z.infer<typeof pageSchema>,
  ) {
    return this.users.followers(username, query.page, query.limit);
  }

  @Public()
  @Get(':username/following')
  async following(
    @Param('username') username: string,
    @Query(zodQuery(pageSchema)) query: z.infer<typeof pageSchema>,
  ) {
    return this.users.following(username, query.page, query.limit);
  }

  @Public()
  @Get(':username/favorites')
  async favorites(@Param('username') username: string, @Query('folderId') folderId?: string) {
    return this.users.publicFavorites(username, folderId);
  }

  @Post(':id/follow')
  async follow(@CurrentUser() user: AuthUser, @Param('id') targetId: string) {
    try {
      return await this.users.follow(user, targetId);
    } catch (error) {
      throw new AppError(
        ERROR_CODES.BAD_REQUEST,
        error instanceof Error ? error.message : '关注失败',
        400,
      );
    }
  }

  @Delete(':id/follow')
  async unfollow(@CurrentUser() user: AuthUser, @Param('id') targetId: string) {
    return this.users.unfollow(user, targetId);
  }
}
