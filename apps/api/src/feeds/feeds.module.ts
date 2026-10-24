import { Module } from '@nestjs/common';
import { VideosModule } from '../videos/videos.module';
import { FeedsController } from './feeds.controller';
import { FeedsService } from './feeds.service';

@Module({
  imports: [VideosModule],
  controllers: [FeedsController],
  providers: [FeedsService],
})
export class FeedsModule {}
