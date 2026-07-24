CREATE TYPE "public"."domain_status" AS ENUM('pending', 'verifying', 'active', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ad_channel" AS ENUM('meta', 'google', 'other');--> statement-breakpoint
CREATE TYPE "public"."external_sales_kind" AS ENUM('mysql', 'postgres');--> statement-breakpoint
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
	"amount_column" text,
	"date_column" text,
	"amount_divisor" integer DEFAULT 1 NOT NULL,
	"extra_filter_sql" text,
	"last_checked_at" timestamp,
	"last_check_ok" boolean,
	"last_check_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_launch_id_launches_id_fk" FOREIGN KEY ("launch_id") REFERENCES "public"."launches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_spend" ADD CONSTRAINT "ad_spend_launch_id_launches_id_fk" FOREIGN KEY ("launch_id") REFERENCES "public"."launches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_sales_sources" ADD CONSTRAINT "external_sales_sources_launch_id_launches_id_fk" FOREIGN KEY ("launch_id") REFERENCES "public"."launches"("id") ON DELETE cascade ON UPDATE no action;