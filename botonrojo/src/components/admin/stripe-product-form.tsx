import { SubmitButton } from "./submit-button";
import type { Product } from "@/db/schema/products";

type Props = {
  launchId: string;
  defaultName: string;
  defaultDescription: string;
  defaultPriceCents: number | null;
  defaultCurrency: string;
  existingProducts: Product[];
  action: (launchId: string, formData: FormData) => Promise<void>;
  deleteAction: (launchId: string, formData: FormData) => Promise<void>;
};

export function StripeProductForm({
  launchId,
  defaultName,
  defaultDescription,
  defaultPriceCents,
  defaultCurrency,
  existingProducts,
  action,
  deleteAction,
}: Props) {
  const hasTiers = existingProducts.length > 0;

  return (
    <div className="space-y-5">
      {existingProducts.map((p) => (
        <div
          key={p.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm"
        >
          <div>
            <div className="text-xs uppercase tracking-widest text-emerald-300">Producto creado en Stripe</div>
            <div className="mt-1 text-white">{p.name}</div>
            <div className="font-[family-name:var(--font-mono)] text-xs text-zinc-400">{p.stripePriceId}</div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right font-[family-name:var(--font-display)] text-xl font-bold">
              {(p.priceCents / 100).toFixed(2)} {p.currency}
            </div>
            {existingProducts.length > 1 && (
              <form action={deleteAction.bind(null, launchId)}>
                <input type="hidden" name="productId" value={p.id} />
                <SubmitButton variant="ghost" pendingLabel="Quitando…">
                  Quitar
                </SubmitButton>
              </form>
            )}
          </div>
        </div>
      ))}

      <form action={action.bind(null, launchId)} className="grid gap-4 md:grid-cols-2">
        {hasTiers && (
          <label className="block md:col-span-2">
            <span className="block text-xs uppercase tracking-widest text-zinc-400">
              Nivel (para distinguirlo del resto, ej. "vip", "platinum")
            </span>
            <input
              type="text"
              name="tierKey"
              required
              placeholder="vip"
              className="mt-2 w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-[--color-red]"
            />
          </label>
        )}

        <label className="block md:col-span-2">
          <span className="block text-xs uppercase tracking-widest text-zinc-400">Nombre del producto</span>
          <input
            type="text"
            name="name"
            required
            defaultValue={hasTiers ? "" : defaultName}
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-[--color-red]"
          />
        </label>

        <label className="block md:col-span-2">
          <span className="block text-xs uppercase tracking-widest text-zinc-400">Descripción</span>
          <textarea
            name="description"
            rows={3}
            defaultValue={hasTiers ? "" : defaultDescription}
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-[--color-red]"
          />
        </label>

        <label className="block">
          <span className="block text-xs uppercase tracking-widest text-zinc-400">Precio (céntimos)</span>
          <input
            type="number"
            name="priceCents"
            required
            min={100}
            step={100}
            defaultValue={hasTiers ? undefined : defaultPriceCents ?? 9700}
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-[--color-red]"
          />
        </label>

        <label className="block">
          <span className="block text-xs uppercase tracking-widest text-zinc-400">Moneda</span>
          <select
            name="currency"
            defaultValue={defaultCurrency}
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-[--color-red]"
          >
            <option value="EUR">EUR</option>
            <option value="USD">USD</option>
            <option value="GBP">GBP</option>
          </select>
        </label>

        <div className="md:col-span-2 flex justify-end">
          <SubmitButton pendingLabel="Creando en Stripe…">
            {hasTiers ? "Añadir otro nivel" : "Crear producto en Stripe"}
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
