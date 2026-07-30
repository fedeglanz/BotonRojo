"use client";

import { SubmitButton } from "./submit-button";

type Props = {
  launchId: string;
  currentInstructions: string | null;
  saveAction: (launchId: string, formData: FormData) => Promise<void>;
};

export function LandingInstructionsForm({ launchId, currentInstructions, saveAction }: Props) {
  return (
    <form
      action={saveAction.bind(null, launchId)}
      className="mb-4 space-y-2 rounded-lg border border-white/10 bg-black/30 p-4"
    >
      <label className="block">
        <span className="block text-xs uppercase tracking-widest text-zinc-400">
          Instrucciones generales para esta página
        </span>
        <span className="mt-1 block text-xs text-zinc-500">
          Otro enfoque, otra estructura, quitar secciones, un fondo distinto… se aplican la próxima
          vez que generes o regeneres la landing.
        </span>
        <textarea
          name="instructions"
          rows={3}
          defaultValue={currentInstructions ?? ""}
          placeholder="Ej: enfócalo como algo educativo, no urgente. Quita los testimonios. Fondo con imagen de estudio de noche."
          className="field-input mt-2 w-full px-3 py-2 text-sm text-white"
        />
      </label>
      <div className="flex justify-end">
        <SubmitButton variant="ghost" pendingLabel="Guardando…">
          Guardar instrucciones
        </SubmitButton>
      </div>
    </form>
  );
}
