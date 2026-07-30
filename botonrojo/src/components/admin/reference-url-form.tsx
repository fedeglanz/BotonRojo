"use client";

import { SubmitButton } from "./submit-button";

type Props = {
  launchId: string;
  currentUrl: string | null;
  saveAction: (launchId: string, formData: FormData) => Promise<void>;
};

export function ReferenceUrlForm({ launchId, currentUrl, saveAction }: Props) {
  return (
    <form
      action={saveAction.bind(null, launchId)}
      className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-white/10 bg-black/30 p-4"
    >
      <label className="block flex-1 min-w-[240px]">
        <span className="block text-xs uppercase tracking-widest text-zinc-400">Web de referencia</span>
        <span className="mt-1 block text-xs text-zinc-500">
          Se analiza su estructura y tono (nunca sus colores) al generar la landing.
        </span>
        <input
          type="url"
          name="referenceUrl"
          defaultValue={currentUrl ?? ""}
          placeholder="https://..."
          className="field-input mt-2 w-full px-3 py-2 text-sm text-white"
        />
      </label>
      <SubmitButton variant="ghost" pendingLabel="Guardando…">
        Guardar referencia
      </SubmitButton>
    </form>
  );
}
