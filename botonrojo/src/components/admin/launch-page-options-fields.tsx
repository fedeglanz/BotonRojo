"use client";

import { useState } from "react";
import { LAUNCH_TYPES, type LaunchType } from "@/lib/launch-types";

const fieldClass =
  "mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-[var(--color-red)]";

/**
 * The "Tipo" select plus whatever extra questions that type needs to resolve
 * its page set (src/lib/launch-pages.ts) — reactive to the type, so it has to
 * be a client component, but every input it renders still submits through
 * the same parent <form action={createLaunchAction}>.
 */
export function LaunchPageOptionsFields({
  defaultType,
}: {
  defaultType: LaunchType;
}) {
  const [type, setType] = useState<LaunchType>(defaultType);

  return (
    <>
      <label className="block">
        <span className="block text-xs uppercase tracking-widest text-zinc-400">
          Tipo
        </span>
        <select
          name="type"
          value={type}
          onChange={(e) => setType(e.target.value as LaunchType)}
          className={fieldClass}
        >
          {(Object.keys(LAUNCH_TYPES) as LaunchType[]).map((k) => (
            <option key={k} value={k}>
              {LAUNCH_TYPES[k].label} — {LAUNCH_TYPES[k].tagline}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs text-zinc-500">
          {LAUNCH_TYPES[type].pages}
        </span>
      </label>

      {/* Una newsletter no cobra nada: preguntar por el precio y los plazos sería
          pedir un dato que no va a usar nadie. */}
      {type !== "newsletter" && (
        <>
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
        </>
      )}

      {type === "plf" && (
        <>
          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-zinc-400">
              Canales de registro (uno por línea)
            </span>
            <textarea
              name="registroChannels"
              rows={3}
              placeholder={"Instagram\nEmail\nYouTube"}
              className={fieldClass}
            />
            <span className="mt-1 block text-xs text-zinc-500">
              Una página de registro distinta por canal, para poder enlazar cada
              una desde su campaña. Vacío = una sola página de registro
              genérica.
            </span>
          </label>

          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-zinc-400">
              Páginas de contenido (PLC)
            </span>
            <select
              name="contentPageCount"
              defaultValue={4}
              className={fieldClass}
            >
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </label>

          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-zinc-400">
              Fecha de inicio del contenido (día 1)
            </span>
            <input
              type="datetime-local"
              name="contentDripStartsAt"
              className={fieldClass}
            />
            <span className="mt-1 block text-xs text-zinc-500">
              La página 1 se abre este día; la 2, 3 y 4 se abren un día después
              cada una. Vacío = todas visibles desde el principio.
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-black/30 p-4">
            <input
              type="checkbox"
              name="includeAffiliateRegistro"
              className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-red-bright)]"
            />
            <span>
              <span className="block text-sm text-white">
                Incluir página de registro de afiliados
              </span>
              <span className="block text-xs text-zinc-500">Opcional.</span>
            </span>
          </label>
        </>
      )}

      <div className="block">
        <span className="block text-xs uppercase tracking-widest text-zinc-400">
          Páginas legales a incluir
        </span>
        <div className="mt-2 space-y-2 rounded-lg border border-white/10 bg-black/30 p-4">
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              name="legalPrivacidad"
              defaultChecked
              className="h-4 w-4 accent-[var(--color-red-bright)]"
            />
            Política de privacidad
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              name="legalTerminos"
              defaultChecked
              className="h-4 w-4 accent-[var(--color-red-bright)]"
            />
            Términos y condiciones
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              name="legalCookies"
              className="h-4 w-4 accent-[var(--color-red-bright)]"
            />
            Política de cookies
          </label>
        </div>
      </div>
    </>
  );
}
