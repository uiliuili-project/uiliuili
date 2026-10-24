import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators';
import { zodBody, zodQuery } from '../common/zod';
import { MeService } from './me.service';

const pageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const folderSchema = z.object({ name: z.string().min(1).max(40) });
const favoriteSchema = z.object({ videoId: z.string().uuid() });

@Controller('api/v1/me')
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get('history')
  async history(
    @CurrentUser() user: AuthUser,
    @Query(zodQuery(pageSchema)) query: z.infer<typeof pageSchema>,
  ) {
    return this.me.history(user.id, query.page, query.limit);
  }

  @Get('favorites')
  async favorites(@CurrentUser() user: AuthUser, @Query('folderId') folderId?: string) {
    return this.me.favorites(user.id, folderId);
  }

  @Post('favorites/folders')
  async createFolder(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(folderSchema)) body: z.infer<typeof folderSchema>,
  ) {
    return this.me.createFolder(user.id, body.name);
  }

  @Delete('favorites/folders/:folderId')
  async deleteFolder(@CurrentUser() user: AuthUser, @Param('folderId') folderId: string) {
    return this.me.deleteFolder(user.id, folderId);
  }

  @Post('favorites/folders/:folderId/items')
  async addFavorite(
    @CurrentUser() user: AuthUser,
    @Param('folderId') folderId: string,
    @Body(zodBody(favoriteSchema)) body: z.infer<typeof favoriteSchema>,
  ) {
    return this.me.addFavorite(user.id, folderId, body.videoId);
  }

  @Delete('favorites/folders/:folderId/items/:videoId')
  async removeFavorite(
    @CurrentUser() user: AuthUser,
    @Param('folderId') folderId: string,
    @Param('videoId') videoId: string,
  ) {
    return this.me.removeFavorite(user.id, folderId, videoId);
  }

  @Get('following')
  async following(@CurrentUser() user: AuthUser) {
    return this.me.followingUsers(user.id);
  }

  @Get('blocked')
  async blocked(@CurrentUser() user: AuthUser) {
    return this.me.blocked(user.id);
  }

  @Post('blocks/:userId')
  async block(@CurrentUser() user: AuthUser, @Param('userId') userId: string) {
    return this.me.block(user, userId);
  }

  @Delete('blocks/:userId')
  async unblock(@CurrentUser() user: AuthUser, @Param('userId') userId: string) {
    return this.me.unblock(user, userId);
  }

  @Get('coins')
  async coins(
    @CurrentUser() user: AuthUser,
    @Query(zodQuery(pageSchema)) query: z.infer<typeof pageSchema>,
  ) {
    return this.me.coinLedger(user.id, query.page, query.limit);
  }
}
