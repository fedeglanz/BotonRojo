import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { assets, launches } from "@/db/schema";
import { requireOrgAdmin } from "@/lib/auth-helpers";
import { LAUNCH_TYPES, type LaunchType } from "@/lib/launch-types";
import { listMediaItems, deleteMediaItemAction, updateMediaLabelAction } from "@/server/media";
import { MediaLibraryPanel } from "@/components/admin/media-library-panel";

export const dynamic = "force-dynamic";

export default async function AnunciosPage() {
  const { organizationId } = await requireOrgAdmin();

  const [mediaItems, launchRows] = await Promise.all([
    listMediaItems(),
    db
      .select({
        id: launches.id,
        slug: launches.slug,
        name: launches.name,
        type: launches.type,
        staticsCount: sql<number>`(
          select count(*) from ${assets}
          where ${assets.launchId} = ${launches.id} and ${assets.kind} = 'ad_image'
        )`,
        hasCopy: sql<number>`(
          select count(*) from ${assets}
          where ${assets.launchId} = ${launches.id} and ${assets.kind} = 'ad_copy'
        )`,
      })
      .from(launches)
      .where(eq(launches.organizationId, organizationId))
      .orderBy(desc(launches.createdAt)),
  ]);

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-bold md:text-4xl">Anuncios</h1>
        <p className="mt-2 text-zinc-400">
          Fotos base del cliente y estado de los anuncios de cada lanzamiento. El copy y los
          estáticos se generan dentro de cada lanzamiento.
        </p>
      </div>

      <section>
        <h2 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-[0.25em] text-zinc-400">
          Biblioteca de fotos
        </h2>
        <p className="mt-1 text-sm text-zinc-500">
          Compartida por todos los lanzamientos de este cliente — súbelas una vez y reutilízalas.
        </p>
        <div className="mt-4">
          <MediaLibraryPanel
            items={mediaItems}
            deleteAction={deleteMediaItemAction}
            updateLabelAction={updateMediaLabelAction}
          />
        </div>
      </section>

      <section>
        <h2 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-[0.25em] text-zinc-400">
          Anuncios por lanzamiento
        </h2>
        <div className="glass mt-4 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-widest text-zinc-400">
              <tr>
                <th className="px-4 py-3">Lanzamiento</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Copy</th>
                <th className="px-4 py-3">Estáticos</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {launchRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                    Aún no hay lanzamientos.
                  </td>
                </tr>
              )}
              {launchRows.map((l) => (
                <tr key={l.id} className="border-t border-white/5 transition hover:bg-white/[0.03]">
                  <td className="px-4 py-3 font-medium text-white">{l.name}</td>
                  <td className="px-4 py-3 text-zinc-400">
                    {LAUNCH_TYPES[l.type as LaunchType]?.label ?? l.type}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {Number(l.hasCopy) > 0 ? (
                      <span className="text-emerald-300">Generado</span>
                    ) : (
                      <span className="text-zinc-500">Pendiente</span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-[family-name:var(--font-mono)] text-zinc-300">
                    {Number(l.staticsCount)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/lanzamientos/${l.slug}`}
                      className="text-[--color-red-bright] hover:underline"
                    >
                      Abrir →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
