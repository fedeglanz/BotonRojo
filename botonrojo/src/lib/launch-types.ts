export type LaunchType = "venta_directa" | "semilla" | "plf";

export const LAUNCH_TYPES: Record<LaunchType, {
  label: string;
  tagline: string;
  description: string;
  color: string;
  icon: string;
}> = {
  venta_directa: {
    label: "Venta Directa",
    tagline: "Evento de lanzamiento",
    description: "Webinar o sesión en vivo con oferta al cierre.",
    color: "from-red-500 to-orange-500",
    icon: "🔴",
  },
  semilla: {
    label: "Semilla",
    tagline: "Validación directa",
    description: "Lanzamiento ligero para validar oferta sin evento.",
    color: "from-fuchsia-500 to-pink-500",
    icon: "🌱",
  },
  plf: {
    label: "PLF",
    tagline: "Product Launch Formula",
    description: "Secuencia clásica: pre-pre, pre, contenido, carrito.",
    color: "from-violet-500 to-indigo-500",
    icon: "🚀",
  },
};
