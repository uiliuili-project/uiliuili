import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { type Db, type DbClient, createDb } from '@uiliuili/db';
import { config } from '../config';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);
  readonly client: DbClient;
  readonly db: Db;

  constructor() {
    if (!config.databaseUrl) {
      throw new Error('DATABASE_URL is not configured. Complete the installer first.');
    }
    const created = createDb(config.databaseUrl, {
      max: 20,
      onNotice: (notice) => this.logger.debug(notice.message),
    });
    this.client = created.client;
    this.db = created.db;
  }

  async onModuleDestroy(): Promise<void> {
    await this.client.end({ timeout: 5 });
  }
}
