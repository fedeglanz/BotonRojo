import "server-only";

import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { launchTasks, type LaunchTask } from "@/db/schema";
import { resolvePages } from "@/lib/launch-pages";
import type { LaunchType } from "@/lib/launch-types";
import type { Launch } from "@/db/schema/launches";

/**
 * La cola de trabajo de un lanzamiento que se diseña en Claude.
 *
 * Aquí no hay IA ni llamadas a nada: solo se escribe qué hay que hacer y se marca
 * qué está hecho. Quien lo ejecuta es Claude, a través del conector, y quien decide
 * qué entra en la lista es el panel — que es lo que hacía falta para poder "crear
 * con Claude" sin salir de Botón Rojo.
 */

/** Las páginas legales no entran: su texto lo mantiene la plataforma. */
function tasksFor(
  launch: Launch,
): Array<
  Omit<
    LaunchTask,
    "id" | "createdAt" | "updatedAt" | "doneAt" | "result" | "status"
  >
> {
  const pages = resolvePages(
    launch.type as LaunchType,
    launch.pageConfig,
  ).filter((page) => page.kind !== "legal");

  return [
    {
      organizationId: launch.organizationId,
      launchId: launch.id,
      kind: "design_system" as const,
      pageKey: null,
      label: "Identidad visual",
      instruction: null,
      // La primera a propósito: las páginas se diseñan con ella, así que hacerlas
      // antes obligaría a rehacerlas.
      position: 0,
    },
    ...pages.map((page, i) => ({
      organizationId: launch.organizationId,
      launchId: launch.id,
      kind: "page" as const,
      pageKey: page.pageKey,
      label: page.label,
      instruction: null,
      position: i + 1,
    })),
  ];
}

/**
 * Escribe la cola de un lanzamiento nuevo.
 *
 * Idempotente por si se llama dos veces: no duplica una tarea que ya existe para
 * la misma página, y no resucita las que ya estén hechas.
 */
export async function seedLaunchQueue(launch: Launch): Promise<number> {
  const existing = await db
    .select({ kind: launchTasks.kind, pageKey: launchTasks.pageKey })
    .from(launchTasks)
    .where(eq(launchTasks.launchId, launch.id));

  const already = new Set(
    existing.map((row) => `${row.kind}:${row.pageKey ?? ""}`),
  );
  const rows = tasksFor(launch).filter(
    (task) => !already.has(`${task.kind}:${task.pageKey ?? ""}`),
  );
  if (!rows.length) return 0;

  await db.insert(launchTasks).values(rows);
  return rows.length;
}

export async function listLaunchTasks(
  launchId: string,
  organizationId: string,
) {
  return db
    .select()
    .from(launchTasks)
    .where(
      and(
        eq(launchTasks.launchId, launchId),
        eq(launchTasks.organizationId, organizationId),
      ),
    )
    .orderBy(asc(launchTasks.position));
}

/** Todo lo que está pendiente en la organización, en el orden en que tiene sentido. */
export async function listPendingTasks(organizationId: string) {
  return db
    .select()
    .from(launchTasks)
    .where(
      and(
        eq(launchTasks.organizationId, organizationId),
        eq(launchTasks.status, "pending"),
      ),
    )
    .orderBy(asc(launchTasks.launchId), asc(launchTasks.position));
}

/**
 * Cierra una tarea.
 *
 * Se llama sola cuando el trabajo llega: publicar una página cierra la tarea de esa
 * página, y guardar la identidad visual cierra la suya. Pedirle a Claude una llamada
 * extra para decir "ya está" sería una llamada que se puede olvidar, y entonces el
 * panel mentiría sobre lo que falta.
 */
export async function completeTask(
  input:
    | { launchId: string; kind: "design_system"; result?: string }
    | { launchId: string; kind: "page"; pageKey: string; result?: string },
): Promise<void> {
  const conditions = [
    eq(launchTasks.launchId, input.launchId),
    eq(launchTasks.kind, input.kind),
    eq(launchTasks.status, "pending"),
  ];
  if (input.kind === "page")
    conditions.push(eq(launchTasks.pageKey, input.pageKey));

  await db
    .update(launchTasks)
    .set({
      status: "done",
      doneAt: new Date(),
      result: input.result ?? null,
      updatedAt: new Date(),
    })
    .where(and(...conditions));
}
