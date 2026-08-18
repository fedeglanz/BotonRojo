import { LAUNCH_TYPES, type LaunchType } from "@/lib/launch-types";
import { createLaunchAction } from "@/server/launches";
import { BotonRojo } from "@/components/admin/boton-rojo";
import { CreandoOverlay } from "@/components/admin/creando-overlay";
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
        <CreandoOverlay />

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

        {/* Quién diseña. Con "claude", en vez de proponer nosotros una identidad
            visual que iba a sustituir, se deja escrita la cola de trabajo y un solo
            mensaje en Claude la recorre entera. */}
        <fieldset className="rounded-lg border border-white/10 bg-black/20 p-4">
          <legend className="px-1 text-xs uppercase tracking-widest text-zinc-400">
            Quién diseña este lanzamiento
          </legend>
          <div className="space-y-3">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="radio"
                name="designMode"
                value="boton_rojo"
                defaultChecked
                className="mt-1 accent-[var(--color-red)]"
              />
              <span>
                <span className="block text-sm font-medium text-white">
                  Botón Rojo
                </span>
                <span className="block text-xs text-zinc-500">
                  Propone la identidad visual al crear el lanzamiento y compone
                  las páginas con su sistema de diseño. Todo desde el panel.
                </span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="radio"
                name="designMode"
                value="claude"
                className="mt-1 accent-[var(--color-red)]"
              />
              <span>
                <span className="block text-sm font-medium text-white">
                  Claude Design
                </span>
                <span className="block text-xs text-zinc-500">
                  Deja apuntado el trabajo —identidad visual y cada página— y te
                  da un botón que abre Claude para hacerlo del tirón. Necesita
                  el conector conectado y plan pro.
                </span>
              </span>
            </label>
          </div>
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

        <div className="flex flex-col items-center gap-4 pt-8">
          <BotonRojo pendingLabel="Creando el lanzamiento…">
            Crear lanzamiento
          </BotonRojo>
          <p className="max-w-md text-center text-xs text-zinc-500">
            Al pulsarlo se crea el lanzamiento y se pone a trabajar: tarda un par de
            minutos y luego te dice paso a paso qué hacer.
          </p>
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
