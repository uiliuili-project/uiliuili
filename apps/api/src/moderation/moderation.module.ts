import { Global, Module } from '@nestjs/common';
import { AiModerationService } from './ai-moderation.service';

@Global()
@Module({
  providers: [AiModerationService],
  exports: [AiModerationService],
})
export class ModerationModule {}
