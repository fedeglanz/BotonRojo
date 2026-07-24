import { pgTable, text, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createId } from "@/lib/ids";
import { launches } from "./launches";

export const externalSalesKind = pgEnum("external_sales_kind", ["mysql", "postgres"]);

/**
 * Read-only connection to a sales DB that lives outside this app — e.g. a
 * legacy WordPress/ThriveCart site, or another cart platform a client already
 * uses for a given launch. Mirrors the per-launch external credentials the
 * old endtrack plugin stored, minus the dynamic-column hacks.
 */
export const externalSalesSources = pgTable("external_sales_sources", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  launchId: text("launch_id")
    .notNull()
    .references(() => launches.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  kind: externalSalesKind("kind").notNull(),
  host: text("host").notNull(),
  port: integer("port").notNull(),
  database: text("database").notNull(),
  username: text("username").notNull(),
  password: text("password").notNull(),
  salesTableHint: text("sales_table_hint"),
  amountColumn: text("amount_column"),
  dateColumn: text("date_column"),
  amountDivisor: integer("amount_divisor").notNull().default(1),
  extraFilterSql: text("extra_filter_sql"),

  lastCheckedAt: timestamp("last_checked_at", { mode: "date" }),
  lastCheckOk: boolean("last_check_ok"),
  lastCheckMessage: text("last_check_message"),

  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export type ExternalSalesSource = typeof externalSalesSources.$inferSelect;
export type NewExternalSalesSource = typeof externalSalesSources.$inferInsert;
