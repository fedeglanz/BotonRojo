"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { LAUNCH_TYPES, type LaunchType } from "@/lib/launch-types";
import {
  Planet,
  TYPE_PLANET_COLOR,
  TYPE_PLANET_KIND,
  type MoonState,
} from "@/components/admin/planet";
import type { BrandPalette } from "@/db/schema/launches";

type LaunchSummary = {
  id: string;
  slug: string;
  name: string;
  type: LaunchType;
  status: string;
  /** La paleta aprobada da el color del planeta; sin ella, el color del tipo. */
  palette: BrandPalette | null;
  /** Una luna por página, con su estado. */
  moons: MoonState[];
  pageCount: number;
};

export function LaunchSelector({ launches }: { launches: LaunchSummary[] }) {
  return (
    <div className="space-y-10">
      <section>
        <h2 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-[0.25em] text-zinc-400">
          1. Elige el tipo de lanzamiento
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {(Object.keys(LAUNCH_TYPES) as LaunchType[]).map((key, i) => {
            const t = LAUNCH_TYPES[key];
            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="glass glass-hover group relative overflow-hidden p-6"
              >
                <div
                  className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r ${t.color}`}
                  aria-hidden
                />
                <div
                  className="pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full bg-[var(--color-red)] opacity-0 blur-3xl transition-opacity duration-300 group-hover:opacity-20"
                  aria-hidden
                />
                <div className="flex items-center gap-3">
                  {/* El planeta del tipo, quieto y pequeño: aquí no hay páginas
                      todavía, así que no hay lunas que enseñar. */}
                  <Planet
                    palette={null}
                    fallbackColor={TYPE_PLANET_COLOR[key]}
                    kind={TYPE_PLANET_KIND[key]}
                    moons={[]}
                    size="3.5rem"
                  />
                  <div>
                    <div className="font-[family-name:var(--font-display)] text-lg font-bold">
                      {t.label}
                    </div>
                    <div className="text-xs uppercase tracking-widest text-zinc-500">
                      {t.tagline}
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-sm text-zinc-400">{t.description}</p>
                <p className="mt-3 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-zinc-500">
                  📄 {t.pages}
                </p>
                <Link
                  href={`/admin/lanzamientos/nuevo?type=${key}`}
                  className="mt-6 inline-flex w-full items-center justify-center rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-[var(--color-red)] hover:text-white"
                >
                  Crear {t.label.toLowerCase()} →
                </Link>
              </motion.div>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-[0.25em] text-zinc-400">
          2. Tus lanzamientos
        </h2>

        {launches.length === 0 ? (
          <p className="glass mt-4 p-8 text-center text-sm text-zinc-500">
            Todavía no hay ningún planeta por aquí. Crea el primero arriba.
          </p>
        ) : (
          <div className="mt-6 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {launches.map((l, i) => {
              const hechas = l.moons.filter((m) => m !== "pendiente").length;
              return (
                <motion.div
                  key={l.id}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link
                    href={`/admin/lanzamientos/${l.slug}`}
                    className="group flex flex-col items-center gap-4 rounded-2xl p-4 transition hover:bg-white/[0.03]"
                  >
                    <Planet
                      palette={l.palette}
                      fallbackColor={TYPE_PLANET_COLOR[l.type]}
                      kind={TYPE_PLANET_KIND[l.type]}
                      moons={l.moons}
                      size="8.5rem"
                      label={`${l.name}: ${hechas} de ${l.pageCount} páginas hechas`}
                    />

                    <div className="text-center">
                      <div className="font-[family-name:var(--font-display)] font-bold text-white transition group-hover:text-[var(--color-red-bright)]">
                        {l.name}
                      </div>
                      <div className="mt-0.5 text-[11px] uppercase tracking-widest text-zinc-500">
                        {LAUNCH_TYPES[l.type]?.label ?? l.type} · {l.status}
                      </div>
                      <div className="mt-2 font-[family-name:var(--font-mono)] text-[11px] text-zinc-600">
                        {hechas}/{l.pageCount} páginas
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
