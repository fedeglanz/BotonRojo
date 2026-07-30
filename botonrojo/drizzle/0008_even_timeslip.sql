ALTER TABLE "users" ALTER COLUMN "organization_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "launches" ALTER COLUMN "organization_id" SET NOT NULL;