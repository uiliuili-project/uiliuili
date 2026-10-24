import { Controller, Get } from '@nestjs/common';
import { APP_VERSION } from '@uiliuili/shared';
import { Public } from './common/decorators';

@Controller()
export class HealthController {
  @Public()
  @Get('health')
  health() {
    return { ok: true, version: APP_VERSION, time: new Date().toISOString() };
  }

  @Public()
  @Get('health/live')
  live() {
    return { ok: true };
  }
}
