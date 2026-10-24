import { Module } from '@nestjs/common';
import { StudioController } from './studio.controller';
import { StudioService } from './studio.service';
import { CategoriesController, UserVideosController, VideosController } from './videos.controller';
import { VideosService } from './videos.service';

@Module({
  controllers: [VideosController, UserVideosController, CategoriesController, StudioController],
  providers: [VideosService, StudioService],
  exports: [VideosService, StudioService],
})
export class VideosModule {}
