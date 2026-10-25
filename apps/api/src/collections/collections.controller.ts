import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import {
  collectionCreateSchema,
  collectionItemSchema,
  collectionUpdateSchema,
} from '@uiliuili/shared';
import { z } from 'zod';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser, OptionalAuth, Public } from '../common/decorators';
import { zodBody } from '../common/zod';
import { CollectionsService } from './collections.service';

@Controller('api/v1')
export class CollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @Public()
  @OptionalAuth()
  @Get('users/:username/collections')
  async forUser(@Param('username') username: string, @CurrentUser() viewer?: AuthUser) {
    return this.collections.listForUser(username, viewer);
  }

  @Get('me/collections')
  async mine(@CurrentUser() user: AuthUser) {
    return this.collections.listMine(user);
  }

  @Public()
  @OptionalAuth()
  @Get('collections/:id')
  async detail(@Param('id') id: string, @CurrentUser() viewer?: AuthUser) {
    return this.collections.detail(id, viewer);
  }

  @Post('collections')
  async create(
    @CurrentUser() user: AuthUser,
    @Body(zodBody(collectionCreateSchema)) body: z.infer<typeof collectionCreateSchema>,
  ) {
    return this.collections.create(user, body);
  }

  @Patch('collections/:id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(collectionUpdateSchema)) body: z.infer<typeof collectionUpdateSchema>,
  ) {
    return this.collections.update(user, id, body);
  }

  @Delete('collections/:id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.collections.remove(user, id);
  }

  @Post('collections/:id/items')
  async addItem(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body(zodBody(collectionItemSchema)) body: z.infer<typeof collectionItemSchema>,
  ) {
    return this.collections.addItem(user, id, body.videoId, body.sort);
  }

  @Delete('collections/:id/items/:videoId')
  async removeItem(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Param('videoId') videoId: string,
  ) {
    return this.collections.removeItem(user, id, videoId);
  }
}
