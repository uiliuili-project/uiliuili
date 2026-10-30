import { Module } from '@nestjs/common';
import {
  AdminArticlesController,
  ArticlesController,
  StudioArticlesController,
} from './articles.controller';
import { ArticlesService } from './articles.service';

@Module({
  controllers: [ArticlesController, StudioArticlesController, AdminArticlesController],
  providers: [ArticlesService],
  exports: [ArticlesService],
})
export class ArticlesModule {}
