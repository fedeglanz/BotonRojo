import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createId } from "@/lib/ids";
import { organizations } from "./organizations";
import { users } from "./users";

/**
 * Per-client library of source photos the admin uploads (e.g. photos of the
 * client themselves) to be used as backgrounds for generated static ads.
 * Its own table rather than an `assets` row because these are *inputs*, not
 * generated output — and `assets.body` is notNull, which would force a
 * meaningless `{}` on every photo.
 */
export const mediaItems = pgTable("media_items", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  storageKey: text("storage_key").notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  label: text("label"),
  uploadedBy: text("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export type MediaItem = typeof mediaItems.$inferSelect;
export type NewMediaItem = typeof mediaItems.$inferInsert;
