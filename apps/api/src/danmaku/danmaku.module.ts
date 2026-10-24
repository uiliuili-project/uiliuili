import { Module } from '@nestjs/common';
import { VideosModule } from '../videos/videos.module';
import { DanmakuBus } from './danmaku.bus';
import { DanmakuController } from './danmaku.controller';
import { DanmakuGateway } from './danmaku.gateway';
import { DanmakuService } from './danmaku.service';

@Module({
  imports: [VideosModule],
  controllers: [DanmakuController],
  providers: [DanmakuBus, DanmakuService, DanmakuGateway],
  exports: [DanmakuService, DanmakuBus],
})
export class DanmakuModule {}
