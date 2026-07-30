import { pgTable, text, timestamp, pgEnum, boolean } from "drizzle-orm/pg-core";
import { createId } from "@/lib/ids";
import { launches } from "./launches";
import { organizations } from "./organizations";

export const domainStatus = pgEnum("domain_status", ["pending", "verifying", "active", "failed"]);

export const domains = pgTable("domains", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  organizationId: text("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  launchId: text("launch_id")
    .notNull()
    .references(() => launches.id, { onDelete: "cascade" }),
  hostname: text("hostname").notNull().unique(),
  status: domainStatus("status").notNull().default("pending"),
  isApex: boolean("is_apex").notNull().default(false),
  isPrimary: boolean("is_primary").notNull().default(false),

  // Ownership verification (DNS TXT record) — required before Caddy will issue TLS for it.
  verificationToken: text("verification_token").notNull(),
  verifiedAt: timestamp("verified_at", { mode: "date" }),

  lastCheckedAt: timestamp("last_checked_at", { mode: "date" }),
  lastError: text("last_error"),

  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export type Domain = typeof domains.$inferSelect;
export type NewDomain = typeof domains.$inferInsert;
export type DomainStatus = (typeof domainStatus.enumValues)[number];
