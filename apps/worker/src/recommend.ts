import type { Db } from '@uiliuili/db';
import { siteSettings } from '@uiliuili/db';
import { eq, sql } from 'drizzle-orm';

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

/**
 * Applies the configured daily decay to learned tag affinity and prunes tags
 * that no longer carry signal. Runs once a day from the worker.
 */
export async function decayTagInterests(db: Db): Promise<{ factor: number }> {
  const rows = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.key, 'recommendation'))
    .limit(1);
  const recommendation = (rows[0]?.value ?? {}) as {
    tagAffinity?: { decayPerDay?: number };
  };
  const configured = Number(recommendation.tagAffinity?.decayPerDay ?? 0.95);
  const factor = Number.isFinite(configured) ? Math.min(1, Math.max(0.5, configured)) : 0.95;
  await db.execute(sql`
    UPDATE "uiliuili"."user_tag_interests"
    SET score = score * ${factor}, updated_at = now()
  `);
  await db.execute(sql`
    DELETE FROM "uiliuili"."user_tag_interests"
    WHERE score < 0.05
  `);
  return { factor };
}
