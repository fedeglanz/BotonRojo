"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { LAUNCH_TYPES, type LaunchType } from "@/lib/launch-types";

type LaunchSummary = {
  id: string;
  slug: string;
  name: string;
  type: LaunchType;
  status: string;
};

export function LaunchSelector({ launches }: { launches: LaunchSummary[] }) {
  return (
    <div className="space-y-10">
      <section>
        <h2 className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-[0.25em] text-zinc-400">
          1. Elige el tipo de lanzamiento
        </h2>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
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
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-2xl">
                    {t.icon}
                  </div>
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
          2. Lanzamientos existentes
        </h2>
        <div className="glass mt-4 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-widest text-zinc-400">
              <tr>
                <th className="px-4 py-3">Nombre</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {launches.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-zinc-500">
                    Aún no hay lanzamientos. Crea el primero arriba.
                  </td>
                </tr>
              )}
              {launches.map((l) => (
                <tr key={l.id} className="border-t border-white/5 transition hover:bg-white/[0.03]">
                  <td className="px-4 py-3 font-medium text-white">{l.name}</td>
                  <td className="px-4 py-3 text-zinc-400">{LAUNCH_TYPES[l.type]?.label ?? l.type}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs uppercase tracking-widest text-zinc-300">
                      {l.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/lanzamientos/${l.slug}`} className="text-[var(--color-red-bright)] hover:underline">
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
