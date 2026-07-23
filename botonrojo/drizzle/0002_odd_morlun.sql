CREATE TYPE "public"."ad_channel" AS ENUM('meta', 'google', 'other');--> statement-breakpoint
CREATE TABLE "ad_spend" (
	"id" text PRIMARY KEY NOT NULL,
	"launch_id" text NOT NULL,
	"channel" "ad_channel" NOT NULL,
	"spend_date" date NOT NULL,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ad_spend" ADD CONSTRAINT "ad_spend_launch_id_launches_id_fk" FOREIGN KEY ("launch_id") REFERENCES "public"."launches"("id") ON DELETE cascade ON UPDATE no action;