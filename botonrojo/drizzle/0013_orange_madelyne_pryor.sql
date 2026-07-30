ALTER TABLE "launches" ADD COLUMN "page_config" jsonb;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "page_key" text DEFAULT 'main' NOT NULL;