import { pgTable, text, timestamp, pgEnum, jsonb, integer, boolean, index } from "drizzle-orm/pg-core";
import { createId } from "@/lib/ids";
import { organizations } from "./organizations";

export const launchType = pgEnum("launch_type", ["venta_directa", "semilla", "plf"]);
export const launchStatus = pgEnum("launch_status", ["draft", "scheduled", "live", "closed", "archived"]);

export const launches = pgTable("launches", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  organizationId: text("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  type: launchType("type").notNull(),
  status: launchStatus("status").notNull().default("draft"),

  // Marco copy
  avatar: jsonb("avatar").$type<AvatarBrief | null>(),
  promise: text("promise"),
  painPoints: jsonb("pain_points").$type<string[]>().default([]),
  benefits: jsonb("benefits").$type<string[]>().default([]),

  // Pricing / product link
  defaultPriceCents: integer("default_price_cents"),
  currency: text("currency").default("EUR"),

  // Schedule
  cartOpensAt: timestamp("cart_opens_at", { mode: "date" }),
  cartClosesAt: timestamp("cart_closes_at", { mode: "date" }),

  // Affiliate
  affiliateCommissionRate: integer("affiliate_commission_rate_bps").default(3000),
  affiliateEnabled: boolean("affiliate_enabled").notNull().default(true),

  // Generated assets cache
  assetsCache: jsonb("assets_cache").$type<Record<string, unknown>>().default({}),

  // ActiveCampaign provisioning
  activeCampaignListId: integer("active_campaign_list_id"),
  activeCampaignTagIds: jsonb("active_campaign_tag_ids").$type<Record<string, number>>().default({}),

  // Raw brief used to generate the marco copy (kept for re-generations)
  brief: text("brief"),

  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export type AvatarBrief = {
  who: string;
  age?: string;
  desires?: string[];
  fears?: string[];
  beliefs?: string[];
  context?: string;
};

export type Launch = typeof launches.$inferSelect;
export type NewLaunch = typeof launches.$inferInsert;
