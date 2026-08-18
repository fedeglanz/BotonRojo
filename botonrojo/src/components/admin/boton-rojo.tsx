"use client";

import { useFormStatus } from "react-dom";
import { PantallaEspera } from "@/components/admin/creando-overlay";

/**
 * El botón rojo: el que crea el lanzamiento.
 *
 * El producto se llama así y este era un botón de formulario más. Ahora es
 * físico —tiene cuerpo, se hunde al pulsarlo y suelta luz— porque es el único
 * gesto de toda la aplicación que dispara algo grande: a partir de ese clic la
 * plataforma se pone a escribir marca, copy y páginas durante minutos.
 *
 * Mientras trabaja se queda hundido y latiendo en vez de volver a su sitio. Un
 * botón que rebota hacia arriba después de pulsarlo dice "ya está", y aquí no
 * está: lo que viene después tarda.
 *
 * Con `espera`, además, tapa la pantalla entera con el planeta del lanzamiento
 * que se está creando. La pantalla de espera se dibuja desde aquí y no desde su
 * propio componente colgado del `<form>` porque allí `useFormStatus` devolvía
 * `pending: false` durante todo el envío —el mismo envío que este botón sí ve—,
 * y una espera que no aparece es peor que no tenerla. Aquí cuelga del único sitio
 * donde el hook responde.
 */
export function BotonRojo({
  children = "Lanzar",
  pendingLabel = "Creando el lanzamiento…",
  disabled,
  espera = false,
}: {
  children?: React.ReactNode;
  pendingLabel?: string;
  disabled?: boolean;
  /** Tapar la pantalla con el planeta mientras el formulario se envía. */
  espera?: boolean;
}) {
  const { pending, data } = useFormStatus();

  return (
    <span className={pending || disabled ? undefined : "boton-rojo-halo"}>
      {espera && pending && <PantallaEspera data={data ?? null} />}
      <button
        type="submit"
        className="boton-rojo"
        data-enviando={pending ? "si" : undefined}
        disabled={pending || disabled}
      >
        {pending && (
          <span
            aria-hidden
            className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
          />
        )}
        {pending ? pendingLabel : children}
      </button>
    </span>
  );
}
