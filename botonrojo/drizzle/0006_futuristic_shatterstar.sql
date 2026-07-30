CREATE TYPE "public"."brand_kit_status" AS ENUM('pending', 'draft', 'approved');--> statement-breakpoint
ALTER TABLE "launches" ADD COLUMN "brand_kit_status" "brand_kit_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "launches" ADD COLUMN "brand_palette" jsonb;--> statement-breakpoint
ALTER TABLE "launches" ADD COLUMN "brand_fonts" jsonb;--> statement-breakpoint
ALTER TABLE "launches" ADD COLUMN "brand_logo_url" text;--> statement-breakpoint
ALTER TABLE "launches" ADD COLUMN "brand_mood_image_url" text;--> statement-breakpoint
ALTER TABLE "launches" ADD COLUMN "brand_mood_notes" text;--> statement-breakpoint
ALTER TABLE "launches" ADD COLUMN "design_system_project_id" text;