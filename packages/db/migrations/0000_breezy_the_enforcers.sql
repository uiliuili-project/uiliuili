CREATE SCHEMA IF NOT EXISTS "uiliuili";
--> statement-breakpoint
CREATE TABLE "uiliuili"."announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."app_instance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"instance_id" text NOT NULL,
	"version" text NOT NULL,
	"schema_version" integer DEFAULT 1 NOT NULL,
	"installed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "app_instance_instance_id_unique" UNIQUE("instance_id")
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"target_type" text DEFAULT '' NOT NULL,
	"target_id" text DEFAULT '' NOT NULL,
	"ip_hash" text DEFAULT '' NOT NULL,
	"user_agent" text DEFAULT '' NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."auth_providers" (
	"provider" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"config_encrypted" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."background_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"queue" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" text DEFAULT 'created' NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 3 NOT NULL,
	"locked_at" timestamp with time zone,
	"locked_by" text,
	"last_error" text,
	"progress" integer DEFAULT 0 NOT NULL,
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"idempotency_key" text
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."blocks" (
	"user_id" uuid NOT NULL,
	"blocked_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocks_user_id_blocked_user_id_pk" PRIMARY KEY("user_id","blocked_user_id")
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"parent_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."coin_ledger" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"reason" text NOT NULL,
	"video_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."comment_likes" (
	"comment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "comment_likes_comment_id_user_id_pk" PRIMARY KEY("comment_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"parent_id" uuid,
	"content" text NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'visible' NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."danmaku" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"progress_ms" integer NOT NULL,
	"segment" integer NOT NULL,
	"mode" text DEFAULT 'scroll' NOT NULL,
	"color" text DEFAULT '#ffffff' NOT NULL,
	"font_size" integer DEFAULT 25 NOT NULL,
	"content" text NOT NULL,
	"status" text DEFAULT 'visible' NOT NULL,
	"ip_hash" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."favorite_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."favorite_items" (
	"folder_id" uuid NOT NULL,
	"video_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorite_items_folder_id_video_id_pk" PRIMARY KEY("folder_id","video_id")
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."follows" (
	"follower_id" uuid NOT NULL,
	"following_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follows_follower_id_following_id_pk" PRIMARY KEY("follower_id","following_id")
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"actor_id" uuid,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"link" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."oauth_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"email" text,
	"avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."refresh_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"user_agent" text DEFAULT '' NOT NULL,
	"ip_hash" text DEFAULT '' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_id" uuid,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"reason" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"handled_by" uuid,
	"handled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."search_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"query" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."site_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"is_secret" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tags_name_unique" UNIQUE("name"),
	CONSTRAINT "tags_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."upload_parts" (
	"upload_session_id" uuid NOT NULL,
	"part_number" integer NOT NULL,
	"size" integer DEFAULT 0 NOT NULL,
	"etag" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "upload_parts_upload_session_id_part_number_pk" PRIMARY KEY("upload_session_id","part_number")
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."upload_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"video_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"size" integer NOT NULL,
	"content_type" text NOT NULL,
	"storage_driver" text NOT NULL,
	"storage_key" text NOT NULL,
	"s3_upload_id" text,
	"chunk_size" integer NOT NULL,
	"total_chunks" integer NOT NULL,
	"uploaded_chunks" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'uploading' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."user_feedbacks" (
	"user_id" uuid NOT NULL,
	"video_id" uuid NOT NULL,
	"action" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_feedbacks_user_id_video_id_action_pk" PRIMARY KEY("user_id","video_id","action")
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"display_name" text NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"avatar_url" text,
	"cover_url" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"roles" text[] DEFAULT ARRAY['USER']::text[] NOT NULL,
	"level" integer DEFAULT 0 NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"muted_until" timestamp with time zone,
	"coin_balance" integer DEFAULT 0 NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."verification_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "verification_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."video_coins" (
	"user_id" uuid NOT NULL,
	"video_id" uuid NOT NULL,
	"amount" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_coins_user_id_video_id_pk" PRIMARY KEY("user_id","video_id")
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."video_likes" (
	"user_id" uuid NOT NULL,
	"video_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_likes_user_id_video_id_pk" PRIMARY KEY("user_id","video_id")
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."video_renditions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"quality" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"bitrate" integer NOT NULL,
	"playlist_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."video_similarities" (
	"video_id" uuid NOT NULL,
	"related_video_id" uuid NOT NULL,
	"score" real DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_similarities_video_id_related_video_id_pk" PRIMARY KEY("video_id","related_video_id")
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."video_subtitles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"language" text NOT NULL,
	"label" text NOT NULL,
	"storage_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."video_tags" (
	"video_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	CONSTRAINT "video_tags_video_id_tag_id_pk" PRIMARY KEY("video_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uploader_id" uuid NOT NULL,
	"category_id" uuid,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"cover_url" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"visibility" text DEFAULT 'public' NOT NULL,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"width" integer DEFAULT 0 NOT NULL,
	"height" integer DEFAULT 0 NOT NULL,
	"source_key" text,
	"source_size" integer DEFAULT 0 NOT NULL,
	"source_filename" text,
	"playlist_key" text,
	"sprite_key" text,
	"preview_vtt_key" text,
	"featured" boolean DEFAULT false NOT NULL,
	"recommend_weight" integer DEFAULT 0 NOT NULL,
	"block_reason" text,
	"published_at" timestamp with time zone,
	"view_count" integer DEFAULT 0 NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"coin_count" integer DEFAULT 0 NOT NULL,
	"favorite_count" integer DEFAULT 0 NOT NULL,
	"comment_count" integer DEFAULT 0 NOT NULL,
	"danmaku_count" integer DEFAULT 0 NOT NULL,
	"completion_rate" real DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."watch_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"video_id" uuid NOT NULL,
	"position_ms" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"event_type" text DEFAULT 'progress' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."watch_histories" (
	"user_id" uuid NOT NULL,
	"video_id" uuid NOT NULL,
	"position_ms" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer DEFAULT 0 NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watch_histories_user_id_video_id_pk" PRIMARY KEY("user_id","video_id")
);
--> statement-breakpoint
ALTER TABLE "uiliuili"."audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "uiliuili"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."blocks" ADD CONSTRAINT "blocks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "uiliuili"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."blocks" ADD CONSTRAINT "blocks_blocked_user_id_users_id_fk" FOREIGN KEY ("blocked_user_id") REFERENCES "uiliuili"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."coin_ledger" ADD CONSTRAINT "coin_ledger_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "uiliuili"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."coin_ledger" ADD CONSTRAINT "coin_ledger_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "uiliuili"."videos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."comment_likes" ADD CONSTRAINT "comment_likes_comment_id_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "uiliuili"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."comment_likes" ADD CONSTRAINT "comment_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "uiliuili"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."comments" ADD CONSTRAINT "comments_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "uiliuili"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."comments" ADD CONSTRAINT "comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "uiliuili"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."danmaku" ADD CONSTRAINT "danmaku_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "uiliuili"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."danmaku" ADD CONSTRAINT "danmaku_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "uiliuili"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."favorite_folders" ADD CONSTRAINT "favorite_folders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "uiliuili"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."favorite_items" ADD CONSTRAINT "favorite_items_folder_id_favorite_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "uiliuili"."favorite_folders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."favorite_items" ADD CONSTRAINT "favorite_items_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "uiliuili"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."follows" ADD CONSTRAINT "follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "uiliuili"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."follows" ADD CONSTRAINT "follows_following_id_users_id_fk" FOREIGN KEY ("following_id") REFERENCES "uiliuili"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "uiliuili"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."notifications" ADD CONSTRAINT "notifications_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "uiliuili"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."oauth_accounts" ADD CONSTRAINT "oauth_accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "uiliuili"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."refresh_sessions" ADD CONSTRAINT "refresh_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "uiliuili"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."reports" ADD CONSTRAINT "reports_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "uiliuili"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."reports" ADD CONSTRAINT "reports_handled_by_users_id_fk" FOREIGN KEY ("handled_by") REFERENCES "uiliuili"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."search_queries" ADD CONSTRAINT "search_queries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "uiliuili"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."upload_parts" ADD CONSTRAINT "upload_parts_upload_session_id_upload_sessions_id_fk" FOREIGN KEY ("upload_session_id") REFERENCES "uiliuili"."upload_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."upload_sessions" ADD CONSTRAINT "upload_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "uiliuili"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."upload_sessions" ADD CONSTRAINT "upload_sessions_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "uiliuili"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."user_feedbacks" ADD CONSTRAINT "user_feedbacks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "uiliuili"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."user_feedbacks" ADD CONSTRAINT "user_feedbacks_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "uiliuili"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."verification_tokens" ADD CONSTRAINT "verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "uiliuili"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."video_coins" ADD CONSTRAINT "video_coins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "uiliuili"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."video_coins" ADD CONSTRAINT "video_coins_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "uiliuili"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."video_likes" ADD CONSTRAINT "video_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "uiliuili"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."video_likes" ADD CONSTRAINT "video_likes_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "uiliuili"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."video_renditions" ADD CONSTRAINT "video_renditions_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "uiliuili"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."video_similarities" ADD CONSTRAINT "video_similarities_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "uiliuili"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."video_similarities" ADD CONSTRAINT "video_similarities_related_video_id_videos_id_fk" FOREIGN KEY ("related_video_id") REFERENCES "uiliuili"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."video_subtitles" ADD CONSTRAINT "video_subtitles_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "uiliuili"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."video_tags" ADD CONSTRAINT "video_tags_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "uiliuili"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."video_tags" ADD CONSTRAINT "video_tags_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "uiliuili"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."videos" ADD CONSTRAINT "videos_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "uiliuili"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."videos" ADD CONSTRAINT "videos_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "uiliuili"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."watch_events" ADD CONSTRAINT "watch_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "uiliuili"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."watch_events" ADD CONSTRAINT "watch_events_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "uiliuili"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."watch_histories" ADD CONSTRAINT "watch_histories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "uiliuili"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."watch_histories" ADD CONSTRAINT "watch_histories_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "uiliuili"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "announcements_active_idx" ON "uiliuili"."announcements" USING btree ("active","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_created_idx" ON "uiliuili"."audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "background_jobs_claim_idx" ON "uiliuili"."background_jobs" USING btree ("status","run_at","priority");--> statement-breakpoint
CREATE INDEX "background_jobs_queue_idx" ON "uiliuili"."background_jobs" USING btree ("queue","status");--> statement-breakpoint
CREATE UNIQUE INDEX "background_jobs_idempotency_idx" ON "uiliuili"."background_jobs" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "categories_sort_idx" ON "uiliuili"."categories" USING btree ("sort");--> statement-breakpoint
CREATE INDEX "coin_ledger_user_idx" ON "uiliuili"."coin_ledger" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "comments_video_idx" ON "uiliuili"."comments" USING btree ("video_id","status","created_at");--> statement-breakpoint
CREATE INDEX "comments_parent_idx" ON "uiliuili"."comments" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "danmaku_video_segment_idx" ON "uiliuili"."danmaku" USING btree ("video_id","segment","progress_ms");--> statement-breakpoint
CREATE INDEX "danmaku_status_idx" ON "uiliuili"."danmaku" USING btree ("status");--> statement-breakpoint
CREATE INDEX "danmaku_user_idx" ON "uiliuili"."danmaku" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "favorite_folders_user_idx" ON "uiliuili"."favorite_folders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "follows_following_idx" ON "uiliuili"."follows" USING btree ("following_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "uiliuili"."notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "oauth_accounts_provider_uid_idx" ON "uiliuili"."oauth_accounts" USING btree ("provider","provider_account_id");--> statement-breakpoint
CREATE INDEX "oauth_accounts_user_idx" ON "uiliuili"."oauth_accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "refresh_sessions_user_idx" ON "uiliuili"."refresh_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "uiliuili"."reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "search_queries_created_idx" ON "uiliuili"."search_queries" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "upload_sessions_user_idx" ON "uiliuili"."upload_sessions" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_lower_idx" ON "uiliuili"."users" USING btree (lower("username"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_lower_idx" ON "uiliuili"."users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "users_created_at_idx" ON "uiliuili"."users" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "verification_tokens_user_type_idx" ON "uiliuili"."verification_tokens" USING btree ("user_id","type");--> statement-breakpoint
CREATE UNIQUE INDEX "video_renditions_video_quality_idx" ON "uiliuili"."video_renditions" USING btree ("video_id","quality");--> statement-breakpoint
CREATE UNIQUE INDEX "video_subtitles_video_lang_idx" ON "uiliuili"."video_subtitles" USING btree ("video_id","language");--> statement-breakpoint
CREATE INDEX "videos_status_published_idx" ON "uiliuili"."videos" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "videos_uploader_idx" ON "uiliuili"."videos" USING btree ("uploader_id");--> statement-breakpoint
CREATE INDEX "videos_category_idx" ON "uiliuili"."videos" USING btree ("category_id","status");--> statement-breakpoint
CREATE INDEX "videos_featured_idx" ON "uiliuili"."videos" USING btree ("featured");--> statement-breakpoint
CREATE INDEX "watch_events_video_idx" ON "uiliuili"."watch_events" USING btree ("video_id","created_at");--> statement-breakpoint
CREATE INDEX "watch_histories_user_idx" ON "uiliuili"."watch_histories" USING btree ("user_id","updated_at");