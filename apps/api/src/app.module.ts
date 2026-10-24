import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { CommentsModule } from './comments/comments.module';
import { CommonModule } from './common/common.module';
import { DanmakuModule } from './danmaku/danmaku.module';
import { FeedsModule } from './feeds/feeds.module';
import { HealthController } from './health.controller';
import { MeModule } from './me/me.module';
import { MediaModule } from './media/media.module';
import { NotificationsModule } from './notifications/notifications.module';
import { SearchModule } from './search/search.module';
import { UsersModule } from './users/users.module';
import { VideosModule } from './videos/videos.module';

@Module({
  imports: [
    CommonModule,
    AuthModule,
    AdminModule,
    UsersModule,
    VideosModule,
    DanmakuModule,
    CommentsModule,
    FeedsModule,
    MeModule,
    NotificationsModule,
    SearchModule,
    MediaModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
