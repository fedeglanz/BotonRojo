import { SubmitButton } from "./submit-button";
import type { DesignReviewResult } from "@/db/schema/assets";

type Props = {
  review: DesignReviewResult | null | undefined;
  launchId: string;
  pageKey: string;
  fixAction: (launchId: string, pageKey: string) => Promise<void>;
};

export function DesignReviewPanel({ review, launchId, pageKey, fixAction }: Props) {
  if (!review) return null;

  if (review.issues.length === 0) {
    return (
      <div className="mb-4 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-200">
        ✓ Revisión automática de diseño: no se ha detectado nada raro.
      </div>
    );
  }

  const fixableCount = review.issues.filter((i) => i.severity === "warning").length;

  return (
    <div className="mb-4 space-y-3 rounded-lg border border-white/10 bg-black/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs uppercase tracking-widest text-zinc-400">
          Revisión automática de diseño ·{" "}
          {new Date(review.reviewedAt).toLocaleString("es", { dateStyle: "short", timeStyle: "short" })}
        </div>
        {fixableCount > 0 && (
          <form action={fixAction.bind(null, launchId, pageKey)}>
            <SubmitButton variant="ghost" pendingLabel="Corrigiendo…">
              Corregir con Claude
            </SubmitButton>
          </form>
        )}
      </div>

      <ul className="space-y-1.5 text-sm">
        {review.issues.map((issue, i) => (
          <li
            key={i}
            className={`flex gap-2 ${issue.severity === "auto_fixed" ? "text-emerald-300" : "text-amber-200"}`}
          >
            <span className="shrink-0">{issue.severity === "auto_fixed" ? "✓" : "⚠"}</span>
            <span>{issue.description}</span>
          </li>
        ))}
      </ul>

      {fixableCount > 0 && (
        <p className="text-xs text-zinc-500">
          &ldquo;Corregir con Claude&rdquo; solo puede arreglar lo que depende del contenido (textos
          demasiado largos, estilo de caja, orden de secciones). Los avisos de maquetación pura
          seguirán apareciendo hasta que se ajuste el diseño.
        </p>
      )}
    </div>
  );
}
