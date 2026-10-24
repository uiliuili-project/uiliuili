import { Controller, Get } from '@nestjs/common';
import { Public } from './decorators';
import { SettingsService } from './settings.service';

@Controller('api/v1/settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Public()
  @Get()
  async publicSettings() {
    return this.settings.getPublicSettings();
  }

  @Public()
  @Get('public')
  async publicSettingsAlias() {
    return this.settings.getPublicSettings();
  }
}
