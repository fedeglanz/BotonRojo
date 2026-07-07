import { pgTable, text, timestamp, pgEnum, integer, jsonb, index } from "drizzle-orm/pg-core";
import { createId } from "@/lib/ids";
import { users } from "./users";
import { launches } from "./launches";
import { organizations } from "./organizations";

export const eventType = pgEnum("event_type", [
  "visit",
  "lead",
  "sale",
  "seminar",
  "click",
  "email_open",
  "email_click",
]);

// Replaces wp_visitas + wp_datos with a single event-sourced table.
export const trackingEvents = pgTable(
  "tracking_events",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    organizationId: text("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
    occurredAt: timestamp("occurred_at", { mode: "date" }).notNull().defaultNow(),
    type: eventType("type").notNull(),

    // Visitor identity
    sessionId: text("session_id"),
    visitorCookie: text("visitor_cookie"),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    email: text("email"),
    name: text("name"),

    // Attribution
    affiliateRef: text("affiliate_ref"),
    affiliateUserId: text("affiliate_user_id").references(() => users.id, { onDelete: "set null" }),
    utmSource: text("utm_source"),
    utmMedium: text("utm_medium"),
    utmCampaign: text("utm_campaign"),
    utmContent: text("utm_content"),
    utmTerm: text("utm_term"),

    // Context
    launchId: text("launch_id").references(() => launches.id, { onDelete: "set null" }),
    pageId: text("page_id"),
    urlCurrent: text("url_current"),
    urlPrevious: text("url_previous"),

    // Sale specifics
    amountCents: integer("amount_cents"),
    currency: text("currency"),
    product: text("product"),
    stripeSessionId: text("stripe_session_id"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),

    // GeoIP
    ip: text("ip"),
    country: text("country"),
    city: text("city"),

    // Raw payload for forensics
    payload: jsonb("payload").$type<Record<string, unknown>>().default({}),
    userAgent: text("user_agent"),
  },
  (t) => ({
    occurredAtIdx: index("tracking_events_occurred_at_idx").on(t.occurredAt),
    typeIdx: index("tracking_events_type_idx").on(t.type),
    launchIdx: index("tracking_events_launch_idx").on(t.launchId),
    affiliateIdx: index("tracking_events_affiliate_idx").on(t.affiliateUserId),
    sessionIdx: index("tracking_events_session_idx").on(t.sessionId),
  }),
);

export type TrackingEvent = typeof trackingEvents.$inferSelect;
export type NewTrackingEvent = typeof trackingEvents.$inferInsert;
