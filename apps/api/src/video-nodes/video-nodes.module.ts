import { Module } from '@nestjs/common';
import { VideoNodesController } from './video-nodes.controller';
import { VideoNodesService } from './video-nodes.service';

@Module({
  controllers: [VideoNodesController],
  providers: [VideoNodesService],
  exports: [VideoNodesService],
})
export class VideoNodesModule {}
