CREATE TABLE "uiliuili"."user_tag_interests" (
	"user_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"score" real DEFAULT 0 NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_tag_interests_user_id_tag_id_pk" PRIMARY KEY("user_id","tag_id")
);
--> statement-breakpoint
ALTER TABLE "uiliuili"."comments" ADD COLUMN "ip_region" text;--> statement-breakpoint
ALTER TABLE "uiliuili"."dynamics" ADD COLUMN "ip_region" text;--> statement-breakpoint
ALTER TABLE "uiliuili"."users" ADD COLUMN "last_region" text;--> statement-breakpoint
ALTER TABLE "uiliuili"."users" ADD COLUMN "last_region_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "uiliuili"."watch_histories" ADD COLUMN "tag_synced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "uiliuili"."user_tag_interests" ADD CONSTRAINT "user_tag_interests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "uiliuili"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "uiliuili"."user_tag_interests" ADD CONSTRAINT "user_tag_interests_tag_id_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "uiliuili"."tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_tag_interests_score_idx" ON "uiliuili"."user_tag_interests" USING btree ("user_id","score");--> statement-breakpoint
CREATE INDEX "video_tags_tag_idx" ON "uiliuili"."video_tags" USING btree ("tag_id");