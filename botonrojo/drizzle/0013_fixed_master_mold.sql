ALTER TABLE "media_items" ADD COLUMN "launch_id" text;--> statement-breakpoint
ALTER TABLE "media_items" ADD COLUMN "prompt" text;--> statement-breakpoint
ALTER TABLE "media_items" ADD COLUMN "source" text DEFAULT 'subida' NOT NULL;--> statement-breakpoint
ALTER TABLE "media_items" ADD CONSTRAINT "media_items_launch_id_launches_id_fk" FOREIGN KEY ("launch_id") REFERENCES "public"."launches"("id") ON DELETE cascade ON UPDATE no action;