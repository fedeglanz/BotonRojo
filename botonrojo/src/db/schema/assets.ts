import { pgTable, text, timestamp, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { createId } from "@/lib/ids";
import { launches } from "./launches";
import { users } from "./users";
import { organizations } from "./organizations";

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
  organizationId: text("organization_id").references(() => organizations.id, { onDelete: "cascade" }),
  launchId: text("launch_id").references(() => launches.id, { onDelete: "cascade" }),
  kind: assetKind("kind").notNull(),
  // Distinguishes distinct pages of the same launch+kind (e.g. "venta",
  // "registro", "contenido-1") from version history of the SAME page (latest
  // createdAt per (launchId, kind, pageKey) wins). Existing rows default to
  // "main", which legacy (pageConfig-less) launches keep resolving to.
  pageKey: text("page_key").notNull().default("main"),
  title: text("title").notNull(),
  body: jsonb("body").$type<Record<string, unknown>>().notNull(),
  fileUrl: text("file_url"),
  authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
  generatedByAi: text("generated_by_ai"),
  // Automatic post-generation visual QA (screenshot + Claude vision) — only
  // populated for `kind: "landing"` when the screenshot service is configured.
  designReview: jsonb("design_review").$type<DesignReviewResult | null>(),
  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;

export type DesignReviewIssue = {
  severity: "auto_fixed" | "warning" | "critical";
  description: string;
  /** Which band or block it's about, when the reviewer could tell. */
  where?: string;
};

export type DesignReviewResult = {
  issues: DesignReviewIssue[];
  reviewedAt: string;
  /**
   * The brief that would fix what was found, written by the reviewer in the same
   * language the regenerate box takes. Turns a list of complaints into one click:
   * the panel drops it into the page's instruction and regenerates.
   */
  suggestedInstruction?: string;
  /** Worst text/background ratio measured on the page, for a quick verdict. */
  worstContrast?: number;
};
