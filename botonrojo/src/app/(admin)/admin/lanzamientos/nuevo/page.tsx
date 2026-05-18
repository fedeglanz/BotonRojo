import { LAUNCH_TYPES, type LaunchType } from "@/lib/launch-types";
import { createLaunchAction } from "@/server/launches";
import { SubmitButton } from "@/components/admin/submit-button";
import Link from "next/link";

type SearchParams = Promise<{ type?: string }>;

export default async function NuevoLanzamientoPage(props: { searchParams: SearchParams }) {
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
            Tipo seleccionado: <span className="text-white">{meta.label}</span> — {meta.description}
          </p>
        </div>
        <div className="text-4xl">{meta.icon}</div>
      </div>

      <form action={createLaunchAction} className="glass space-y-6 p-6">
        <input type="hidden" name="type" value={defaultType} />

        <label className="block">
          <span className="block text-xs uppercase tracking-widest text-zinc-400">Nombre del lanzamiento</span>
          <input
            type="text"
            name="name"
            required
            minLength={2}
            placeholder="Ej: Semilla · Productividad en 7 días"
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-[--color-red]"
          />
          <span className="mt-1 block text-xs text-zinc-500">
            Se usará para generar el slug público (ej. <code>/semilla-productividad-7-dias</code>).
          </span>
        </label>

        <label className="block">
          <span className="block text-xs uppercase tracking-widest text-zinc-400">Tipo</span>
          <select
            name="type"
            defaultValue={defaultType}
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-[--color-red]"
          >
            {(Object.keys(LAUNCH_TYPES) as LaunchType[]).map((k) => (
              <option key={k} value={k}>
                {LAUNCH_TYPES[k].label} — {LAUNCH_TYPES[k].tagline}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="block text-xs uppercase tracking-widest text-zinc-400">Brief</span>
          <textarea
            name="brief"
            required
            minLength={20}
            rows={8}
            placeholder={`Describe el lanzamiento como se lo contarías a un copywriter:\n\n- A quién va dirigido (avatar)\n- Qué transformación promete\n- Por qué este formato (${meta.label.toLowerCase()})\n- Precio aproximado\n- Fecha tentativa de apertura de carrito\n- Lo que sea relevante`}
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 font-[family-name:var(--font-mono)] text-sm text-white outline-none focus:border-[--color-red]"
          />
          <span className="mt-1 block text-xs text-zinc-500">
            Cuanto más concreto sea el brief, mejor sale el avatar y el copy.
          </span>
        </label>

        <label className="block">
          <span className="block text-xs uppercase tracking-widest text-zinc-400">Precio (€) — opcional</span>
          <input
            type="number"
            name="priceCents"
            min={0}
            step={100}
            placeholder="9700 = 97.00 €"
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-white outline-none focus:border-[--color-red]"
          />
          <span className="mt-1 block text-xs text-zinc-500">En céntimos. Lo podrás cambiar luego.</span>
        </label>

        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/admin"
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-400 transition hover:text-white"
          >
            Cancelar
          </Link>
          <SubmitButton pendingLabel="Creando…">Crear lanzamiento →</SubmitButton>
        </div>
      </form>
    </div>
  );
}
