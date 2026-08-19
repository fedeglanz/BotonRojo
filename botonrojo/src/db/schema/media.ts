import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createId } from "@/lib/ids";
import { organizations } from "./organizations";
import { launches } from "./launches";
import { users } from "./users";

/**
 * Per-client library of source photos the admin uploads (e.g. photos of the
 * client themselves) to be used as backgrounds for generated static ads.
 * Its own table rather than an `assets` row because these are *inputs*, not
 * generated output — and `assets.body` is notNull, which would force a
 * meaningless `{}` on every photo.
 *
 * Cada foto es de un lanzamiento. Empezó siendo una biblioteca por cuenta, y con dos
 * lanzamientos a la vez eso es un cajón: al componer un estático había que elegir
 * entre las fotos de todos, incluidas las del cliente de otra campaña.
 *
 * `launchId` admite nulo porque las que ya estaban subidas no se pueden repartir sin
 * inventar: se quedan como fotos de la cuenta, se siguen pudiendo usar en cualquier
 * lanzamiento y las nuevas ya nacen con el suyo.
 */
export const mediaItems = pgTable("media_items", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  launchId: text("launch_id").references(() => launches.id, {
    onDelete: "cascade",
  }),
  url: text("url").notNull(),
  storageKey: text("storage_key").notNull(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  label: text("label"),
  /** Lo que se le pidió a Magnific, si la foto la generó ella. */
  prompt: text("prompt"),
  /** "subida" o "magnific". */
  source: text("source").notNull().default("subida"),
  uploadedBy: text("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
});

export type MediaItem = typeof mediaItems.$inferSelect;
export type NewMediaItem = typeof mediaItems.$inferInsert;
