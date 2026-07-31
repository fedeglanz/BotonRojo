import Link from "next/link";

import { pagePath, contentUnlockDate, type PageDef } from "@/lib/launch-pages";

const KIND_LABELS: Record<PageDef["kind"], string> = {
  registro: "Captación",
  venta: "Venta",
  contenido: "Entrega",
  afiliados: "Afiliados",
  legal: "Legal",
};

/**
 * The launch's pages as a plain index: one row each, all with the same weight.
 * Before this the sales page was edited inline here — with its design review,
 * reference URL, instructions and full section editor — while the rest got a
 * collapsed JSON box, so the step was enormous and the pages plainly unequal.
 * Editing now happens on each page's own screen.
 */
export function PageIndex({
  pages,
  launchSlug,
  generatedKeys,
  dripStartsAt,
}: {
  pages: PageDef[];
  launchSlug: string;
  /** pageKeys that already have content. */
  generatedKeys: Set<string>;
  dripStartsAt: Date | null;
}) {
  return (
    <ul className="space-y-2">
      {pages.map((page) => {
        const generated = generatedKeys.has(page.pageKey);
        const unlock = contentUnlockDate(dripStartsAt, page.pageKey);

        return (
          <li key={page.pageKey}>
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 transition hover:border-white/25">
              <span
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${generated ? "bg-emerald-400" : "bg-zinc-600"}`}
                aria-hidden
              />

              <Link
                href={`/admin/lanzamientos/${launchSlug}/paginas/${page.pageKey}`}
                className="min-w-0 flex-1"
              >
                <span className="block font-medium text-white">{page.label}</span>
                <span className="block truncate font-[family-name:var(--font-mono)] text-[11px] text-zinc-500">
                  {pagePath(launchSlug, page)}
                  {page.isEntry && " · entrada"}
                  {unlock && ` · se abre el ${unlock.toLocaleDateString("es")}`}
                </span>
              </Link>

              <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-zinc-500">
                {KIND_LABELS[page.kind]}
              </span>

              {!generated && (
                <span className="shrink-0 text-[10px] uppercase tracking-widest text-amber-300/80">
                  sin generar
                </span>
              )}

              <a
                href={pagePath(launchSlug, page)}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 rounded-md border border-white/15 px-2.5 py-1 text-[11px] uppercase tracking-widest text-zinc-300 transition hover:border-white/40"
              >
                Ver ↗
              </a>

              <Link
                href={`/admin/lanzamientos/${launchSlug}/paginas/${page.pageKey}`}
                className="shrink-0 rounded-md border border-[--color-red]/40 bg-[--color-red]/10 px-2.5 py-1 text-[11px] uppercase tracking-widest text-[--color-red-bright] transition hover:bg-[--color-red]/20"
              >
                Editar
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
