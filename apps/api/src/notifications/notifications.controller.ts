import { Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import type { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators';
import { zodQuery } from '../common/zod';
import { NotificationsService } from './notifications.service';

const listSchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  unread: z.coerce.boolean().optional(),
});

@Controller('api/v1/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  async list(
    @CurrentUser() user: AuthUser,
    @Query(zodQuery(listSchema)) query: z.infer<typeof listSchema>,
  ) {
    return this.notifications.list(user.id, query);
  }

  @Get('unread-count')
  async unread(@CurrentUser() user: AuthUser) {
    return this.notifications.unreadCount(user.id);
  }

  @Post('read-all')
  async readAll(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.id);
  }

  @Post(':id/read')
  async read(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notifications.markRead(user.id, id);
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.notifications.remove(user.id, id);
  }
}
