import { db } from "@/db";
import { assets, launches } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { LaunchSelector } from "@/components/admin/launch-selector";
import { requireOrgAdmin } from "@/lib/auth-helpers";
import type { LaunchType } from "@/lib/launch-types";
import { resolvePages } from "@/lib/launch-pages";
import { isCustomPageBody } from "@/lib/custom-page";
import type { MoonState } from "@/components/admin/planet";

export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const { organizationId } = await requireOrgAdmin();
  if (!organizationId) throw new Error("no_organization");
  const rows = await db
    .select()
    .from(launches)
    .where(eq(launches.organizationId, organizationId))
    .orderBy(desc(launches.createdAt))
    .limit(50);

  // Qué páginas tiene cada lanzamiento y cuáles están hechas: es lo que dibujan las
  // lunas de su planeta, y una sola consulta para todos en vez de una por lanzamiento.
  const pageAssets = rows.length
    ? await db
        .select({
          launchId: assets.launchId,
          pageKey: assets.pageKey,
          body: assets.body,
        })
        .from(assets)
        .where(
          and(
            eq(assets.organizationId, organizationId),
            eq(assets.kind, "landing"),
          ),
        )
    : [];

  const doneByLaunch = new Map<string, Map<string, MoonState>>();
  for (const asset of pageAssets) {
    if (!asset.launchId) continue;
    const forLaunch =
      doneByLaunch.get(asset.launchId) ?? new Map<string, MoonState>();
    // El más reciente de cada página manda, y llegan ordenados por creación
    // descendente solo si se pide; aquí basta con no degradar un "claude" a "hecha".
    const state: MoonState = isCustomPageBody(asset.body) ? "claude" : "hecha";
    if (forLaunch.get(asset.pageKey) !== "claude")
      forLaunch.set(asset.pageKey, state);
    doneByLaunch.set(asset.launchId, forLaunch);
  }

  const summaries = rows.map((l) => {
    const pages = resolvePages(l.type as LaunchType, l.pageConfig);
    const done = doneByLaunch.get(l.id);
    return {
      id: l.id,
      slug: l.slug,
      name: l.name,
      type: l.type as LaunchType,
      status: l.status,
      palette: l.brandPalette,
      moons: pages.map((page) => done?.get(page.pageKey) ?? "pendiente"),
      pageCount: pages.length,
    };
  });

  return (
    <div className="galaxy-field space-y-10 py-2">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold md:text-4xl">
          Tu galaxia de lanzamientos
        </h1>
        <p className="mt-2 max-w-2xl text-zinc-400">
          Cada tipo de lanzamiento es un planeta distinto y cada luna, una de
          sus páginas: encendidas las que están hechas, apagadas las que faltan.
          Elige un tipo para crear uno nuevo, o entra en el que ya tengas.
        </p>
      </div>

      <LaunchSelector launches={summaries} />
    </div>
  );
}
