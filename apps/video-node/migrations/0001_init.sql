-- Video node owns its own PostgreSQL database. Nothing here is shared with the
-- site database; the site only stores the remote asset identifiers.

CREATE TABLE IF NOT EXISTS "assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "status" text DEFAULT 'created' NOT NULL,
  "filename" text NOT NULL,
  "content_type" text DEFAULT 'application/octet-stream' NOT NULL,
  "size" bigint DEFAULT 0 NOT NULL,
  "source_key" text NOT NULL,
  "hls_key" text,
  "cover_key" text,
  "duration_seconds" integer DEFAULT 0 NOT NULL,
  "width" integer DEFAULT 0 NOT NULL,
  "height" integer DEFAULT 0 NOT NULL,
  "profile" text DEFAULT 'auto' NOT NULL,
  "constraints" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "progress" integer DEFAULT 0 NOT NULL,
  "error" text,
  "imported_from" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "upload_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "asset_id" uuid NOT NULL REFERENCES "assets"("id") ON DELETE CASCADE,
  "part_size" bigint NOT NULL,
  "total_parts" integer NOT NULL,
  "status" text DEFAULT 'uploading' NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "uploaded_parts" (
  "upload_id" uuid NOT NULL REFERENCES "upload_sessions"("id") ON DELETE CASCADE,
  "part_number" integer NOT NULL,
  "size" integer NOT NULL,
  "etag" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("upload_id", "part_number")
);

CREATE TABLE IF NOT EXISTS "transcode_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "asset_id" uuid NOT NULL REFERENCES "assets"("id") ON DELETE CASCADE,
  "profile" text DEFAULT 'auto' NOT NULL,
  "constraints" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "progress" integer DEFAULT 0 NOT NULL,
  "error" text,
  "started_at" timestamp with time zone,
  "finished_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "transcode_outputs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "asset_id" uuid NOT NULL REFERENCES "assets"("id") ON DELETE CASCADE,
  "job_id" uuid REFERENCES "transcode_jobs"("id") ON DELETE SET NULL,
  "quality" text NOT NULL,
  "width" integer NOT NULL,
  "height" integer NOT NULL,
  "bitrate" integer NOT NULL,
  "playlist_key" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "request_nonces" (
  "nonce" text PRIMARY KEY NOT NULL,
  "key_id" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "action" text NOT NULL,
  "actor" text DEFAULT 'system' NOT NULL,
  "target" text DEFAULT '' NOT NULL,
  "detail" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "assets_status_idx" ON "assets" ("status", "updated_at");
CREATE INDEX IF NOT EXISTS "upload_sessions_asset_idx" ON "upload_sessions" ("asset_id");
CREATE INDEX IF NOT EXISTS "transcode_jobs_status_idx" ON "transcode_jobs" ("status", "created_at");
CREATE INDEX IF NOT EXISTS "transcode_outputs_asset_idx" ON "transcode_outputs" ("asset_id");
CREATE INDEX IF NOT EXISTS "request_nonces_expires_idx" ON "request_nonces" ("expires_at");
