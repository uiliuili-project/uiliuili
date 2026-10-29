ALTER TABLE "uiliuili"."users" ADD COLUMN "region" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "uiliuili"."users" ADD COLUMN "region_source" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "uiliuili"."users" ADD COLUMN "show_restricted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "uiliuili"."videos" ADD COLUMN "restricted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "uiliuili"."videos" ADD COLUMN "region_mode" text DEFAULT 'inherit' NOT NULL;--> statement-breakpoint
ALTER TABLE "uiliuili"."videos" ADD COLUMN "region_codes" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "uiliuili"."videos" ADD COLUMN "region_deny_behavior" text DEFAULT 'default' NOT NULL;--> statement-breakpoint
ALTER TABLE "uiliuili"."videos" ADD COLUMN "region_deny_message" text DEFAULT '' NOT NULL;