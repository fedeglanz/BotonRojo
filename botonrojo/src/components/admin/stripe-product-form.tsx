import { SubmitButton } from "./submit-button";
import type { Product } from "@/db/schema/products";

type Props = {
  launchId: string;
  defaultName: string;
  defaultDescription: string;
  defaultPriceCents: number | null;
  defaultCurrency: string;
  existingProduct: Product | null;
  action: (launchId: string, formData: FormData) => Promise<void>;
};

export function StripeProductForm({
  launchId,
  defaultName,
  defaultDescription,
  defaultPriceCents,
  defaultCurrency,
  existingProduct,
  action,
}: Props) {
  if (existingProduct) {
    return (
      <div className="space-y-3 text-sm">
        <div className="flex items-center justify-between rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
          <div>
            <div className="text-xs uppercase tracking-widest text-emerald-300">Producto creado en Stripe</div>
            <div className="mt-1 text-white">{existingProduct.name}</div>
            <div className="font-[family-name:var(--font-mono)] text-xs text-zinc-400">
              {existingProduct.stripePriceId}
            </div>
          </div>
          <div className="text-right">
            <div className="font-[family-name:var(--font-display)] text-xl font-bold">
              {(existingProduct.priceCents / 100).toFixed(2)} {existingProduct.currency}
            </div>
          </div>
        </div>
        <p className="text-xs text-zinc-500">
          Para cambiar el precio, crea uno nuevo desde el dashboard de Stripe y actualiza{" "}
          <code className="text-[--color-red-bright]">products.stripe_price_id</code> en la DB.
        </p>
      </div>
    );
  }

  return (
    <form action={action.bind(null, launchId)} className="grid gap-4 md:grid-cols-2">
      <label className="block md:col-span-2">
        <span className="block text-xs uppercase tracking-widest text-zinc-400">Nombre del producto</span>
        <input
          type="text"
          name="name"
          required
          defaultValue={defaultName}
          className="mt-2 w-full rounded-lg border border-white/10 bg-black/60 px-3 py-2 text-sm text-white outline-none focus:border-[--color-red]"
        />
      </label>

      <label className="block md:col-span-2">
        <span className="block text-xs uppercase tracking-widest text-zinc-400">Descripción</span>
        <textarea
          name="description"
          rows={3}
          defaultValue={defaultDescription}
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
          defaultValue={defaultPriceCents ?? 9700}
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
        <SubmitButton pendingLabel="Creando en Stripe…">Crear producto en Stripe</SubmitButton>
      </div>
    </form>
  );
}
