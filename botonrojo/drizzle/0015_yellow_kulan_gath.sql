ALTER TYPE "public"."integration_provider" ADD VALUE 'pdc_checkout';--> statement-breakpoint
ALTER TABLE "launches" ADD COLUMN "pdc_launch_id" integer;--> statement-breakpoint
ALTER TABLE "launches" ADD COLUMN "pdc_product_id" integer;--> statement-breakpoint
ALTER TABLE "launches" ADD COLUMN "pdc_price_ids" jsonb DEFAULT '[]'::jsonb;