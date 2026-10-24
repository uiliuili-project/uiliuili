import { Injectable } from '@nestjs/common';
import { notifications, users } from '@uiliuili/db';
import type { NotificationItem } from '@uiliuili/shared';
import { and, count, desc, eq, isNull, sql } from 'drizzle-orm';
import { DatabaseService } from '../common/database.service';
import { decodeCursor, encodeCursor, publicUser } from '../videos/video.helpers';

@Injectable()
export class NotificationsService {
  constructor(private readonly database: DatabaseService) {}

  async list(userId: string, query: { cursor?: string; limit: number; unread?: boolean }) {
    const offset = decodeCursor(query.cursor);
    const rows = await this.database.db
      .select({ notification: notifications, actor: users })
      .from(notifications)
      .leftJoin(users, eq(users.id, notifications.actorId))
      .where(
        and(
          eq(notifications.userId, userId),
          query.unread ? isNull(notifications.readAt) : undefined,
        ),
      )
      .orderBy(desc(notifications.createdAt))
      .limit(query.limit)
      .offset(offset);
    return {
      items: rows.map((row) => this.toItem(row.notification, row.actor)),
      nextCursor: rows.length === query.limit ? encodeCursor(offset + query.limit) : null,
    };
  }

  async unreadCount(userId: string) {
    const [row] = await this.database.db
      .select({ value: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return { count: Number(row?.value ?? 0) };
  }

  async markRead(userId: string, id: string) {
    await this.database.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
    return { ok: true };
  }

  async markAllRead(userId: string) {
    await this.database.db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
    return { ok: true };
  }

  async remove(userId: string, id: string) {
    await this.database.db
      .delete(notifications)
      .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
    return { ok: true };
  }

  async systemNotification(userId: string, title: string, body: string, link?: string) {
    await this.database.db.insert(notifications).values({
      userId,
      type: 'system',
      title,
      body,
      link: link ?? null,
    });
  }

  private toItem(
    notification: typeof notifications.$inferSelect,
    actor: typeof users.$inferSelect | null,
  ): NotificationItem {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      link: notification.link,
      readAt: notification.readAt?.toISOString() ?? null,
      createdAt: notification.createdAt.toISOString(),
      actor: actor ? publicUser(actor) : null,
    };
  }
}
