import type { Db } from '@uiliuili/db';
import { sql } from 'drizzle-orm';

export async function runCleanup(db: Db): Promise<void> {
  await db.execute(sql`
    DELETE FROM "uiliuili"."upload_sessions"
    WHERE status = 'uploading' AND expires_at < now()
  `);
  await db.execute(sql`
    DELETE FROM "uiliuili"."refresh_sessions"
    WHERE expires_at < now() - interval '30 days'
  `);
  await db.execute(sql`
    DELETE FROM "uiliuili"."verification_tokens"
    WHERE expires_at < now() - interval '7 days'
  `);
  await db.execute(sql`
    DELETE FROM "uiliuili"."watch_events"
    WHERE created_at < now() - interval '180 days'
  `);
  await db.execute(sql`
    DELETE FROM "uiliuili"."notifications"
    WHERE read_at IS NOT NULL AND read_at < now() - interval '90 days'
  `);
  await db.execute(sql`
    DELETE FROM "uiliuili"."search_queries"
    WHERE created_at < now() - interval '30 days'
  `);
  await db.execute(sql`
    DELETE FROM "uiliuili"."background_jobs"
    WHERE status IN ('completed', 'cancelled') AND updated_at < now() - interval '7 days'
  `);
  await db.execute(sql`
    DELETE FROM "uiliuili"."background_jobs"
    WHERE status = 'failed' AND updated_at < now() - interval '30 days'
  `);
}
