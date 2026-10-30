import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuditService } from './audit.service';
import { CacheService } from './cache.service';
import { CaptchaService } from './captcha.service';
import { DatabaseService } from './database.service';
import { ImageUploadService } from './image-upload.service';
import { MailService } from './mail.service';
import { QueueService } from './queue.service';
import { RateLimitService } from './rate-limit.service';
import { RegionContextInterceptor } from './region-context.interceptor';
import { RegionController } from './region.controller';
import { RegionService } from './region.service';
import { SecurityController } from './security.controller';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { StorageService } from './storage.service';

@Global()
@Module({
  controllers: [SettingsController, RegionController, SecurityController],
  providers: [
    DatabaseService,
    CacheService,
    SettingsService,
    StorageService,
    ImageUploadService,
    MailService,
    AuditService,
    QueueService,
    RegionService,
    CaptchaService,
    RateLimitService,
    { provide: APP_INTERCEPTOR, useClass: RegionContextInterceptor },
  ],
  exports: [
    DatabaseService,
    CacheService,
    SettingsService,
    StorageService,
    ImageUploadService,
    MailService,
    AuditService,
    QueueService,
    RegionService,
    CaptchaService,
    RateLimitService,
  ],
})
export class CommonModule {}
