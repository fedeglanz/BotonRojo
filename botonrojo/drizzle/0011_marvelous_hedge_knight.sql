CREATE TYPE "public"."launch_task_kind" AS ENUM('design_system', 'page');--> statement-breakpoint
CREATE TYPE "public"."launch_task_status" AS ENUM('pending', 'done', 'skipped');--> statement-breakpoint
CREATE TABLE "launch_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"launch_id" text NOT NULL,
	"kind" "launch_task_kind" NOT NULL,
	"page_key" text,
	"label" text NOT NULL,
	"instruction" text,
	"status" "launch_task_status" DEFAULT 'pending' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"result" text,
	"done_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "launches" ADD COLUMN "design_mode" text DEFAULT 'boton_rojo' NOT NULL;--> statement-breakpoint
ALTER TABLE "launch_tasks" ADD CONSTRAINT "launch_tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "launch_tasks" ADD CONSTRAINT "launch_tasks_launch_id_launches_id_fk" FOREIGN KEY ("launch_id") REFERENCES "public"."launches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "launch_tasks_pending_idx" ON "launch_tasks" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "launch_tasks_launch_idx" ON "launch_tasks" USING btree ("launch_id");