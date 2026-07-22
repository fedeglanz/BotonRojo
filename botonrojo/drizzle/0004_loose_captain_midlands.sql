CREATE TYPE "public"."milestone_phase" AS ENUM('pre_captacion', 'captacion', 'calentamiento', 'apertura_carrito', 'venta', 'cierre_carrito', 'evento_vivo', 'replay', 'pre_pre_lanzamiento', 'plc_1', 'plc_2', 'plc_3', 'plc_4', 'urgencia');--> statement-breakpoint
CREATE TABLE "launch_milestones" (
	"id" text PRIMARY KEY NOT NULL,
	"launch_id" text NOT NULL,
	"phase" "milestone_phase" NOT NULL,
	"label" text NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"ai_warnings" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "launches" ADD COLUMN "primary_country" text;--> statement-breakpoint
ALTER TABLE "launches" ADD COLUMN "target_regions" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "launches" ADD COLUMN "anchor_date" timestamp;--> statement-breakpoint
ALTER TABLE "launch_milestones" ADD CONSTRAINT "launch_milestones_launch_id_launches_id_fk" FOREIGN KEY ("launch_id") REFERENCES "public"."launches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "milestones_launch_idx" ON "launch_milestones" USING btree ("launch_id");