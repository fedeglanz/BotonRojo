"use client";

import { useEffect, useState } from "react";
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
 *
 * Y una vez enviado, la espera NO se quita. `pending` se apaga cuando el servidor
 * contesta, no cuando la pantalla cambia: la acción crea el lanzamiento y redirige,
 * pero cargar el panel del lanzamiento lleva sus segundos, y en ese hueco la
 * pantalla de espera desaparecía y volvía a verse el formulario, entero y con el
 * botón otra vez activo. Pasó lo que tenía que pasar: alguien lo pulsó de nuevo y
 * se creó un lanzamiento duplicado. Desde el primer envío esto ya no vuelve atrás —
 * lo único que puede pasar después es que la página cambie.
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
  // El último FormData visto: `data` vuelve a null en cuanto el envío termina, y la
  // pantalla de espera sigue en pie hasta que se navega — sin guardarlo, el planeta
  // se quedaría sin saber qué tipo de lanzamiento está creando.
  const [enviado, setEnviado] = useState<FormData | null>(null);

  useEffect(() => {
    if (pending && data) setEnviado(data);
  }, [pending, data]);

  const trabajando = pending || Boolean(enviado);

  return (
    <span className={trabajando || disabled ? undefined : "boton-rojo-halo"}>
      {espera && trabajando && <PantallaEspera data={data ?? enviado} />}
      <button
        type="submit"
        className="boton-rojo"
        data-enviando={trabajando ? "si" : undefined}
        disabled={trabajando || disabled}
      >
        {trabajando && (
          <span
            aria-hidden
            className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"
          />
        )}
        {trabajando ? pendingLabel : children}
      </button>
    </span>
  );
}
