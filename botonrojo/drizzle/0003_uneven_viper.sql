ALTER TABLE "organizations" ADD COLUMN "telegram_bot_token" text;--> statement-breakpoint
ALTER TABLE "launches" ADD COLUMN "telegram_chat_id" text;--> statement-breakpoint
ALTER TABLE "launches" ADD COLUMN "telegram_invite_link" text;--> statement-breakpoint
ALTER TABLE "launches" ADD COLUMN "telegram_bot_added" boolean DEFAULT false NOT NULL;