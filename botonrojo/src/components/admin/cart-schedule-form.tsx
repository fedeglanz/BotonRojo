"use client";

import { SubmitButton } from "./submit-button";

type Props = {
  launchId: string;
  currentCartClosesAt: Date | null;
  saveAction: (launchId: string, formData: FormData) => Promise<void>;
};

function toLocalInputValue(date: Date | null) {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function CartScheduleForm({ launchId, currentCartClosesAt, saveAction }: Props) {
  return (
    <form
      action={saveAction.bind(null, launchId)}
      className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-white/10 bg-black/30 p-4"
    >
      <label className="block">
        <span className="block text-xs uppercase tracking-widest text-zinc-400">Cierre del carrito</span>
        <span className="mt-1 block text-xs text-zinc-500">Alimenta el countdown de la landing. Vacío = sin countdown.</span>
        <input
          type="datetime-local"
          name="cartClosesAt"
          defaultValue={toLocalInputValue(currentCartClosesAt)}
          className="field-input mt-2 px-3 py-2 text-sm text-white"
        />
      </label>
      <SubmitButton variant="ghost" pendingLabel="Guardando…">
        Guardar fecha
      </SubmitButton>
    </form>
  );
}
