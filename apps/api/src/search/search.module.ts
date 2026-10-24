import { Module } from '@nestjs/common';
import { VideosModule } from '../videos/videos.module';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [VideosModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
