import { Global, Module } from '@nestjs/common';
import { AuditService } from './audit.service';
import { CacheService } from './cache.service';
import { DatabaseService } from './database.service';
import { MailService } from './mail.service';
import { QueueService } from './queue.service';
import { SettingsService } from './settings.service';
import { StorageService } from './storage.service';

@Global()
@Module({
  providers: [
    DatabaseService,
    CacheService,
    SettingsService,
    StorageService,
    MailService,
    AuditService,
    QueueService,
  ],
  exports: [
    DatabaseService,
    CacheService,
    SettingsService,
    StorageService,
    MailService,
    AuditService,
    QueueService,
  ],
})
export class CommonModule {}
