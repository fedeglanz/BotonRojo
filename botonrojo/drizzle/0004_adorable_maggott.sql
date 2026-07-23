ALTER TABLE "external_sales_sources" ADD COLUMN "amount_column" text;--> statement-breakpoint
ALTER TABLE "external_sales_sources" ADD COLUMN "date_column" text;--> statement-breakpoint
ALTER TABLE "external_sales_sources" ADD COLUMN "amount_divisor" integer DEFAULT 1 NOT NULL;