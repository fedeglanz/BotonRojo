CREATE TYPE "public"."user_role" AS ENUM('admin', 'affiliate', 'customer');--> statement-breakpoint
CREATE TYPE "public"."launch_status" AS ENUM('draft', 'scheduled', 'live', 'closed', 'archived');--> statement-breakpoint
CREATE TYPE "public"."launch_type" AS ENUM('venta_directa', 'semilla', 'plf');--> statement-breakpoint
CREATE TYPE "public"."event_type" AS ENUM('visit', 'lead', 'sale', 'seminar', 'click', 'email_open', 'email_click');--> statement-breakpoint
CREATE TYPE "public"."asset_kind" AS ENUM('landing', 'email', 'ad_copy', 'ad_image', 'ad_video_script', 'telegram_message', 'banner_social', 'lead_magnet', 'popup', 'tag', 'automation');--> statement-breakpoint
CREATE TABLE "accounts" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "accounts_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"email_verified" timestamp,
	"name" text,
	"image" text,
	"role" "user_role" DEFAULT 'customer' NOT NULL,
	"password_hash" text,
	"affiliate_code" text,
	"affiliate_commission_rate_bps" integer DEFAULT 3000,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_affiliate_code_unique" UNIQUE("affiliate_code")
);
--> statement-breakpoint
CREATE TABLE "verification_tokens" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "verification_tokens_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE "launches" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"type" "launch_type" NOT NULL,
	"status" "launch_status" DEFAULT 'draft' NOT NULL,
	"avatar" jsonb,
	"promise" text,
	"pain_points" jsonb DEFAULT '[]'::jsonb,
	"benefits" jsonb DEFAULT '[]'::jsonb,
	"default_price_cents" integer,
	"currency" text DEFAULT 'EUR',
	"cart_opens_at" timestamp,
	"cart_closes_at" timestamp,
	"affiliate_commission_rate_bps" integer DEFAULT 3000,
	"affiliate_enabled" boolean DEFAULT true NOT NULL,
	"assets_cache" jsonb DEFAULT '{}'::jsonb,
	"active_campaign_list_id" integer,
	"active_campaign_tag_ids" jsonb DEFAULT '{}'::jsonb,
	"brief" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "launches_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "affiliate_links" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"launch_id" text,
	"slug" text NOT NULL,
	"destination_url" text NOT NULL,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_content" text,
	"utm_term" text,
	"meta" jsonb DEFAULT '{}'::jsonb,
	"clicks" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "affiliate_links_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "affiliate_payouts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"launch_id" text,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"reference" text,
	"notes" text,
	"paid_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracking_events" (
	"id" text PRIMARY KEY NOT NULL,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	"type" "event_type" NOT NULL,
	"session_id" text,
	"visitor_cookie" text,
	"user_id" text,
	"email" text,
	"name" text,
	"affiliate_ref" text,
	"affiliate_user_id" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_content" text,
	"utm_term" text,
	"launch_id" text,
	"page_id" text,
	"url_current" text,
	"url_previous" text,
	"amount_cents" integer,
	"currency" text,
	"product" text,
	"stripe_session_id" text,
	"stripe_payment_intent_id" text,
	"ip" text,
	"country" text,
	"city" text,
	"payload" jsonb DEFAULT '{}'::jsonb,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"stripe_session_id" text,
	"stripe_payment_intent_id" text,
	"email" text,
	"customer_name" text,
	"product_id" text,
	"launch_id" text,
	"affiliate_ref" text,
	"amount_cents" integer NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "orders_stripe_session_id_unique" UNIQUE("stripe_session_id")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"launch_id" text,
	"price_cents" integer NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"stripe_price_id" text,
	"stripe_product_id" text,
	"active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug"),
	CONSTRAINT "products_stripe_price_id_unique" UNIQUE("stripe_price_id")
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" text PRIMARY KEY NOT NULL,
	"launch_id" text,
	"kind" "asset_kind" NOT NULL,
	"title" text NOT NULL,
	"body" jsonb NOT NULL,
	"file_url" text,
	"author_id" text,
	"generated_by_ai" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_links" ADD CONSTRAINT "affiliate_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_links" ADD CONSTRAINT "affiliate_links_launch_id_launches_id_fk" FOREIGN KEY ("launch_id") REFERENCES "public"."launches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_payouts" ADD CONSTRAINT "affiliate_payouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "affiliate_payouts" ADD CONSTRAINT "affiliate_payouts_launch_id_launches_id_fk" FOREIGN KEY ("launch_id") REFERENCES "public"."launches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_affiliate_user_id_users_id_fk" FOREIGN KEY ("affiliate_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_events" ADD CONSTRAINT "tracking_events_launch_id_launches_id_fk" FOREIGN KEY ("launch_id") REFERENCES "public"."launches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_launch_id_launches_id_fk" FOREIGN KEY ("launch_id") REFERENCES "public"."launches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_launch_id_launches_id_fk" FOREIGN KEY ("launch_id") REFERENCES "public"."launches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_launch_id_launches_id_fk" FOREIGN KEY ("launch_id") REFERENCES "public"."launches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tracking_events_occurred_at_idx" ON "tracking_events" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "tracking_events_type_idx" ON "tracking_events" USING btree ("type");--> statement-breakpoint
CREATE INDEX "tracking_events_launch_idx" ON "tracking_events" USING btree ("launch_id");--> statement-breakpoint
CREATE INDEX "tracking_events_affiliate_idx" ON "tracking_events" USING btree ("affiliate_user_id");--> statement-breakpoint
CREATE INDEX "tracking_events_session_idx" ON "tracking_events" USING btree ("session_id");