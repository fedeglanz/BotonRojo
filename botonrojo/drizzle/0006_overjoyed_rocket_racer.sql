CREATE TYPE "public"."brand_kit_status" AS ENUM('pending', 'draft', 'approved');--> statement-breakpoint
CREATE TYPE "public"."integration_provider" AS ENUM('stripe', 'activecampaign', 'meta', 'google_ads', 'telegram', 'notion', 'youtube');--> statement-breakpoint
CREATE TABLE "organization_integrations" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"provider" "integration_provider" NOT NULL,
	"encrypted_payload" text NOT NULL,
	"masked_preview" text NOT NULL,
	"connected_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_integrations_organization_id_provider_unique" UNIQUE("organization_id","provider")
);
--> statement-breakpoint
CREATE TABLE "media_items" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"url" text NOT NULL,
	"storage_key" text NOT NULL,
	"filename" text NOT NULL,
	"mime_type" text NOT NULL,
	"label" text,
	"uploaded_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" DROP CONSTRAINT "users_organization_id_organizations_id_fk";
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "launches" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_super_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "launches" ADD COLUMN "content_drip_starts_at" timestamp;--> statement-breakpoint
ALTER TABLE "launches" ADD COLUMN "brand_kit_status" "brand_kit_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "launches" ADD COLUMN "brand_palette" jsonb;--> statement-breakpoint
ALTER TABLE "launches" ADD COLUMN "brand_fonts" jsonb;--> statement-breakpoint
ALTER TABLE "launches" ADD COLUMN "brand_logo_url" text;--> statement-breakpoint
ALTER TABLE "launches" ADD COLUMN "brand_mood_image_url" text;--> statement-breakpoint
ALTER TABLE "launches" ADD COLUMN "brand_mood_notes" text;--> statement-breakpoint
ALTER TABLE "launches" ADD COLUMN "design_system_project_id" text;--> statement-breakpoint
ALTER TABLE "launches" ADD COLUMN "landing_general_instructions" text;--> statement-breakpoint
ALTER TABLE "launches" ADD COLUMN "reference_url" text;--> statement-breakpoint
ALTER TABLE "launches" ADD COLUMN "page_config" jsonb;--> statement-breakpoint
ALTER TABLE "affiliate_links" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "affiliate_payouts" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "page_key" text DEFAULT 'main' NOT NULL;--> statement-breakpoint
ALTER TABLE "assets" ADD COLUMN "design_review" jsonb;--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "ad_spend" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "external_sales_sources" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "organization_integrations" ADD CONSTRAINT "organization_integrations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_items" ADD CONSTRAINT "media_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_items" ADD CONSTRAINT "media_items_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_links" ADD CONSTRAINT "affiliate_links_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_payouts" ADD CONSTRAINT "affiliate_payouts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_spend" ADD CONSTRAINT "ad_spend_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_sales_sources" ADD CONSTRAINT "external_sales_sources_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tracking_events_organization_idx" ON "tracking_events" USING btree ("organization_id");