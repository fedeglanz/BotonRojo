import { pgTable, text, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { createId } from "@/lib/ids";
import { launches } from "./launches";
import { organizations } from "./organizations";

export const products = pgTable("products", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  organizationId: text("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  launchId: text("launch_id").references(() => launches.id, { onDelete: "set null" }),
  priceCents: integer("price_cents").notNull(),
  currency: text("currency").notNull().default("EUR"),
  stripePriceId: text("stripe_price_id").unique(),
  stripeProductId: text("stripe_product_id"),
  active: boolean("active").notNull().default(true),
  metadata: jsonb("metadata").$type<Record<string, string>>().default({}),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export const orders = pgTable("orders", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  organizationId: text("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  stripeSessionId: text("stripe_session_id").unique(),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  email: text("email"),
  customerName: text("customer_name"),
  productId: text("product_id").references(() => products.id, { onDelete: "set null" }),
  launchId: text("launch_id").references(() => launches.id, { onDelete: "set null" }),
  affiliateRef: text("affiliate_ref"),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("EUR"),
  status: text("status").notNull().default("pending"),
  metadata: jsonb("metadata").$type<Record<string, string>>().default({}),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export type Product = typeof products.$inferSelect;
export type Order = typeof orders.$inferSelect;
