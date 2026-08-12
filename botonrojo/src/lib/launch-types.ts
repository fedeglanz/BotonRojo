/**
 * Los tipos de lanzamiento, en una sola lista.
 *
 * `LAUNCH_TYPE_KEYS` existe para que nadie tenga que repetirla: el validador del
 * formulario de creación la tenía escrita a mano y, al añadir "newsletter", crear uno
 * fallaba con un error de validación en una página en blanco. Todo lo que necesite la
 * lista la saca de aquí.
 */
export const LAUNCH_TYPE_KEYS = [
  "venta_directa",
  "semilla",
  "plf",
  "newsletter",
] as const;

export type LaunchType = (typeof LAUNCH_TYPE_KEYS)[number];

export const LAUNCH_TYPES: Record<LaunchType, {
  label: string;
  tagline: string;
  description: string;
  pages: string;
  color: string;
  icon: string;
}> = {
  venta_directa: {
    label: "Venta Directa",
    tagline: "Evento de lanzamiento",
    description: "Webinar o sesión en vivo con oferta al cierre.",
    pages: "Página de venta (sin registro) + su gracias por compra. Niveles de precio, countdown y ponentes si el evento los tiene. Legales opcionales.",
    color: "from-red-500 to-orange-500",
    icon: "🔴",
  },
  semilla: {
    label: "Semilla",
    tagline: "Validación directa",
    description: "Lanzamiento ligero para validar oferta sin evento.",
    pages: "Registro + venta, cada una con su gracias — siempre las dos. Legales opcionales.",
    color: "from-fuchsia-500 to-pink-500",
    icon: "🌱",
  },
  plf: {
    label: "PLF",
    tagline: "Product Launch Formula",
    description: "Secuencia clásica: pre-pre, pre, contenido, carrito.",
    pages: "Registro (una página por canal) + páginas de contenido + venta, cada una con su gracias. Afiliados y legales opcionales.",
    color: "from-violet-500 to-indigo-500",
    icon: "🚀",
  },
  newsletter: {
    label: "Newsletter",
    tagline: "Lista o lead magnet",
    description: "Captar suscriptores en abierto, sin carrito ni fechas.",
    pages:
      "Registro + gracias + baja de la lista, y legales opcionales. No hay venta, ni countdown, ni calendario: funciona en evergreen. Las campañas de email sí.",
    color: "from-sky-500 to-cyan-400",
    icon: "🪐",
  },
};
