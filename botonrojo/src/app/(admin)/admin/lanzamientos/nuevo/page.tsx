import { LAUNCH_TYPES, type LaunchType } from "@/lib/launch-types";
import { createLaunchAction } from "@/server/launches";
import { SubmitButton } from "@/components/admin/submit-button";
import { LaunchPageOptionsFields } from "@/components/admin/launch-page-options-fields";
import Link from "next/link";

type SearchParams = Promise<{ type?: string }>;

export default async function NuevoLanzamientoPage(props: {
  searchParams: SearchParams;
}) {
  const sp = await props.searchParams;
  const defaultType = (sp.type ?? "venta_directa") as LaunchType;
  const meta = LAUNCH_TYPES[defaultType] ?? LAUNCH_TYPES.venta_directa;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/admin"
            className="text-xs uppercase tracking-widest text-zinc-500 hover:text-zinc-300"
          >
            ← Panel
          </Link>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold">
            Nuevo lanzamiento
          </h1>
          <p className="mt-1 text-zinc-400">
            Tipo seleccionado: <span className="text-white">{meta.label}</span>{" "}
            — {meta.description}
          </p>
        </div>
        <div className="text-4xl">{meta.icon}</div>
      </div>

      <form action={createLaunchAction} className="glass space-y-6 p-6">
        <label className="block">
          <span className="block text-xs uppercase tracking-widest text-zinc-400">
            Nombre del lanzamiento
          </span>
          <input
            type="text"
            name="name"
            required
            minLength={2}
            placeholder="Ej: Semilla · Productividad en 7 días"
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-[var(--color-red)]"
          />
          <span className="mt-1 block text-xs text-zinc-500">
            Se usará para generar el slug público (ej.{" "}
            <code>/semilla-productividad-7-dias</code>).
          </span>
        </label>

        <LaunchPageOptionsFields defaultType={defaultType} />

        <label className="block">
          <span className="block text-xs uppercase tracking-widest text-zinc-400">
            Brief
          </span>
          <textarea
            name="brief"
            required
            minLength={20}
            rows={8}
            placeholder={`Describe el lanzamiento como se lo contarías a un copywriter:\n\n- A quién va dirigido (avatar)\n- Qué transformación promete\n- Por qué este formato (${meta.label.toLowerCase()})\n- Precio aproximado\n- Fecha tentativa de apertura de carrito\n- Lo que sea relevante`}
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 font-[family-name:var(--font-mono)] text-sm text-white outline-none focus:border-[var(--color-red)]"
          />
          <span className="mt-1 block text-xs text-zinc-500">
            Cuanto más concreto sea el brief, mejor sale el avatar y el copy.
          </span>
        </label>

        {/* En euros, con decimales. Antes pedía céntimos con salto de 100, así que
            "97,50 €" no se podía escribir y había que teclear 9700. */}
        <label className="block">
          <span className="block text-xs uppercase tracking-widest text-zinc-400">
            Precio (€) — opcional
          </span>
          <input
            type="number"
            name="price"
            min={0}
            step="0.01"
            inputMode="decimal"
            placeholder="97,50"
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-[var(--color-red)]"
          />
          <span className="mt-1 block text-xs text-zinc-500">
            El precio de pago único. Lo podrás cambiar luego.
          </span>
        </label>

        {/* Los plazos no son otro nivel de precio ni un descuento: es el mismo
            producto pagado en varias veces, y el importe no se puede deducir del
            total (97 entre 3 no da un número que se pueda cobrar). */}
        <fieldset className="rounded-lg border border-white/10 bg-black/20 p-4">
          <legend className="px-1 text-xs uppercase tracking-widest text-zinc-400">
            Pago a plazos — opcional
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="block text-xs text-zinc-400">
                ¿En cuántos plazos?
              </span>
              <input
                type="number"
                name="installmentCount"
                min={2}
                max={24}
                step={1}
                placeholder="3"
                className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-[var(--color-red)]"
              />
            </label>
            <label className="block">
              <span className="block text-xs text-zinc-400">
                Precio de cada plazo (€)
              </span>
              <input
                type="number"
                name="installmentPrice"
                min={0}
                step="0.01"
                inputMode="decimal"
                placeholder="39,90"
                className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-[var(--color-red)]"
              />
            </label>
          </div>
          <span className="mt-2 block text-xs text-zinc-500">
            Déjalo vacío si no hay plazos. Hacen falta los dos campos: el copy
            dirá “o 3 pagos de 39,90 €”, y con uno solo no habría frase que
            escribir.
          </span>
        </fieldset>

        <label className="block">
          <span className="block text-xs uppercase tracking-widest text-zinc-400">
            Web de referencia — opcional
          </span>
          <input
            type="url"
            name="referenceUrl"
            placeholder="https://..."
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-[var(--color-red)]"
          />
          <span className="mt-1 block text-xs text-zinc-500">
            Una página que te guste — se analiza su estructura y tono (nunca sus
            colores) para inspirar la landing. También lo podrás añadir luego.
          </span>
        </label>

        <div className="flex flex-col items-center gap-4 pt-6">
          <SubmitButton
            variant="ghost"
            className="big-red-button w-full text-xl md:text-2xl"
            pendingLabel="Creando lanzamiento…"
          >
            🚀 Crear lanzamiento
          </SubmitButton>
          <Link
            href="/admin"
            className="text-xs uppercase tracking-widest text-zinc-500 transition hover:text-white"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
