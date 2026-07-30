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
ALTER TABLE "organization_integrations" ADD CONSTRAINT "organization_integrations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;