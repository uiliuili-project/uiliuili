import { Module } from '@nestjs/common';
import { AdminModule } from './admin/admin.module';
import { ArticlesModule } from './articles/articles.module';
import { AuthModule } from './auth/auth.module';
import { CollectionsModule } from './collections/collections.module';
import { CommentsModule } from './comments/comments.module';
import { CommonModule } from './common/common.module';
import { DanmakuModule } from './danmaku/danmaku.module';
import { FeedsModule } from './feeds/feeds.module';
import { HealthController } from './health.controller';
import { MeModule } from './me/me.module';
import { MediaModule } from './media/media.module';
import { ModerationModule } from './moderation/moderation.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReviewModule } from './review/review.module';
import { SearchModule } from './search/search.module';
import { SocialModule } from './social/social.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';
import { VideoNodesModule } from './video-nodes/video-nodes.module';
import { VideosModule } from './videos/videos.module';

@Module({
  imports: [
    CommonModule,
    AuthModule,
    AdminModule,
    ArticlesModule,
    ReviewModule,
    UsersModule,
    VideosModule,
    DanmakuModule,
    CommentsModule,
    CollectionsModule,
    FeedsModule,
    MeModule,
    ModerationModule,
    NotificationsModule,
    SearchModule,
    SocialModule,
    MediaModule,
    UploadsModule,
    VideoNodesModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
