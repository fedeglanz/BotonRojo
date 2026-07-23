"use client";

import { SubmitButton } from "@/components/admin/submit-button";

type LaunchOption = { id: string; slug: string; name: string };

export function AdSpendForm({
  launches,
  defaultLaunchId,
  action,
}: {
  launches: LaunchOption[];
  defaultLaunchId?: string;
  action: (formData: FormData) => Promise<void>;
}) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="glass flex flex-wrap items-end gap-3 p-4">
      <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-zinc-400">
        Lanzamiento
        <select name="launchId" required defaultValue={defaultLaunchId} className="field-input px-3 py-2 text-sm text-white">
          <option value="" disabled>
            Elige…
          </option>
          {launches.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-zinc-400">
        Canal
        <select name="channel" required className="field-input px-3 py-2 text-sm text-white">
          <option value="meta">Meta</option>
          <option value="google">Google</option>
          <option value="other">Otro</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-zinc-400">
        Fecha
        <input type="date" name="spendDate" required defaultValue={today} className="field-input px-3 py-2 text-sm text-white" />
      </label>

      <label className="flex flex-col gap-1 text-xs uppercase tracking-widest text-zinc-400">
        Gasto (€)
        <input
          type="number"
          name="amountEuros"
          required
          min="0"
          step="0.01"
          placeholder="150.00"
          className="field-input w-28 px-3 py-2 text-sm text-white"
        />
      </label>

      <label className="flex flex-1 min-w-[160px] flex-col gap-1 text-xs uppercase tracking-widest text-zinc-400">
        Notas
        <input type="text" name="notes" placeholder="opcional" className="field-input px-3 py-2 text-sm text-white" />
      </label>

      <SubmitButton pendingLabel="Guardando…">Añadir gasto</SubmitButton>
    </form>
  );
}
