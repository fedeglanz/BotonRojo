import { pgTable, text, date, integer, pgEnum, timestamp } from "drizzle-orm/pg-core";
import { createId } from "@/lib/ids";
import { launches } from "./launches";
import { organizations } from "./organizations";

export const adChannel = pgEnum("ad_channel", ["meta", "google", "other"]);

export const adSpend = pgTable("ad_spend", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  organizationId: text("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  launchId: text("launch_id")
    .notNull()
    .references(() => launches.id, { onDelete: "cascade" }),
  channel: adChannel("channel").notNull(),
  spendDate: date("spend_date", { mode: "date" }).notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("EUR"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export type AdSpend = typeof adSpend.$inferSelect;
export type NewAdSpend = typeof adSpend.$inferInsert;
export type AdChannel = (typeof adChannel.enumValues)[number];
