import { pgTable, text, timestamp, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { createId } from "@/lib/ids";
import { launches } from "./launches";
import { users } from "./users";

export const assetKind = pgEnum("asset_kind", [
  "landing",
  "email",
  "ad_copy",
  "ad_image",
  "ad_video_script",
  "telegram_message",
  "banner_social",
  "lead_magnet",
  "popup",
  "tag",
  "automation",
]);

export const assets = pgTable("assets", {
  id: text("id").primaryKey().$defaultFn(() => createId()),
  launchId: text("launch_id").references(() => launches.id, { onDelete: "cascade" }),
  kind: assetKind("kind").notNull(),
  title: text("title").notNull(),
  body: jsonb("body").$type<Record<string, unknown>>().notNull(),
  fileUrl: text("file_url"),
  authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
  generatedByAi: text("generated_by_ai"),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
