"use client";

import { useState } from "react";

/**
 * Abre Claude con la instrucción, y la deja copiada por si acaso.
 *
 * Que el cuadro de texto aparezca ya rellenado depende de que Claude respete el
 * parámetro de la URL, y eso no lo controlamos. Lo que sí controlamos es que en el
 * mismo clic la instrucción quede en el portapapeles: si aparece escrita, perfecto,
 * y si no, es un pegar y ya está — en vez de volver al panel a buscar el texto.
 *
 * El orden importa: primero el portapapeles y después abrir. Escribir en el
 * portapapeles necesita el gesto del usuario, y si se abre la pestaña antes, el
 * navegador puede quitarle el foco a esta página y denegar la escritura.
 */
export function ClaudeGoButton({
  href,
  prompt,
  label,
  hasConnector,
  connectorHref = "/admin/conexion-claude",
}: {
  href: string;
  prompt: string;
  label: string;
  hasConnector: boolean;
  connectorHref?: string;
}) {
  const [copied, setCopied] = useState(false);

  if (!hasConnector) {
    return (
      <a
        href={connectorHref}
        title="Hace falta un token del conector para que Claude pueda trabajar en este lanzamiento"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-[11px] uppercase tracking-widest text-amber-300 transition hover:bg-amber-400/20"
      >
        Conectar Claude primero
      </a>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(prompt);
            setCopied(true);
          } catch {
            // Sin portapapeles se sigue adelante: el enlace es lo importante, y el
            // texto está visible debajo en "Ver qué le pide".
          }
          window.open(href, "_blank", "noopener");
        }}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[var(--color-red)]/40 bg-[var(--color-red)]/10 px-3 py-1.5 text-[11px] uppercase tracking-widest text-[var(--color-red-bright)] transition hover:bg-[var(--color-red)]/20"
      >
        {label} ↗
      </button>
      {copied && (
        <span className="text-[10px] text-zinc-500">
          Si el cuadro sale vacío, pégala: ya está copiada
        </span>
      )}
    </div>
  );
}
