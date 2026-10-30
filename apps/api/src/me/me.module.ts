import { Module } from '@nestjs/common';
import { InterestsModule } from '../interests/interests.module';
import { VideosModule } from '../videos/videos.module';
import { MeController } from './me.controller';
import { MeService } from './me.service';

@Module({
  imports: [VideosModule, InterestsModule],
  controllers: [MeController],
  providers: [MeService],
})
export class MeModule {}
