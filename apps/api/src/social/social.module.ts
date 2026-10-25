import { Module } from '@nestjs/common';
import { VideosModule } from '../videos/videos.module';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';

@Module({
  imports: [VideosModule],
  controllers: [SocialController],
  providers: [SocialService],
  exports: [SocialService],
})
export class SocialModule {}
