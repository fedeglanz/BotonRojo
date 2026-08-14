"use client";

import { useState } from "react";

/**
 * Copia al portapapeles la instrucción para Claude.
 *
 * Existe porque el botón que abre Claude con el mensaje puesto depende de que Claude
 * respete el parámetro de la URL, y eso no está en nuestra mano. Copiar y pegar
 * funciona siempre, así que es el camino que no puede fallar — y además deja ver
 * exactamente qué se le está pidiendo, que es lo que hacía falta para entenderlo.
 */
export function CopyPromptButton({
  prompt,
  label = "Copiar la instrucción",
}: {
  prompt: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  return (
    <div className="w-full space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(prompt).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            });
          }}
          className="shrink-0 rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] uppercase tracking-widest text-zinc-200 transition hover:border-white/40"
        >
          {copied ? "Copiada ✓" : label}
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="text-[11px] uppercase tracking-widest text-zinc-500 underline underline-offset-2 hover:text-zinc-300"
        >
          {open ? "Ocultar" : "Ver qué le pide"}
        </button>
      </div>

      {open && (
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-white/10 bg-black/50 p-3 font-[family-name:var(--font-mono)] text-[11px] leading-relaxed text-zinc-300">
          {prompt}
        </pre>
      )}
    </div>
  );
}
