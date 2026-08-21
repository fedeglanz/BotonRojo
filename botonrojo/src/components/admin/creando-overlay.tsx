"use client";

import { useEffect, useState } from "react";
import {
  Planet,
  TYPE_PLANET_COLOR,
  TYPE_PLANET_KIND,
} from "@/components/planet";
import { LAUNCH_TYPE_KEYS, type LaunchType } from "@/lib/launch-types";
import { pageConfigFromFormData, resolvePages } from "@/lib/launch-pages";

const MENSAJES = [
  "Creando el lanzamiento…",
  "Reservando su dirección pública…",
  "Preparando sus páginas…",
  "Proponiendo la identidad visual…",
  "Abriendo el lanzamiento…",
];

/**
 * La espera de crear un lanzamiento, a pantalla completa.
 *
 * Crear tarda unos segundos —reserva el slug, monta la configuración de páginas
 * y propone la identidad visual— y el único aviso era el botón hundido al final
 * de un formulario largo: con la vista abajo, la pantalla parecía muerta y daban
 * ganas de volver a pulsar.
 *
 * Lo que aparece es el planeta del tipo que estás creando, con una luna por cada
 * página que va a tener. No es una animación de relleno: es el mismo planeta que
 * verás en el panel dentro de unos segundos, así que la espera ya enseña lo que
 * has pedido. Las lunas salen apagadas porque todavía no hay ninguna página
 * hecha.
 *
 * Recibe el `FormData` del envío en vez de leerlo por su cuenta: quien lo tiene
 * es `useFormStatus`, y ese hook solo funciona donde funciona — ver el comentario
 * de `BotonRojo`.
 */
export function PantallaEspera({ data }: { data: FormData | null }) {
  const [mensaje, setMensaje] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setMensaje((i) => (i + 1) % MENSAJES.length),
      2200,
    );
    return () => clearInterval(id);
  }, []);

  const tipoEnviado = String(data?.get("type") ?? "");
  const tipo: LaunchType = (LAUNCH_TYPE_KEYS as readonly string[]).includes(
    tipoEnviado,
  )
    ? (tipoEnviado as LaunchType)
    : "venta_directa";

  const nombre = String(data?.get("name") ?? "").trim();
  let paginas = 0;
  try {
    paginas = data ? resolvePages(tipo, pageConfigFromFormData(data)).length : 0;
  } catch {
    // Contar las páginas es un adorno de la espera; si el formulario trae algo
    // raro, el planeta sale sin lunas antes que sin pantalla.
    paginas = 0;
  }

  return (
    <div className="creando-backdrop" role="status" aria-live="polite">
      <Planet
        palette={null}
        fallbackColor={TYPE_PLANET_COLOR[tipo]}
        kind={TYPE_PLANET_KIND[tipo]}
        moons={Array.from({ length: paginas }, () => "pendiente" as const)}
        size="min(58vh, 58vw)"
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
