"use client";

import { useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  Planet,
  TYPE_PLANET_COLOR,
  TYPE_PLANET_KIND,
} from "@/components/admin/planet";
import { LAUNCH_TYPE_KEYS, type LaunchType } from "@/lib/launch-types";
import { pageConfigFromFormData, resolvePages } from "@/lib/launch-pages";

const MENSAJES = [
  "Creando el lanzamiento…",
  "Reservando su dirección pública…",
  "Preparando sus páginas…",
  "Dejando el panel listo…",
];

/**
 * La espera de crear un lanzamiento, a pantalla completa.
 *
 * Crear tarda —hay que reservar el slug, montar la configuración de páginas y
 * dejar la cola preparada— y hasta ahora lo único que decía que algo estaba
 * pasando era un botón hundido al final de un formulario largo: si habías
 * bajado la vista, la pantalla parecía muerta y daban ganas de volver a pulsar.
 *
 * Lo que aparece es el planeta del tipo que estás creando, con una luna por
 * cada página que va a tener. No es una animación cualquiera puesta a hacer
 * bulto: es exactamente lo que verás en el panel dentro de unos segundos, así
 * que la espera ya te enseña lo que estás pidiendo. Las lunas salen apagadas
 * porque ninguna página está hecha todavía; se irán encendiendo en el panel.
 *
 * Va dentro del `<form>` a propósito: `useFormStatus` solo sabe del envío si
 * cuelga de él, y de paso el mismo `FormData` que se está enviando dice qué
 * tipo y qué páginas dibujar, sin duplicar estado en ningún sitio.
 */
export function CreandoOverlay() {
  const { pending, data } = useFormStatus();
  const [mensaje, setMensaje] = useState(0);

  useEffect(() => {
    if (!pending) {
      setMensaje(0);
      return;
    }
    const id = setInterval(
      () => setMensaje((i) => (i + 1) % MENSAJES.length),
      2200,
    );
    return () => clearInterval(id);
  }, [pending]);

  if (!pending) return null;

  const tipoEnviado = String(data?.get("type") ?? "");
  const tipo: LaunchType = (LAUNCH_TYPE_KEYS as readonly string[]).includes(
    tipoEnviado,
  )
    ? (tipoEnviado as LaunchType)
    : "venta_directa";

  const nombre = String(data?.get("name") ?? "").trim();
  const paginas = data
    ? resolvePages(tipo, pageConfigFromFormData(data)).length
    : 0;

  return (
    <div className="creando-backdrop" role="status" aria-live="polite">
      <Planet
        palette={null}
        fallbackColor={TYPE_PLANET_COLOR[tipo]}
        kind={TYPE_PLANET_KIND[tipo]}
        moons={Array.from({ length: paginas }, () => "pendiente" as const)}
        size="min(60vh, 60vw)"
      />

      <div className="space-y-2 text-center">
        {nombre && (
          <div className="font-[family-name:var(--font-display)] text-2xl font-bold text-white md:text-3xl">
            {nombre}
          </div>
        )}
        <div className="text-sm uppercase tracking-[0.2em] text-zinc-400">
          {MENSAJES[mensaje]}
        </div>
        {paginas > 0 && (
          <div className="text-xs text-zinc-500">
            {paginas} páginas por delante — una luna por cada una
          </div>
        )}
      </div>
    </div>
  );
}
