CREATE TABLE "uiliuili"."collection_items" (
	"collection_id" uuid NOT NULL,
	"video_id" uuid NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_items_collection_id_video_id_pk" PRIMARY KEY("collection_id","video_id")
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"cover_url" text,
	"kind" text DEFAULT 'collection' NOT NULL,
	"visibility" text DEFAULT 'public' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_a_id" uuid NOT NULL,
	"user_b_id" uuid NOT NULL,
	"last_message_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."direct_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"content" text NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."dynamic_likes" (
	"user_id" uuid NOT NULL,
	"dynamic_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dynamic_likes_user_id_dynamic_id_pk" PRIMARY KEY("user_id","dynamic_id")
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."dynamics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"images" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"video_id" uuid,
	"topic_id" uuid,
	"visibility" text DEFAULT 'public' NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."follow_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"cover_url" text,
	"kind" text DEFAULT 'topic' NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "topics_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."user_badges" (
	"user_id" uuid NOT NULL,
	"code" text NOT NULL,
	"awarded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_badges_user_id_code_pk" PRIMARY KEY("user_id","code")
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."video_parts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL,
	"title" text DEFAULT '正片' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"source_key" text,
	"source_size" integer DEFAULT 0 NOT NULL,
	"source_filename" text,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"width" integer DEFAULT 0 NOT NULL,
	"height" integer DEFAULT 0 NOT NULL,
	"playlist_key" text,
	"sprite_key" text,
	"preview_vtt_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."video_topics" (
	"video_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	CONSTRAINT "video_topics_video_id_topic_id_pk" PRIMARY KEY("video_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "uiliuili"."watch_later" (
	"user_id" uuid NOT NULL,
	"video_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "watch_later_user_id_video_id_pk" PRIMARY KEY("user_id","video_id")
);
--> statement-breakpoint
DROP INDEX "uiliuili"."video_renditions_video_quality_idx";--> statement-breakpoint
ALTER TABLE "uiliuili"."comments" ADD COLUMN "pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "uiliuili"."comments" ADD COLUMN "pinned_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "uiliuili"."comments" ADD COLUMN "up_liked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "uiliuili"."danmaku" ADD COLUMN "part_id" uuid;--> statement-breakpoint
ALTER TABLE "uiliuili"."danmaku" ADD COLUMN "pool" text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "uiliuili"."favorite_folders" ADD COLUMN "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "uiliuili"."favorite_folders" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "uiliuili"."follows" ADD COLUMN "group_id" uuid;--> statement-breakpoint
ALTER TABLE "uiliuili"."upload_sessions" ADD COLUMN "part_id" uuid;--> statement-breakpoint
ALTER TABLE "uiliuili"."users" ADD COLUMN "experience" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "uiliuili"."video_renditions" ADD COLUMN "part_id" uuid;--> statement-breakpoint
ALTER TABLE "uiliuili"."watch_histories" ADD COLUMN "part_id" uuid;--> statement-breakpoint
ALTER TABLE "uiliuili"."collection_items" ADD CONSTRAINT "collection_items_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "uiliuili"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."collection_items" ADD CONSTRAINT "collection_items_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "uiliuili"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."collections" ADD CONSTRAINT "collections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "uiliuili"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."conversations" ADD CONSTRAINT "conversations_user_a_id_users_id_fk" FOREIGN KEY ("user_a_id") REFERENCES "uiliuili"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."conversations" ADD CONSTRAINT "conversations_user_b_id_users_id_fk" FOREIGN KEY ("user_b_id") REFERENCES "uiliuili"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."direct_messages" ADD CONSTRAINT "direct_messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "uiliuili"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."direct_messages" ADD CONSTRAINT "direct_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "uiliuili"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."dynamic_likes" ADD CONSTRAINT "dynamic_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "uiliuili"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."dynamic_likes" ADD CONSTRAINT "dynamic_likes_dynamic_id_dynamics_id_fk" FOREIGN KEY ("dynamic_id") REFERENCES "uiliuili"."dynamics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."dynamics" ADD CONSTRAINT "dynamics_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "uiliuili"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."dynamics" ADD CONSTRAINT "dynamics_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "uiliuili"."videos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."dynamics" ADD CONSTRAINT "dynamics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "uiliuili"."topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."follow_groups" ADD CONSTRAINT "follow_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "uiliuili"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "uiliuili"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."user_badges" ADD CONSTRAINT "user_badges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "uiliuili"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."video_parts" ADD CONSTRAINT "video_parts_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "uiliuili"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."video_topics" ADD CONSTRAINT "video_topics_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "uiliuili"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."video_topics" ADD CONSTRAINT "video_topics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "uiliuili"."topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."watch_later" ADD CONSTRAINT "watch_later_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "uiliuili"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."watch_later" ADD CONSTRAINT "watch_later_video_id_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "uiliuili"."videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collection_items_sort_idx" ON "uiliuili"."collection_items" USING btree ("collection_id","sort");--> statement-breakpoint
CREATE INDEX "collections_user_idx" ON "uiliuili"."collections" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "collections_visibility_idx" ON "uiliuili"."collections" USING btree ("visibility","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_pair_idx" ON "uiliuili"."conversations" USING btree ("user_a_id","user_b_id");--> statement-breakpoint
CREATE INDEX "conversations_last_idx" ON "uiliuili"."conversations" USING btree ("last_message_at");--> statement-breakpoint
CREATE INDEX "direct_messages_conversation_idx" ON "uiliuili"."direct_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "dynamics_created_idx" ON "uiliuili"."dynamics" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "dynamics_user_idx" ON "uiliuili"."dynamics" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "dynamics_topic_idx" ON "uiliuili"."dynamics" USING btree ("topic_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "follow_groups_user_name_idx" ON "uiliuili"."follow_groups" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_idx" ON "uiliuili"."push_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "topics_kind_idx" ON "uiliuili"."topics" USING btree ("kind","created_at");--> statement-breakpoint
CREATE INDEX "video_parts_video_sort_idx" ON "uiliuili"."video_parts" USING btree ("video_id","sort");--> statement-breakpoint
CREATE INDEX "video_parts_status_idx" ON "uiliuili"."video_parts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "watch_later_user_idx" ON "uiliuili"."watch_later" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "uiliuili"."danmaku" ADD CONSTRAINT "danmaku_part_id_video_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "uiliuili"."video_parts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."follows" ADD CONSTRAINT "follows_group_id_follow_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "uiliuili"."follow_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."upload_sessions" ADD CONSTRAINT "upload_sessions_part_id_video_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "uiliuili"."video_parts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."video_renditions" ADD CONSTRAINT "video_renditions_part_id_video_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "uiliuili"."video_parts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."watch_histories" ADD CONSTRAINT "watch_histories_part_id_video_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "uiliuili"."video_parts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "danmaku_part_segment_idx" ON "uiliuili"."danmaku" USING btree ("part_id","segment","progress_ms");--> statement-breakpoint
CREATE INDEX "follows_group_idx" ON "uiliuili"."follows" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "video_renditions_video_quality_idx" ON "uiliuili"."video_renditions" USING btree ("video_id","part_id","quality");