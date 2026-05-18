import { pgTable, text, timestamp, integer, jsonb, decimal } from "drizzle-orm/pg-core";
import { createId } from "@/lib/ids";
import { users } from "./users";
import { launches } from "./launches";

export const affiliatePayouts = pgTable("affiliate_payouts", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  launchId: text("launch_id").references(() => launches.id, { onDelete: "set null" }),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("EUR"),
  reference: text("reference"),
  notes: text("notes"),
  paidAt: timestamp("paid_at", { mode: "date" }).notNull().defaultNow(),
});

export const affiliateLinks = pgTable("affiliate_links", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  launchId: text("launch_id").references(() => launches.id, { onDelete: "set null" }),
  slug: text("slug").notNull().unique(),
  destinationUrl: text("destination_url").notNull(),
  utmSource: text("utm_source"),
  utmMedium: text("utm_medium"),
  utmCampaign: text("utm_campaign"),
  utmContent: text("utm_content"),
  utmTerm: text("utm_term"),
  meta: jsonb("meta").$type<Record<string, string>>().default({}),
  clicks: integer("clicks").notNull().default(0),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export type AffiliatePayout = typeof affiliatePayouts.$inferSelect;
export type AffiliateLink = typeof affiliateLinks.$inferSelect;
