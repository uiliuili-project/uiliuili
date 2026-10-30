import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { followGroupAssignSchema, followGroupSchema } from '@uiliuili/shared';
import { z } from 'zod';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators';
import { zodBody, zodQuery } from '../common/zod';
import { MeService } from './me.service';

const pageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

const folderSchema = z.object({
  name: z.string().min(1).max(40),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().optional(),
});

const folderUpdateSchema = z.object({
  name: z.string().min(1).max(40).optional(),
  description: z.string().max(500).optional(),
  isPublic: z.boolean().optional(),
});

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

  @Get('tag-interests')
  async tagInterests(@CurrentUser() user: AuthUser) {
    return this.me.tagInterests(user.id);
  }

  @Delete('tag-interests')
  async clearTagInterests(@CurrentUser() user: AuthUser) {
    return this.me.clearTagInterests(user.id);
  }

  @Delete('tag-interests/:tagId')
  async removeTagInterest(@CurrentUser() user: AuthUser, @Param('tagId') tagId: string) {
    return this.me.removeTagInterest(user.id, tagId);
  }

  @Post('favorites/folders')
  async createFolder(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(folderSchema)) body: z.infer<typeof folderSchema>,
  ) {
    return this.me.createFolder(user.id, body);
  }

  @Patch('favorites/folders/:folderId')
  async updateFolder(
    @CurrentUser() user: AuthUser,
    @Param('folderId') folderId: string,
    @Body(zodBody(folderUpdateSchema)) body: z.infer<typeof folderUpdateSchema>,
  ) {
    return this.me.updateFolder(user.id, folderId, body);
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

  @Get('watch-later')
  async watchLater(@CurrentUser() user: AuthUser) {
    return this.me.watchLater(user.id);
  }

  @Get('follow-groups')
  async followGroups(@CurrentUser() user: AuthUser) {
    return this.me.followGroups(user.id);
  }

  @Post('follow-groups')
  async createFollowGroup(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(followGroupSchema)) body: z.infer<typeof followGroupSchema>,
  ) {
    return this.me.createFollowGroup(user.id, body);
  }

  @Delete('follow-groups/:groupId')
  async deleteFollowGroup(@CurrentUser() user: AuthUser, @Param('groupId') groupId: string) {
    return this.me.deleteFollowGroup(user.id, groupId);
  }

  @Post('following/:userId/group')
  async assignFollowGroup(
    @CurrentUser() user: AuthUser,
    @Param('userId') userId: string,
    @Body(zodBody(followGroupAssignSchema)) body: z.infer<typeof followGroupAssignSchema>,
  ) {
    return this.me.assignFollowGroup(user.id, userId, body.groupId);
  }

  @Get('coins')
  async coins(
    @CurrentUser() user: AuthUser,
    @Query(zodQuery(pageSchema)) query: z.infer<typeof pageSchema>,
  ) {
    return this.me.coinLedger(user.id, query.page, query.limit);
  }
}
