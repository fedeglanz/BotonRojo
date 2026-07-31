"use client";

import { useState } from "react";
import { SubmitButton } from "./submit-button";
import { fieldValue, type PageField } from "@/lib/page-fields";

type Props = {
  launchId: string;
  pageKey: string;
  fields: PageField[];
  body: Record<string, unknown> | null;
  saveAction: (launchId: string, pageKey: string, formData: FormData) => Promise<void>;
  refineAction: (launchId: string, pageKey: string, formData: FormData) => Promise<void>;
};

/**
 * Part-by-part editor for the pages that aren't the sales page. They used to get
 * a single raw JSON textarea, which made them feel like an afterthought and put
 * the whole page one stray brace away from being unsavable.
 *
 * Each part is its own block: a real input, and an AI box scoped to that part so
 * an instruction about the headline can't rewrite the body copy.
 */
export function PagePartsEditor({
  launchId,
  pageKey,
  fields,
  body,
  saveAction,
  refineAction,
}: Props) {
  return (
    <div className="space-y-4">
      {fields.map((field) => (
        <PartBlock
          key={field.name}
          field={field}
          value={fieldValue(body, field)}
          launchId={launchId}
          pageKey={pageKey}
          saveAction={saveAction}
          refineAction={refineAction}
          resolvedImageUrl={
            field.name === "imagePrompt" && typeof body?.imageUrl === "string" ? body.imageUrl : null
          }
        />
      ))}
    </div>
  );
}

function PartBlock({
  field,
  value,
  launchId,
  pageKey,
  saveAction,
  refineAction,
  resolvedImageUrl,
}: {
  field: PageField;
  value: string;
  launchId: string;
  pageKey: string;
  saveAction: Props["saveAction"];
  refineAction: Props["refineAction"];
  resolvedImageUrl: string | null;
}) {
  const [showAi, setShowAi] = useState(false);
  const isEmpty = value.trim().length === 0;

  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-[family-name:var(--font-display)] text-sm font-bold text-white">
            {field.label}
          </h3>
          {field.help && <p className="mt-0.5 text-xs text-zinc-500">{field.help}</p>}
        </div>
        <div className="flex items-center gap-2">
          {isEmpty && (
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-zinc-500">
              vacío
            </span>
          )}
          <button
            type="button"
            onClick={() => setShowAi((v) => !v)}
            className="rounded-md border border-white/20 bg-white/[0.06] px-3 py-1.5 text-xs uppercase tracking-widest text-zinc-200 transition hover:border-white/40"
          >
            {showAi ? "Cerrar IA" : "Pedir a la IA"}
          </button>
        </div>
      </header>

      {/* One form per part: saving the headline can't send a half-edited body. */}
      <form action={saveAction.bind(null, launchId, pageKey)} className="space-y-2">
        {field.type === "text" ? (
          <input
            type="text"
            name={field.name}
            defaultValue={value}
            className="field-input w-full px-3 py-2 text-sm text-white"
          />
        ) : (
          <textarea
            name={field.name}
            rows={field.rows ?? 4}
            defaultValue={value}
            className="field-input w-full px-3 py-2 text-sm text-white"
          />
        )}

        {resolvedImageUrl && (
          <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-black/30 p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={resolvedImageUrl} alt="" className="h-14 w-20 rounded object-cover" />
            <p className="text-xs text-zinc-500">
              Imagen resuelta con esta descripción. Si la cambias y guardas, se busca otra.
            </p>
          </div>
        )}

        <div className="flex justify-end">
          <SubmitButton variant="ghost" pendingLabel="Guardando…">
            Guardar
          </SubmitButton>
        </div>
      </form>

      {showAi && (
        <form
          action={refineAction.bind(null, launchId, pageKey)}
          className="mt-3 space-y-2 rounded-lg border border-[--color-red]/25 bg-[--color-red]/5 p-3"
        >
          <input type="hidden" name="field" value={field.name} />
          <label className="block">
            <span className="block text-[10px] uppercase tracking-widest text-zinc-400">
              Qué quieres cambiar en “{field.label}”
            </span>
            <textarea
              name="instruction"
              rows={2}
              required
              placeholder="Más corto y directo, y que mencione que son tres entregas"
              className="field-input mt-1.5 w-full px-3 py-2 text-sm text-white"
            />
          </label>
          <div className="flex justify-end">
            <SubmitButton pendingLabel="Reescribiendo…">Reescribir esta parte</SubmitButton>
          </div>
        </form>
      )}
    </section>
  );
}
