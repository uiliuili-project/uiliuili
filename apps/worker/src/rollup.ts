import type { Db } from '@uiliuili/db';
import { sql } from 'drizzle-orm';

/**
 * Rolls raw watch events and interactions for one UTC day into the aggregate
 * tables. The job is idempotent: re-running it for the same day replaces the
 * stored counters instead of adding to them.
 */
export async function rollupDailyStats(db: Db, day?: string): Promise<{ day: string }> {
  const target = day ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await db.execute(sql`
    INSERT INTO "uiliuili"."video_daily_stats"
      ("video_id", "day", "views", "unique_viewers", "completions", "sources", "devices", "countries", "updated_at")
    SELECT
      e."video_id",
      ${target}::date,
      COUNT(*) FILTER (WHERE e."event_type" = 'view')::int,
      COUNT(DISTINCT e."user_id") FILTER (WHERE e."event_type" = 'view')::int,
      COUNT(*) FILTER (WHERE e."event_type" = 'complete')::int,
      COALESCE((
        SELECT jsonb_object_agg(s."source", s."count")
        FROM (
          SELECT w."source", COUNT(*)::int AS "count"
          FROM "uiliuili"."watch_events" w
          WHERE w."video_id" = e."video_id"
            AND w."event_type" = 'view'
            AND (w."created_at" AT TIME ZONE 'UTC')::date = ${target}::date
          GROUP BY w."source"
        ) s
      ), '{}'::jsonb),
      COALESCE((
        SELECT jsonb_object_agg(s."device", s."count")
        FROM (
          SELECT w."device", COUNT(*)::int AS "count"
          FROM "uiliuili"."watch_events" w
          WHERE w."video_id" = e."video_id"
            AND w."event_type" = 'view'
            AND (w."created_at" AT TIME ZONE 'UTC')::date = ${target}::date
          GROUP BY w."device"
        ) s
      ), '{}'::jsonb),
      COALESCE((
        SELECT jsonb_object_agg(s."country", s."count")
        FROM (
          SELECT w."country", COUNT(*)::int AS "count"
          FROM "uiliuili"."watch_events" w
          WHERE w."video_id" = e."video_id"
            AND w."event_type" = 'view'
            AND (w."created_at" AT TIME ZONE 'UTC')::date = ${target}::date
          GROUP BY w."country"
        ) s
      ), '{}'::jsonb),
      now()
    FROM "uiliuili"."watch_events" e
    WHERE e."event_type" IN ('view', 'complete')
      AND (e."created_at" AT TIME ZONE 'UTC')::date = ${target}::date
    GROUP BY e."video_id"
    ON CONFLICT ("video_id", "day") DO UPDATE SET
      "views" = EXCLUDED."views",
      "unique_viewers" = EXCLUDED."unique_viewers",
      "completions" = EXCLUDED."completions",
      "sources" = EXCLUDED."sources",
      "devices" = EXCLUDED."devices",
      "countries" = EXCLUDED."countries",
      "updated_at" = now()
  `);

  await db.execute(sql`
    INSERT INTO "uiliuili"."video_daily_stats"
      ("video_id", "day", "likes", "coins", "favorites", "comments", "danmaku", "updated_at")
    SELECT
      t."video_id",
      ${target}::date,
      SUM(t."likes")::int,
      SUM(t."coins")::int,
      SUM(t."favorites")::int,
      SUM(t."comments")::int,
      SUM(t."danmaku")::int,
      now()
    FROM (
      SELECT "video_id", 1 AS "likes", 0 AS "coins", 0 AS "favorites", 0 AS "comments", 0 AS "danmaku"
      FROM "uiliuili"."video_likes"
      WHERE ("created_at" AT TIME ZONE 'UTC')::date = ${target}::date
      UNION ALL
      SELECT "video_id", 0, 1, 0, 0, 0
      FROM "uiliuili"."video_coins"
      WHERE ("created_at" AT TIME ZONE 'UTC')::date = ${target}::date
      UNION ALL
      SELECT "video_id", 0, 0, 1, 0, 0
      FROM "uiliuili"."favorite_items"
      WHERE ("created_at" AT TIME ZONE 'UTC')::date = ${target}::date
      UNION ALL
      SELECT "video_id", 0, 0, 0, 1, 0
      FROM "uiliuili"."comments"
      WHERE ("created_at" AT TIME ZONE 'UTC')::date = ${target}::date
      UNION ALL
      SELECT "video_id", 0, 0, 0, 0, 1
      FROM "uiliuili"."danmaku"
      WHERE ("created_at" AT TIME ZONE 'UTC')::date = ${target}::date
    ) t
    GROUP BY t."video_id"
    ON CONFLICT ("video_id", "day") DO UPDATE SET
      "likes" = EXCLUDED."likes",
      "coins" = EXCLUDED."coins",
      "favorites" = EXCLUDED."favorites",
      "comments" = EXCLUDED."comments",
      "danmaku" = EXCLUDED."danmaku",
      "updated_at" = now()
  `);

  await db.execute(sql`
    INSERT INTO "uiliuili"."creator_daily_stats"
      ("user_id", "day", "views", "unique_viewers", "completions", "likes", "coins", "favorites",
       "comments", "danmaku", "followers_gained", "followers_lost", "new_videos", "sources", "devices", "countries", "updated_at")
    SELECT
      v."uploader_id",
      ${target}::date,
      COALESCE(SUM(s."views"), 0)::int,
      COALESCE(SUM(s."unique_viewers"), 0)::int,
      COALESCE(SUM(s."completions"), 0)::int,
      COALESCE(SUM(s."likes"), 0)::int,
      COALESCE(SUM(s."coins"), 0)::int,
      COALESCE(SUM(s."favorites"), 0)::int,
      COALESCE(SUM(s."comments"), 0)::int,
      COALESCE(SUM(s."danmaku"), 0)::int,
      (SELECT COUNT(*) FROM "uiliuili"."follow_events" f
        WHERE f."following_id" = v."uploader_id"
          AND f."event_type" = 'follow'
          AND (f."created_at" AT TIME ZONE 'UTC')::date = ${target}::date)::int,
      (SELECT COUNT(*) FROM "uiliuili"."follow_events" f
        WHERE f."following_id" = v."uploader_id"
          AND f."event_type" = 'unfollow'
          AND (f."created_at" AT TIME ZONE 'UTC')::date = ${target}::date)::int,
      (SELECT COUNT(*) FROM "uiliuili"."videos" nv
        WHERE nv."uploader_id" = v."uploader_id"
          AND nv."published_at" IS NOT NULL
          AND (nv."published_at" AT TIME ZONE 'UTC')::date = ${target}::date)::int,
      COALESCE((
        SELECT jsonb_object_agg(x."source", x."count")
        FROM (
          SELECT w."source", COUNT(*)::int AS "count"
          FROM "uiliuili"."watch_events" w
          JOIN "uiliuili"."videos" wv ON wv."id" = w."video_id"
          WHERE wv."uploader_id" = v."uploader_id"
            AND w."event_type" = 'view'
            AND (w."created_at" AT TIME ZONE 'UTC')::date = ${target}::date
          GROUP BY w."source"
        ) x
      ), '{}'::jsonb),
      COALESCE((
        SELECT jsonb_object_agg(x."device", x."count")
        FROM (
          SELECT w."device", COUNT(*)::int AS "count"
          FROM "uiliuili"."watch_events" w
          JOIN "uiliuili"."videos" wv ON wv."id" = w."video_id"
          WHERE wv."uploader_id" = v."uploader_id"
            AND w."event_type" = 'view'
            AND (w."created_at" AT TIME ZONE 'UTC')::date = ${target}::date
          GROUP BY w."device"
        ) x
      ), '{}'::jsonb),
      COALESCE((
        SELECT jsonb_object_agg(x."country", x."count")
        FROM (
          SELECT w."country", COUNT(*)::int AS "count"
          FROM "uiliuili"."watch_events" w
          JOIN "uiliuili"."videos" wv ON wv."id" = w."video_id"
          WHERE wv."uploader_id" = v."uploader_id"
            AND w."event_type" = 'view'
            AND (w."created_at" AT TIME ZONE 'UTC')::date = ${target}::date
          GROUP BY w."country"
        ) x
      ), '{}'::jsonb),
      now()
    FROM "uiliuili"."videos" v
    LEFT JOIN "uiliuili"."video_daily_stats" s
      ON s."video_id" = v."id" AND s."day" = ${target}::date
    WHERE v."deleted_at" IS NULL
    GROUP BY v."uploader_id"
    ON CONFLICT ("user_id", "day") DO UPDATE SET
      "views" = EXCLUDED."views",
      "unique_viewers" = EXCLUDED."unique_viewers",
      "completions" = EXCLUDED."completions",
      "likes" = EXCLUDED."likes",
      "coins" = EXCLUDED."coins",
      "favorites" = EXCLUDED."favorites",
      "comments" = EXCLUDED."comments",
      "danmaku" = EXCLUDED."danmaku",
      "followers_gained" = EXCLUDED."followers_gained",
      "followers_lost" = EXCLUDED."followers_lost",
      "new_videos" = EXCLUDED."new_videos",
      "sources" = EXCLUDED."sources",
      "devices" = EXCLUDED."devices",
      "countries" = EXCLUDED."countries",
      "updated_at" = now()
  `);

  return { day: target };
}
