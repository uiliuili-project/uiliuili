ALTER TABLE "uiliuili"."users" ADD COLUMN IF NOT EXISTS "terms_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "uiliuili"."users" ADD COLUMN IF NOT EXISTS "terms_version" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "uiliuili"."comments" ADD COLUMN IF NOT EXISTS "moderation" jsonb;--> statement-breakpoint
ALTER TABLE "uiliuili"."dynamics" ADD COLUMN IF NOT EXISTS "status" text DEFAULT 'visible' NOT NULL;--> statement-breakpoint
ALTER TABLE "uiliuili"."dynamics" ADD COLUMN IF NOT EXISTS "moderation" jsonb;--> statement-breakpoint
ALTER TABLE "uiliuili"."categories" ADD COLUMN IF NOT EXISTS "description" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "uiliuili"."categories" ADD COLUMN IF NOT EXISTS "icon" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "uiliuili"."categories" ADD COLUMN IF NOT EXISTS "visible" boolean DEFAULT true NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "uiliuili"."ai_moderation_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text DEFAULT '' NOT NULL,
	"user_id" uuid,
	"excerpt" text DEFAULT '' NOT NULL,
	"allowed" boolean NOT NULL,
	"decision" text NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"model" text DEFAULT '' NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"cached" boolean DEFAULT false NOT NULL,
	"error" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "uiliuili"."ai_moderation_logs" ADD CONSTRAINT "ai_moderation_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "uiliuili"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_moderation_logs_created_idx" ON "uiliuili"."ai_moderation_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ai_moderation_logs_target_idx" ON "uiliuili"."ai_moderation_logs" USING btree ("target_type","decision");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "dynamics_status_created_idx" ON "uiliuili"."dynamics" USING btree ("status","created_at");--> statement-breakpoint
UPDATE "uiliuili"."site_settings"
SET "value" = jsonb_set("value"::jsonb, '{name}', '"萌悠"'::jsonb, true)
WHERE "key" = 'site' AND "value"->>'name' = 'uiliuili';
