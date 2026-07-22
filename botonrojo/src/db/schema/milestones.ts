import { pgTable, text, timestamp, pgEnum, jsonb, integer, index } from "drizzle-orm/pg-core";
import { createId } from "@/lib/ids";
import { launches } from "./launches";

export const milestonePhase = pgEnum("milestone_phase", [
  // Common
  "pre_captacion",
  "captacion",
  "calentamiento",
  "apertura_carrito",
  "venta",
  "cierre_carrito",
  // Venta directa
  "evento_vivo",
  "replay",
  // PLF
  "pre_pre_lanzamiento",
  "plc_1",
  "plc_2",
  "plc_3",
  "plc_4",
  "urgencia",
]);

export const milestones = pgTable(
  "launch_milestones",
  {
    id: text("id").primaryKey().$defaultFn(() => createId()),
    launchId: text("launch_id").notNull().references(() => launches.id, { onDelete: "cascade" }),
    phase: milestonePhase("phase").notNull(),
    label: text("label").notNull(),
    startsAt: timestamp("starts_at", { mode: "date" }).notNull(),
    endsAt: timestamp("ends_at", { mode: "date" }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    aiWarnings: jsonb("ai_warnings").$type<AiWarning[]>().default([]),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => ({
    launchIdx: index("milestones_launch_idx").on(t.launchId),
  }),
);

export type AiWarning = {
  phase?: string;
  date: string;
  severity: "info" | "warning" | "critical";
  message: string;
  country?: string;
};

export type Milestone = typeof milestones.$inferSelect;
export type NewMilestone = typeof milestones.$inferInsert;
