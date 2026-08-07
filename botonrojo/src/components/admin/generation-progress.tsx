"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import type { GenerationProgress as Progress } from "@/server/launches";

/**
 * Follows a multi-page generation while it runs.
 *
 * Generating a launch's nine pages takes minutes. The submit overlay covered the
 * first couple of seconds and then the screen went quiet, so the only way to know
 * whether anything was happening was to reload every so often. The run now writes
 * its progress per page, and this refreshes the server components until it's
 * finished — so the page list fills in on its own.
 */
export function GenerationProgress({
  progress,
}: {
  progress: Progress | null;
}) {
  const router = useRouter();
  const running = Boolean(progress && !progress.finishedAt);

  useEffect(() => {
    if (!running) return;
    // 4s: fast enough that a page appearing feels immediate, slow enough not to
    // hammer the server while it's busy generating.
    const id = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(id);
  }, [running, router]);

  if (!progress) return null;

  const finished = Boolean(progress.finishedAt);
  const settled = progress.done.length + progress.failed.length;
  const pct =
    progress.total > 0 ? Math.round((settled / progress.total) * 100) : 0;

  // A finished run with nothing to report doesn't need to stay on screen — but an
  // interrupted one does, precisely because it left pages ungenerated.
  if (finished && progress.failed.length === 0 && !progress.interrupted)
    return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-xl border border-[var(--color-red)]/25 bg-[var(--color-red)]/5 p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm font-medium text-white">
          {progress.interrupted
            ? `Generación interrumpida en ${settled} de ${progress.total}`
            : finished
              ? `Generación terminada con ${progress.failed.length} error${progress.failed.length === 1 ? "" : "es"}`
              : `Generando páginas… ${settled} de ${progress.total}`}
        </div>
        {!finished && (
          <div className="font-[family-name:var(--font-mono)] text-xs text-zinc-400">
            {pct}%
          </div>
        )}
      </div>

      {!finished && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[var(--color-red)] transition-[width] duration-500"
            style={{ width: `${Math.max(pct, 4)}%` }}
          />
        </div>
      )}

      {progress.done.length > 0 && (!finished || progress.interrupted) && (
        <p className="mt-2 text-xs text-zinc-500">
          Listas: {progress.done.join(" · ")}
        </p>
      )}

      {progress.interrupted && (
        <p className="mt-2 text-xs text-amber-300">
          El servidor se reinició mientras generaba (un despliegue,
          normalmente), así que las páginas que faltan no llegaron a escribirse.
          Vuelve a darle a generar: las que ya están se rehacen igual, no se
          duplican.
        </p>
      )}

      {progress.failed.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-amber-300">
          {progress.failed.map((f) => (
            <li key={f.page}>
              <strong className="font-semibold">{f.page}:</strong> {f.error}
            </li>
          ))}
        </ul>
      )}

      {!finished && (
        <p className="mt-2 text-xs text-zinc-500">
          Puedes cerrar esta pestaña: la generación sigue en el servidor.
        </p>
      )}
    </div>
  );
}
