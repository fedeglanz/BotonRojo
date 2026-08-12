import Link from "next/link";

import { pagePath, contentUnlockDate, type PageDef } from "@/lib/launch-pages";
import { ClaudeGoButton } from "@/components/admin/claude-go-button";
import {
  CLAUDE_DESIGN_URL,
  claudeDesignPagePrompt,
  claudeEditPagePrompt,
} from "@/lib/claude-link";

const KIND_LABELS: Record<PageDef["kind"], string> = {
  registro: "Captación",
  venta: "Venta",
  contenido: "Entrega",
  afiliados: "Afiliados",
  legal: "Legal",
};

/**
 * Which kinds of page can be edited on top of themselves (`?editar=1`).
 *
 * Every kind except legal: those are boilerplate, deliberately outside the
 * composable system. Offering the link there would open a page with no overlay on
 * it, which reads as the editor being broken rather than as not applying.
 *
 * Same reason a page designed in Claude is excluded at the call site: its content
 * is one HTML document, so there are no sections to point at.
 */
const IN_PAGE_EDITABLE = new Set<PageDef["kind"]>([
  "registro",
  "venta",
  "contenido",
  "afiliados",
]);

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
  launchName,
  appUrl,
  generatedKeys,
  claudeKeys,
  hasConnector,
  dripStartsAt,
}: {
  pages: PageDef[];
  launchSlug: string;
  launchName: string;
  /** Para poder darle a Claude la URL pública completa de cada página. */
  appUrl: string;
  /** pageKeys that already have content. */
  generatedKeys: Set<string>;
  /** pageKeys whose content is an HTML page designed in Claude. */
  claudeKeys: Set<string>;
  /** Si la cuenta tiene el conector conectado; si no, el botón lleva a conectarlo. */
  hasConnector: boolean;
  dripStartsAt: Date | null;
}) {
  return (
    <ul className="space-y-2">
      {pages.map((page) => {
        const generated = generatedKeys.has(page.pageKey);
        const fromClaude = claudeKeys.has(page.pageKey);
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
                <span className="block font-medium text-white">
                  {page.label}
                </span>
                <span className="block truncate font-[family-name:var(--font-mono)] text-[11px] text-zinc-500">
                  {pagePath(launchSlug, page)}
                  {page.isEntry && " · entrada"}
                  {unlock && ` · se abre el ${unlock.toLocaleDateString("es")}`}
                </span>
              </Link>

              <span className="shrink-0 rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-zinc-500">
                {KIND_LABELS[page.kind]}
              </span>

              {fromClaude && (
                <span className="shrink-0 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-emerald-300">
                  Claude Design
                </span>
              )}

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

              {page.kind !== "legal" && (
                <ClaudeGoButton
                  hasConnector={hasConnector}
                  label={fromClaude ? "Cambiar en Claude" : "Con Claude"}
                  href={CLAUDE_DESIGN_URL}
                  prompt={
                    fromClaude
                      ? claudeEditPagePrompt({
                          launchSlug,
                          launchName,
                          pageKey: page.pageKey,
                          pageLabel: page.label,
                          publicUrl: `${appUrl}${pagePath(launchSlug, page)}`,
                        })
                      : claudeDesignPagePrompt({
                          launchSlug,
                          launchName,
                          pageKey: page.pageKey,
                          pageLabel: page.label,
                          pageKind: page.kind,
                          publicUrl: `${appUrl}${pagePath(launchSlug, page)}`,
                        })
                  }
                />
              )}

              {generated && !fromClaude && IN_PAGE_EDITABLE.has(page.kind) && (
                <a
                  href={`${pagePath(launchSlug, page)}?editar=1`}
                  target="_blank"
                  rel="noreferrer"
                  title="Abrir la página y editarla señalando encima"
                  className="shrink-0 rounded-md border border-emerald-400/40 bg-emerald-400/10 px-2.5 py-1 text-[11px] uppercase tracking-widest text-emerald-300 transition hover:bg-emerald-400/20"
                >
                  Editar encima ↗
                </a>
              )}

              <Link
                href={`/admin/lanzamientos/${launchSlug}/paginas/${page.pageKey}`}
                className="shrink-0 rounded-md border border-[var(--color-red)]/40 bg-[var(--color-red)]/10 px-2.5 py-1 text-[11px] uppercase tracking-widest text-[var(--color-red-bright)] transition hover:bg-[var(--color-red)]/20"
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
