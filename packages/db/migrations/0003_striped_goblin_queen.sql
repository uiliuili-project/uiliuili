WITH ranked AS (
  SELECT "id", row_number() OVER (ORDER BY "created_at", "id") AS rn
  FROM "uiliuili"."users"
  WHERE "roles" @> ARRAY['SUPER_ADMIN']::text[]
)
UPDATE "uiliuili"."users" AS u
SET "roles" = ARRAY['ADMIN']::text[], "user_group" = 'ADMIN'
FROM ranked
WHERE u."id" = ranked."id" AND ranked.rn > 1;--> statement-breakpoint
UPDATE "uiliuili"."users" SET "user_group" = 'OWNER'
WHERE "roles" @> ARRAY['SUPER_ADMIN']::text[];--> statement-breakpoint
UPDATE "uiliuili"."users" SET "user_group" = 'ADMIN'
WHERE "user_group" <> 'OWNER' AND "roles" @> ARRAY['ADMIN']::text[];--> statement-breakpoint
UPDATE "uiliuili"."users" SET "user_group" = 'REVIEWER'
WHERE "user_group" NOT IN ('OWNER', 'ADMIN') AND "roles" @> ARRAY['REVIEWER']::text[];--> statement-breakpoint
UPDATE "uiliuili"."users" SET "user_group" = 'CREATOR'
WHERE "user_group" NOT IN ('OWNER', 'ADMIN', 'REVIEWER') AND "roles" @> ARRAY['UPLOADER']::text[];--> statement-breakpoint
UPDATE "uiliuili"."users" SET "user_group" = 'USER'
WHERE "user_group" NOT IN ('OWNER', 'ADMIN', 'REVIEWER', 'CREATOR');--> statement-breakpoint
CREATE UNIQUE INDEX "users_single_owner_idx" ON "uiliuili"."users" USING btree ("user_group") WHERE "uiliuili"."users"."user_group" = 'OWNER';
