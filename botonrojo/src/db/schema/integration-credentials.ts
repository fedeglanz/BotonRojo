import { pgTable, text, timestamp, pgEnum, unique } from "drizzle-orm/pg-core";
import { createId } from "@/lib/ids";
import { organizations } from "./organizations";

export const integrationProvider = pgEnum("integration_provider", [
  "stripe",
  "activecampaign",
  "meta",
  "google_ads",
  "telegram",
  "notion",
  "youtube",
  "pdc_checkout",
]);

/**
 * One row per (organization, provider). `encryptedPayload` is a JSON blob
 * (shape varies per provider — Stripe needs secret_key/webhook_secret/
 * publishable_key, ActiveCampaign needs api_url/api_key/from_name/from_email,
 * the rest just a single token) encrypted as one unit with
 * src/lib/crypto.ts. `maskedPreview` is computed at save time so the UI can
 * show "connected as sk_live_…4242" without ever decrypting for display.
 */
export const organizationIntegrations = pgTable(
  "organization_integrations",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    provider: integrationProvider("provider").notNull(),
    encryptedPayload: text("encrypted_payload").notNull(),
    maskedPreview: text("masked_preview").notNull(),
    connectedAt: timestamp("connected_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    perOrgProvider: unique().on(t.organizationId, t.provider),
  }),
);

export type OrganizationIntegration = typeof organizationIntegrations.$inferSelect;
export type IntegrationProvider = (typeof integrationProvider.enumValues)[number];
