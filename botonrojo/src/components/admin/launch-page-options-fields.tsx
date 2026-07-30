"use client";

import { useState } from "react";
import { LAUNCH_TYPES, type LaunchType } from "@/lib/launch-types";

const fieldClass =
  "mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-4 py-3 text-sm text-white outline-none focus:border-[--color-red]";

/**
 * The "Tipo" select plus whatever extra questions that type needs to resolve
 * its page set (src/lib/launch-pages.ts) — reactive to the type, so it has to
 * be a client component, but every input it renders still submits through
 * the same parent <form action={createLaunchAction}>.
 */
export function LaunchPageOptionsFields({ defaultType }: { defaultType: LaunchType }) {
  const [type, setType] = useState<LaunchType>(defaultType);

  return (
    <>
      <label className="block">
        <span className="block text-xs uppercase tracking-widest text-zinc-400">Tipo</span>
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
        <span className="mt-1 block text-xs text-zinc-500">{LAUNCH_TYPES[type].pages}</span>
      </label>

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
              Una página de registro distinta por canal, para poder enlazar cada una desde su
              campaña. Vacío = una sola página de registro genérica.
            </span>
          </label>

          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-zinc-400">
              Páginas de contenido (PLC)
            </span>
            <select name="contentPageCount" defaultValue={4} className={fieldClass}>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </label>

          <label className="block">
            <span className="block text-xs uppercase tracking-widest text-zinc-400">
              Fecha de inicio del contenido (día 1)
            </span>
            <input type="datetime-local" name="contentDripStartsAt" className={fieldClass} />
            <span className="mt-1 block text-xs text-zinc-500">
              La página 1 se abre este día; la 2, 3 y 4 se abren un día después cada una. Vacío =
              todas visibles desde el principio.
            </span>
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-white/10 bg-black/30 p-4">
            <input
              type="checkbox"
              name="includeAffiliateRegistro"
              className="mt-0.5 h-4 w-4 shrink-0 accent-[--color-red-bright]"
            />
            <span>
              <span className="block text-sm text-white">Incluir página de registro de afiliados</span>
              <span className="block text-xs text-zinc-500">Opcional.</span>
            </span>
          </label>
        </>
      )}

      <div className="block">
        <span className="block text-xs uppercase tracking-widest text-zinc-400">Páginas legales a incluir</span>
        <div className="mt-2 space-y-2 rounded-lg border border-white/10 bg-black/30 p-4">
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" name="legalPrivacidad" defaultChecked className="h-4 w-4 accent-[--color-red-bright]" />
            Política de privacidad
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" name="legalTerminos" defaultChecked className="h-4 w-4 accent-[--color-red-bright]" />
            Términos y condiciones
          </label>
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" name="legalCookies" className="h-4 w-4 accent-[--color-red-bright]" />
            Política de cookies
          </label>
        </div>
      </div>
    </>
  );
}
