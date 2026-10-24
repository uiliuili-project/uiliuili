import type { Db } from '@uiliuili/db';
import { sql } from 'drizzle-orm';

export async function rebuildSimilarities(db: Db): Promise<void> {
  await db.execute(sql`DELETE FROM "uiliuili"."video_similarities"`);
  await db.execute(sql`
    WITH recent AS (
      SELECT user_id, video_id
      FROM "uiliuili"."watch_events"
      WHERE user_id IS NOT NULL
        AND created_at > now() - interval '30 days'
      GROUP BY user_id, video_id
    ),
    pairs AS (
      SELECT a.video_id AS video_id, b.video_id AS related_video_id, COUNT(*)::real AS score
      FROM recent a
      JOIN recent b ON a.user_id = b.user_id AND a.video_id <> b.video_id
      GROUP BY a.video_id, b.video_id
    ),
    ranked AS (
      SELECT video_id, related_video_id, score,
             row_number() OVER (PARTITION BY video_id ORDER BY score DESC) AS rank
      FROM pairs
    )
    INSERT INTO "uiliuili"."video_similarities" (video_id, related_video_id, score, updated_at)
    SELECT video_id, related_video_id, score, now()
    FROM ranked
    WHERE rank <= 30
    ON CONFLICT (video_id, related_video_id)
    DO UPDATE SET score = EXCLUDED.score, updated_at = now()
  `);
}
