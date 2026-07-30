"use client";

import { useState } from "react";
import { SubmitButton } from "./submit-button";
import type { PageKind } from "@/lib/launch-pages";

type Props = {
  launchId: string;
  pageKey: string;
  label: string;
  kind: PageKind;
  href: string;
  hasContent: boolean;
  body: Record<string, unknown> | null;
  regenerateAction: (launchId: string, pageKey: string, formData: FormData) => Promise<void>;
  updateAction: (launchId: string, pageKey: string, formData: FormData) => Promise<void>;
};

export function SimplePageEditor({
  launchId,
  pageKey,
  label,
  kind,
  href,
  hasContent,
  body,
  regenerateAction,
  updateAction,
}: Props) {
  const [showJson, setShowJson] = useState(false);

  return (
    <div className="glass p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="font-bold text-white">{label}</div>
          <div className="text-xs text-zinc-500">
            {hasContent ? "Generada" : "Pendiente"}
            {kind === "legal" && " · Borrador de IA — revísalo con un asesor legal antes de publicar"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-white/20 bg-white/[0.06] px-3 py-1.5 text-xs uppercase tracking-widest text-zinc-200 transition hover:border-white/40 hover:bg-white/12"
          >
            Ver ↗
          </a>
          <button
            type="button"
            onClick={() => setShowJson((v) => !v)}
            className="rounded-md border border-white/20 bg-white/[0.06] px-3 py-1.5 text-xs uppercase tracking-widest text-zinc-200 transition hover:border-white/40 hover:bg-white/12"
          >
            {showJson ? "Ocultar" : "Editar"}
          </button>
          <form action={regenerateAction.bind(null, launchId, pageKey)}>
            <SubmitButton variant="ghost" pendingLabel="Regenerando…">
              {hasContent ? "Regenerar" : "Generar"}
            </SubmitButton>
          </form>
        </div>
      </div>

      {showJson && (
        <form action={updateAction.bind(null, launchId, pageKey)} className="mt-3 space-y-2">
          <textarea
            name="json"
            rows={10}
            defaultValue={JSON.stringify(body ?? {}, null, 2)}
            className="field-input w-full px-3 py-2 font-[family-name:var(--font-mono)] text-xs text-white"
          />
          <div className="flex justify-end">
            <SubmitButton variant="ghost" pendingLabel="Guardando…">
              Guardar JSON
            </SubmitButton>
          </div>
        </form>
      )}
    </div>
  );
}
