ALTER TABLE "uiliuili"."videos" ADD COLUMN IF NOT EXISTS "content_type" text DEFAULT 'original' NOT NULL;--> statement-breakpoint
ALTER TABLE "uiliuili"."videos" ADD COLUMN IF NOT EXISTS "source_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "uiliuili"."videos" ADD COLUMN IF NOT EXISTS "ai_generated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "uiliuili"."videos" ADD COLUMN IF NOT EXISTS "allow_comments" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "uiliuili"."videos" ADD COLUMN IF NOT EXISTS "allow_danmaku" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "uiliuili"."watch_events" ADD COLUMN IF NOT EXISTS "part_id" uuid;--> statement-breakpoint
ALTER TABLE "uiliuili"."watch_events" ADD COLUMN IF NOT EXISTS "source" text DEFAULT 'direct' NOT NULL;--> statement-breakpoint
ALTER TABLE "uiliuili"."watch_events" ADD COLUMN IF NOT EXISTS "device" text DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "uiliuili"."watch_events" ADD COLUMN IF NOT EXISTS "country" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "uiliuili"."watch_events" ADD CONSTRAINT "watch_events_part_id_video_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "uiliuili"."video_parts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "watch_events_created_idx" ON "uiliuili"."watch_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "watch_events_video_created_idx" ON "uiliuili"."watch_events" USING btree ("video_id","created_at");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "uiliuili"."video_status_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"from_status" text DEFAULT '' NOT NULL,
	"to_status" text NOT NULL,
	"actor_id" uuid,
	"reason" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "uiliuili"."video_status_logs" ADD CONSTRAINT "video_status_logs_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "uiliuili"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."video_status_logs" ADD CONSTRAINT "video_status_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "uiliuili"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "video_status_logs_video_created_idx" ON "uiliuili"."video_status_logs" USING btree ("video_id","created_at");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "uiliuili"."video_appeals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"handled_by" uuid,
	"handle_note" text DEFAULT '' NOT NULL,
	"handled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "uiliuili"."video_appeals" ADD CONSTRAINT "video_appeals_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "uiliuili"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."video_appeals" ADD CONSTRAINT "video_appeals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "uiliuili"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."video_appeals" ADD CONSTRAINT "video_appeals_handled_by_users_id_fk" FOREIGN KEY ("handled_by") REFERENCES "uiliuili"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "video_appeals_video_idx" ON "uiliuili"."video_appeals" USING btree ("video_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "video_appeals_status_idx" ON "uiliuili"."video_appeals" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "video_appeals_pending_idx" ON "uiliuili"."video_appeals" USING btree ("video_id") WHERE "status" = 'pending';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "uiliuili"."video_daily_stats" (
	"video_id" uuid NOT NULL,
	"day" date NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"unique_viewers" integer DEFAULT 0 NOT NULL,
	"completions" integer DEFAULT 0 NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"coins" integer DEFAULT 0 NOT NULL,
	"favorites" integer DEFAULT 0 NOT NULL,
	"comments" integer DEFAULT 0 NOT NULL,
	"danmaku" integer DEFAULT 0 NOT NULL,
	"sources" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"devices" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"countries" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_daily_stats_video_id_day_pk" PRIMARY KEY("video_id","day")
);--> statement-breakpoint
ALTER TABLE "uiliuili"."video_daily_stats" ADD CONSTRAINT "video_daily_stats_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "uiliuili"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "video_daily_stats_day_idx" ON "uiliuili"."video_daily_stats" USING btree ("day");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "uiliuili"."creator_daily_stats" (
	"user_id" uuid NOT NULL,
	"day" date NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"unique_viewers" integer DEFAULT 0 NOT NULL,
	"completions" integer DEFAULT 0 NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"coins" integer DEFAULT 0 NOT NULL,
	"favorites" integer DEFAULT 0 NOT NULL,
	"comments" integer DEFAULT 0 NOT NULL,
	"danmaku" integer DEFAULT 0 NOT NULL,
	"followers_gained" integer DEFAULT 0 NOT NULL,
	"followers_lost" integer DEFAULT 0 NOT NULL,
	"new_videos" integer DEFAULT 0 NOT NULL,
	"sources" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"devices" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"countries" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "creator_daily_stats_user_id_day_pk" PRIMARY KEY("user_id","day")
);--> statement-breakpoint
ALTER TABLE "uiliuili"."creator_daily_stats" ADD CONSTRAINT "creator_daily_stats_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "uiliuili"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "creator_daily_stats_day_idx" ON "uiliuili"."creator_daily_stats" USING btree ("day");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "uiliuili"."follow_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"follower_id" uuid NOT NULL,
	"following_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "uiliuili"."follow_events" ADD CONSTRAINT "follow_events_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "uiliuili"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."follow_events" ADD CONSTRAINT "follow_events_following_id_users_id_fk" FOREIGN KEY ("following_id") REFERENCES "uiliuili"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "follow_events_following_created_idx" ON "uiliuili"."follow_events" USING btree ("following_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "follow_events_follower_created_idx" ON "uiliuili"."follow_events" USING btree ("follower_id","created_at");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "uiliuili"."articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_id" uuid NOT NULL,
	"title" text NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"cover_url" text,
	"category_id" uuid,
	"status" text DEFAULT 'draft' NOT NULL,
	"visibility" text DEFAULT 'public' NOT NULL,
	"allow_comments" boolean DEFAULT true NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"favorite_count" integer DEFAULT 0 NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "uiliuili"."articles" ADD CONSTRAINT "articles_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "uiliuili"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."articles" ADD CONSTRAINT "articles_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "uiliuili"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "articles_author_idx" ON "uiliuili"."articles" USING btree ("author_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "articles_status_published_idx" ON "uiliuili"."articles" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "articles_category_idx" ON "uiliuili"."articles" USING btree ("category_id","status");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "uiliuili"."article_likes" (
	"article_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_likes_article_id_user_id_pk" PRIMARY KEY("article_id","user_id")
);--> statement-breakpoint
ALTER TABLE "uiliuili"."article_likes" ADD CONSTRAINT "article_likes_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "uiliuili"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."article_likes" ADD CONSTRAINT "article_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "uiliuili"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "uiliuili"."article_favorites" (
	"article_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "article_favorites_article_id_user_id_pk" PRIMARY KEY("article_id","user_id")
);--> statement-breakpoint
ALTER TABLE "uiliuili"."article_favorites" ADD CONSTRAINT "article_favorites_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "uiliuili"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."article_favorites" ADD CONSTRAINT "article_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "uiliuili"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "uiliuili"."article_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"parent_id" uuid,
	"content" text NOT NULL,
	"ip_region" text,
	"status" text DEFAULT 'visible' NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "uiliuili"."article_comments" ADD CONSTRAINT "article_comments_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "uiliuili"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."article_comments" ADD CONSTRAINT "article_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "uiliuili"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "article_comments_article_idx" ON "uiliuili"."article_comments" USING btree ("article_id","status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "article_comments_parent_idx" ON "uiliuili"."article_comments" USING btree ("parent_id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "uiliuili"."video_collaborators" (
	"video_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" text DEFAULT 'collaborator' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"invited_by" uuid,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_collaborators_video_id_user_id_pk" PRIMARY KEY("video_id","user_id")
);--> statement-breakpoint
ALTER TABLE "uiliuili"."video_collaborators" ADD CONSTRAINT "video_collaborators_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "uiliuili"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."video_collaborators" ADD CONSTRAINT "video_collaborators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "uiliuili"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."video_collaborators" ADD CONSTRAINT "video_collaborators_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "uiliuili"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "video_collaborators_user_status_idx" ON "uiliuili"."video_collaborators" USING btree ("user_id","status");
