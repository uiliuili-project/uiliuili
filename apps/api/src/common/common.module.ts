import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditService } from './audit.service';
import { CacheService } from './cache.service';
import { DatabaseService } from './database.service';
import { MailService } from './mail.service';
import { QueueService } from './queue.service';
import { RegionContextInterceptor } from './region-context.interceptor';
import { RegionController } from './region.controller';
import { RegionService } from './region.service';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { StorageService } from './storage.service';

@Global()
@Module({
  controllers: [SettingsController, RegionController],
  providers: [
    DatabaseService,
    CacheService,
    SettingsService,
    StorageService,
    MailService,
    AuditService,
    QueueService,
    RegionService,
    { provide: APP_INTERCEPTOR, useClass: RegionContextInterceptor },
  ],
  exports: [
    DatabaseService,
    CacheService,
    SettingsService,
    StorageService,
    MailService,
    AuditService,
    QueueService,
    RegionService,
  ],
})
export class CommonModule {}
