CREATE TYPE "public"."domain_status" AS ENUM('pending', 'verifying', 'active', 'failed');--> statement-breakpoint
CREATE TABLE "domains" (
	"id" text PRIMARY KEY NOT NULL,
	"launch_id" text NOT NULL,
	"hostname" text NOT NULL,
	"status" "domain_status" DEFAULT 'pending' NOT NULL,
	"is_apex" boolean DEFAULT false NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"verification_token" text NOT NULL,
	"verified_at" timestamp,
	"last_checked_at" timestamp,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "domains_hostname_unique" UNIQUE("hostname")
);
--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_launch_id_launches_id_fk" FOREIGN KEY ("launch_id") REFERENCES "public"."launches"("id") ON DELETE cascade ON UPDATE no action;