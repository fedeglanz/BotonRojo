import {
  pgTable,
  text,
  timestamp,
  integer,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { createId } from "@/lib/ids";
import { organizations } from "./organizations";
import { launches } from "./launches";

export const launchTaskKind = pgEnum("launch_task_kind", [
  "design_system",
  "page",
]);

export const launchTaskStatus = pgEnum("launch_task_status", [
  "pending",
  "done",
  "skipped",
]);

/**
 * Lo que Botón Rojo quiere que Claude haga en un lanzamiento, en orden.
 *
 * Existe por un límite del protocolo, no por gusto: el conector MCP va en una sola
 * dirección — Claude llama a Botón Rojo, nunca al contrario —, así que la
 * plataforma no puede poner a trabajar a nadie. Lo que sí puede es dejar el trabajo
 * definido y esperar a que Claude lo pida: el "crear con Claude" del formulario
 * escribe esta lista, y un solo mensaje en Claude la recorre entera.
 *
 * Que sea una tabla y no un campo en el lanzamiento importa: son varias unidades de
 * trabajo con estado propio, se completan por separado y en cualquier orden, y el
 * panel tiene que poder decir cuál falta.
 */
export const launchTasks = pgTable(
  "launch_tasks",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => createId()),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    launchId: text("launch_id")
      .notNull()
      .references(() => launches.id, { onDelete: "cascade" }),
    kind: launchTaskKind("kind").notNull(),
    /** Qué página, cuando `kind` es "page". */
    pageKey: text("page_key"),
    /** Cómo se llama la tarea en el panel y en el chat. */
    label: text("label").notNull(),
    /** Lo que el cliente pidió para esta tarea en concreto, si dijo algo. */
    instruction: text("instruction"),
    status: launchTaskStatus("status").notNull().default("pending"),
    /** El orden en que tienen sentido: la identidad visual antes que las páginas,
     *  porque las páginas se diseñan con ella. */
    position: integer("position").notNull().default(0),
    /** Lo que Claude dejó dicho al terminarla. */
    result: text("result"),
    doneAt: timestamp("done_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    // "Qué me queda pendiente" es la consulta de todas las llamadas del conector.
    index("launch_tasks_pending_idx").on(table.organizationId, table.status),
    index("launch_tasks_launch_idx").on(table.launchId),
  ],
);

export type LaunchTask = typeof launchTasks.$inferSelect;
