import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AnnouncementsController } from './announcements.controller';

@Module({
  controllers: [AdminController, AnnouncementsController],
  providers: [AdminService],
})
export class AdminModule {}
