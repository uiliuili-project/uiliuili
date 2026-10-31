-- External video nodes. The site stores node credentials, remote identifiers and
-- replica mappings only; absolute file paths stay on each node.
CREATE TABLE IF NOT EXISTS "uiliuili"."video_nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"base_url" text NOT NULL,
	"key_id" text DEFAULT 'default' NOT NULL,
	"secret_encrypted" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"region" text DEFAULT '' NOT NULL,
	"regions" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"weight" integer DEFAULT 100 NOT NULL,
	"max_concurrency" integer DEFAULT 2 NOT NULL,
	"status" text DEFAULT 'unknown' NOT NULL,
	"version" text DEFAULT '' NOT NULL,
	"storage_used_bytes" bigint DEFAULT 0 NOT NULL,
	"storage_capacity_bytes" bigint DEFAULT 0 NOT NULL,
	"last_seen_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "video_nodes_enabled_idx" ON "uiliuili"."video_nodes" ("enabled", "status");--> statement-breakpoint
ALTER TABLE "uiliuili"."videos" ADD COLUMN IF NOT EXISTS "storage_mode" text DEFAULT 'local' NOT NULL;--> statement-breakpoint
ALTER TABLE "uiliuili"."videos" ADD COLUMN IF NOT EXISTS "primary_node_id" uuid REFERENCES "uiliuili"."video_nodes"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "uiliuili"."videos" ADD COLUMN IF NOT EXISTS "remote_asset_id" text;--> statement-breakpoint
ALTER TABLE "uiliuili"."video_parts" ADD COLUMN IF NOT EXISTS "storage_mode" text DEFAULT 'local' NOT NULL;--> statement-breakpoint
ALTER TABLE "uiliuili"."video_parts" ADD COLUMN IF NOT EXISTS "primary_node_id" uuid REFERENCES "uiliuili"."video_nodes"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "uiliuili"."video_parts" ADD COLUMN IF NOT EXISTS "remote_asset_id" text;--> statement-breakpoint
ALTER TABLE "uiliuili"."upload_sessions" ADD COLUMN IF NOT EXISTS "node_id" uuid REFERENCES "uiliuili"."video_nodes"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "uiliuili"."upload_sessions" ADD COLUMN IF NOT EXISTS "remote_upload_id" text;--> statement-breakpoint
ALTER TABLE "uiliuili"."upload_sessions" ADD COLUMN IF NOT EXISTS "remote_asset_id" text;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "uiliuili"."video_node_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"video_id" uuid NOT NULL REFERENCES "uiliuili"."videos"("id") ON DELETE CASCADE,
	"part_id" uuid REFERENCES "uiliuili"."video_parts"("id") ON DELETE CASCADE,
	"node_id" uuid NOT NULL REFERENCES "uiliuili"."video_nodes"("id") ON DELETE CASCADE,
	"remote_asset_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"profile" text DEFAULT 'auto' NOT NULL,
	"duration_seconds" integer DEFAULT 0 NOT NULL,
	"width" integer DEFAULT 0 NOT NULL,
	"height" integer DEFAULT 0 NOT NULL,
	"error" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "video_node_assets_node_remote_unique" UNIQUE ("node_id", "remote_asset_id")
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "video_node_assets_video_idx" ON "uiliuili"."video_node_assets" ("video_id", "part_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "video_node_assets_status_idx" ON "uiliuili"."video_node_assets" ("status", "updated_at");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "uiliuili"."video_node_upload_leases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"upload_session_id" uuid NOT NULL REFERENCES "uiliuili"."upload_sessions"("id") ON DELETE CASCADE,
	"node_id" uuid NOT NULL REFERENCES "uiliuili"."video_nodes"("id") ON DELETE CASCADE,
	"remote_upload_id" text NOT NULL,
	"remote_asset_id" text NOT NULL,
	"status" text DEFAULT 'uploading' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "video_node_upload_leases_session_idx" ON "uiliuili"."video_node_upload_leases" ("upload_session_id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "uiliuili"."video_node_replication_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"asset_id" uuid NOT NULL REFERENCES "uiliuili"."video_node_assets"("id") ON DELETE CASCADE,
	"source_node_id" uuid NOT NULL REFERENCES "uiliuili"."video_nodes"("id") ON DELETE CASCADE,
	"target_node_id" uuid NOT NULL REFERENCES "uiliuili"."video_nodes"("id") ON DELETE CASCADE,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"attempts" integer DEFAULT 0 NOT NULL,
	"remote_asset_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "video_node_replication_status_idx" ON "uiliuili"."video_node_replication_jobs" ("status", "created_at");--> statement-breakpoint
