ALTER TYPE "public"."integration_provider" ADD VALUE IF NOT EXISTS 'pdc_checkout';--> statement-breakpoint
ALTER TABLE "launches" ADD COLUMN IF NOT EXISTS "pdc_launch_id" integer;--> statement-breakpoint
ALTER TABLE "launches" ADD COLUMN IF NOT EXISTS "pdc_product_id" integer;--> statement-breakpoint
ALTER TABLE "launches" ADD COLUMN IF NOT EXISTS "pdc_price_ids" jsonb DEFAULT '[]'::jsonb;