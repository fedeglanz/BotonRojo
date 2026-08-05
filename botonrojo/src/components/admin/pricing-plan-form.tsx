"use client";

import { SubmitButton } from "./submit-button";

type Props = {
  launchId: string;
  currentPriceCents: number | null;
  currentInstallmentCount: number | null;
  currentInstallmentPriceCents: number | null;
  currency: string;
  saveAction: (launchId: string, formData: FormData) => Promise<void>;
};

/** Céntimos → el número que se escribe en el campo ("9750" → "97.50"). */
function toInput(cents: number | null): string {
  return cents === null ? "" : (cents / 100).toFixed(2);
}

/**
 * Precio y pago a plazos.
 *
 * En euros con decimales, no en céntimos: el formulario pedía céntimos a saltos de
 * 100, así que un precio de 97,50 € no se podía expresar.
 *
 * Los plazos van aquí y no en los niveles de precio porque no son otro producto:
 * es el mismo, pagado en varias veces. Y su importe no se deduce del total — 97
 * entre 3 no da un número que se pueda cobrar —, así que se escribe.
 */
export function PricingPlanForm({
  launchId,
  currentPriceCents,
  currentInstallmentCount,
  currentInstallmentPriceCents,
  currency,
  saveAction,
}: Props) {
  return (
    <form
      action={saveAction.bind(null, launchId)}
      className="space-y-3 rounded-lg border border-white/10 bg-black/30 p-4"
    >
      <div className="text-xs uppercase tracking-widest text-zinc-400">
        Precio y pago a plazos
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="block text-xs text-zinc-400">
            Pago único ({currency})
          </span>
          <input
            type="number"
            name="price"
            min={0}
            step="0.01"
            inputMode="decimal"
            defaultValue={toInput(currentPriceCents)}
            placeholder="97,00"
            className="field-input mt-2 w-full px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="block">
          <span className="block text-xs text-zinc-400">Nº de plazos</span>
          <input
            type="number"
            name="installmentCount"
            min={2}
            max={24}
            step={1}
            defaultValue={currentInstallmentCount ?? ""}
            placeholder="3"
            className="field-input mt-2 w-full px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="block">
          <span className="block text-xs text-zinc-400">
            Cada plazo ({currency})
          </span>
          <input
            type="number"
            name="installmentPrice"
            min={0}
            step="0.01"
            inputMode="decimal"
            defaultValue={toInput(currentInstallmentPriceCents)}
            placeholder="39,90"
            className="field-input mt-2 w-full px-3 py-2 text-sm text-white"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs text-zinc-500">
          Los plazos se mencionan en el copy con estas cifras exactas. Vacíos =
          sin plazos.
        </span>
        <SubmitButton variant="ghost" pendingLabel="Guardando…">
          Guardar precios
        </SubmitButton>
      </div>
    </form>
  );
}
