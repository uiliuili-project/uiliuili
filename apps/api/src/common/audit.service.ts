import { Injectable } from '@nestjs/common';
import { auditLogs } from '@uiliuili/db';
import { DatabaseService } from './database.service';

export interface AuditInput {
  actorId?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  ipHash?: string;
  userAgent?: string;
  before?: unknown;
  after?: unknown;
}

@Injectable()
export class AuditService {
  constructor(private readonly database: DatabaseService) {}

  async record(input: AuditInput): Promise<void> {
    await this.database.db.insert(auditLogs).values({
      actorId: input.actorId ?? null,
      action: input.action,
      targetType: input.targetType ?? '',
      targetId: input.targetId ?? '',
      ipHash: input.ipHash ?? '',
      userAgent: input.userAgent ?? '',
      before: input.before ?? null,
      after: input.after ?? null,
    });
  }
}
