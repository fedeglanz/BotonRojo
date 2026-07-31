import { SubmitButton } from "./submit-button";
import { AiGeneratingOverlay } from "./ai-generating-overlay";
import type { DesignReviewResult } from "@/db/schema/assets";

type Props = {
  review: DesignReviewResult | null | undefined;
  launchId: string;
  pageKey: string;
  /** Whether the page exists yet — there's nothing to inspect otherwise. */
  hasContent: boolean;
  /** Takes fresh screenshots and re-measures. Re-runnable, on purpose. */
  reviewAction: (launchId: string, pageKey: string) => Promise<void>;
  /** Regenerates the page using the brief the reviewer itself wrote. */
  applySuggestionAction: (launchId: string, pageKey: string) => Promise<void>;
  /** Rewrites the content-level problems in place (sales page only). */
  fixAction?: (launchId: string, pageKey: string) => Promise<void>;
};

const SEVERITY = {
  critical: { icon: "✕", className: "text-red-300" },
  warning: { icon: "⚠", className: "text-amber-200" },
  auto_fixed: { icon: "✓", className: "text-emerald-300" },
} as const;

/**
 * On-demand design inspection of one page.
 *
 * The review used to run only right after generating the sales page, so its
 * timestamp stopped matching what was on screen the moment anything was edited,
 * and no other page was ever inspected at all. Now it's a button, on every page,
 * and what it finds comes with the brief that would fix it.
 */
export function DesignReviewPanel({
  review,
  launchId,
  pageKey,
  hasContent,
  reviewAction,
  applySuggestionAction,
  fixAction,
}: Props) {
  const critical = review?.issues.filter((i) => i.severity === "critical").length ?? 0;
  const warnings = review?.issues.filter((i) => i.severity === "warning").length ?? 0;

  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-black/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-zinc-400">Revisión de diseño</div>
          <p className="mt-1 text-xs text-zinc-500">
            {review
              ? `Última: ${new Date(review.reviewedAt).toLocaleString("es", { dateStyle: "short", timeStyle: "short" })}` +
                (typeof review.worstContrast === "number"
                  ? ` · peor contraste medido ${review.worstContrast}:1`
                  : "")
              : "Sin revisar todavía."}
          </p>
        </div>

        <form action={reviewAction.bind(null, launchId, pageKey)}>
          <AiGeneratingOverlay
            messages={[
              "Tomando capturas en móvil y escritorio…",
              "Midiendo contrastes…",
              "Mirándola como un cliente exigente…",
            ]}
          />
          <SubmitButton variant="ghost" pendingLabel="Inspeccionando…" disabled={!hasContent}>
            {review ? "Revisar de nuevo" : "Inspeccionar esta página"}
          </SubmitButton>
        </form>
      </div>

      {!hasContent && <p className="text-xs text-zinc-500">Genera la página antes de inspeccionarla.</p>}

      {review && review.issues.length === 0 && (
        <p className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-200">
          ✓ Nada que corregir en esta pasada.
        </p>
      )}

      {review && review.issues.length > 0 && (
        <>
          <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-widest">
            {critical > 0 && (
              <span className="rounded-full border border-red-500/40 px-2 py-0.5 text-red-300">
                {critical} grave{critical === 1 ? "" : "s"}
              </span>
            )}
            {warnings > 0 && (
              <span className="rounded-full border border-amber-500/40 px-2 py-0.5 text-amber-300">
                {warnings} aviso{warnings === 1 ? "" : "s"}
              </span>
            )}
          </div>

          <ul className="space-y-2 text-sm">
            {review.issues.map((issue, i) => {
              const s = SEVERITY[issue.severity] ?? SEVERITY.warning;
              return (
                <li key={i} className={`flex gap-2 ${s.className}`}>
                  <span className="shrink-0" aria-hidden>
                    {s.icon}
                  </span>
                  <span>
                    {issue.where && <strong className="font-semibold">{issue.where}: </strong>}
                    {issue.description}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {review?.suggestedInstruction && (
        <div className="space-y-2 rounded-lg border border-[var(--color-red)]/25 bg-[var(--color-red)]/5 p-3">
          <div className="text-[10px] uppercase tracking-widest text-zinc-400">Cómo lo arreglaría</div>
          <p className="text-sm text-zinc-200">{review.suggestedInstruction}</p>
          <div className="flex flex-wrap justify-end gap-2">
            {fixAction && (
              <form action={fixAction.bind(null, launchId, pageKey)}>
                <SubmitButton variant="ghost" pendingLabel="Corrigiendo…">
                  Solo el contenido
                </SubmitButton>
              </form>
            )}
            <form action={applySuggestionAction.bind(null, launchId, pageKey)}>
              <AiGeneratingOverlay messages={["Aplicando las correcciones…", "Regenerando la página…"]} />
              <SubmitButton pendingLabel="Aplicando…">Aplicar y regenerar</SubmitButton>
            </form>
          </div>
          <p className="text-xs text-zinc-500">
            &ldquo;Aplicar y regenerar&rdquo; usa ese texto como instrucción de la página y la vuelve a
            generar. &ldquo;Solo el contenido&rdquo; retoca textos y estilo de caja sin regenerarla.
          </p>
        </div>
      )}
    </div>
  );
}
