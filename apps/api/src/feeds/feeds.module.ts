import { Module } from '@nestjs/common';
import { InterestsModule } from '../interests/interests.module';
import { VideosModule } from '../videos/videos.module';
import { FeedsController } from './feeds.controller';
import { FeedsService } from './feeds.service';

@Module({
  imports: [VideosModule, InterestsModule],
  controllers: [FeedsController],
  providers: [FeedsService],
})
export class FeedsModule {}
