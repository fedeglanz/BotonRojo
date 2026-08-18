"use client";

import { useFormStatus } from "react-dom";

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
 */
export function BotonRojo({
  children = "Lanzar",
  pendingLabel = "Creando el lanzamiento…",
  disabled,
}: {
  children?: React.ReactNode;
  pendingLabel?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();

  return (
    <span className={pending || disabled ? undefined : "boton-rojo-halo"}>
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
