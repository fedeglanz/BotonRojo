"use client";

import { SubmitButton } from "./submit-button";

type Props = {
  launchId: string;
  currentBrief: string | null;
  saveAction: (launchId: string, formData: FormData) => Promise<void>;
};

/**
 * The brief, editable after the fact.
 *
 * It used to be write-once, set on the creation form and never shown again — and
 * everything downstream reads it: the brand kit, the copy frame, every page. A
 * launch that arrived without one (an import, a seeded example, a form somebody
 * rushed) was stuck for good, and the only feedback was a server error page.
 */
export function BriefForm({ launchId, currentBrief, saveAction }: Props) {
  return (
    <form
      action={saveAction.bind(null, launchId)}
      className="space-y-2 rounded-lg border border-white/10 bg-black/30 p-4"
    >
      <label className="block">
        <span className="block text-xs uppercase tracking-widest text-zinc-400">
          Brief del lanzamiento
        </span>
        <span className="mt-1 block text-xs text-zinc-500">
          Qué vendes, a quién y cómo es el lanzamiento. De aquí sale todo lo
          demás: la identidad visual, el marco de copy y las páginas.
        </span>
        <textarea
          name="brief"
          rows={4}
          defaultValue={currentBrief ?? ""}
          placeholder="Ej: formación de 6 semanas para autónomos que facturan a mano y tienen que cumplir con VeriFactu. Semilla con webinar de apertura y cierre de carrito en 5 días."
          className="field-input mt-2 w-full px-3 py-2 text-sm text-white"
        />
      </label>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-zinc-500">Mínimo 20 caracteres.</span>
        <SubmitButton variant="ghost" pendingLabel="Guardando…">
          Guardar brief
        </SubmitButton>
      </div>
    </form>
  );
}
