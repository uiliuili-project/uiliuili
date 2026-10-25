ALTER TABLE "uiliuili"."users" ADD COLUMN "user_group" text DEFAULT 'USER' NOT NULL;--> statement-breakpoint
CREATE INDEX "users_group_idx" ON "uiliuili"."users" USING btree ("user_group");--> statement-breakpoint
UPDATE "uiliuili"."users" SET "user_group" = 'ADMIN' WHERE "roles" && ARRAY['ADMIN', 'SUPER_ADMIN']::text[];--> statement-breakpoint
UPDATE "uiliuili"."users" SET "user_group" = 'CREATOR' WHERE "user_group" = 'USER' AND "roles" && ARRAY['UPLOADER', 'REVIEWER']::text[];