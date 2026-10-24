import { Module } from '@nestjs/common';
import { VideosModule } from '../videos/videos.module';
import { MeController } from './me.controller';
import { MeService } from './me.service';

@Module({
  imports: [VideosModule],
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}
