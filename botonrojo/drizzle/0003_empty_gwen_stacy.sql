CREATE TYPE "public"."external_sales_kind" AS ENUM('mysql', 'postgres');--> statement-breakpoint
CREATE TABLE "external_sales_sources" (
	"id" text PRIMARY KEY NOT NULL,
	"launch_id" text NOT NULL,
	"label" text NOT NULL,
	"kind" "external_sales_kind" NOT NULL,
	"host" text NOT NULL,
	"port" integer NOT NULL,
	"database" text NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"sales_table_hint" text,
	"last_checked_at" timestamp,
	"last_check_ok" boolean,
	"last_check_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "external_sales_sources" ADD CONSTRAINT "external_sales_sources_launch_id_launches_id_fk" FOREIGN KEY ("launch_id") REFERENCES "public"."launches"("id") ON DELETE cascade ON UPDATE no action;