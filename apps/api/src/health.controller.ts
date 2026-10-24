import { Controller, Get } from '@nestjs/common';
import { APP_VERSION } from '@uiliuili/shared';

@Controller()
export class HealthController {
  @Get('health')
  health() {
    return { ok: true, version: APP_VERSION, time: new Date().toISOString() };
  }

  @Get('health/live')
  live() {
    return { ok: true };
  }
}
