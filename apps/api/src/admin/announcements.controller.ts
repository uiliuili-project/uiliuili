import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators';
import { AdminService } from './admin.service';

@Controller('api/v1/announcements')
export class AnnouncementsController {
  constructor(private readonly admin: AdminService) {}

  @Public()
  @Get()
  async list() {
    return { items: await this.admin.publicAnnouncements() };
  }
}
