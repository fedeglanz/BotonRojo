import type { BrandDesign, BrandPalette } from "@/db/schema/launches";
import { brandThemeMode } from "@/components/public/brand-style";

/**
 * The brand kit's design decisions, validated. Same principle as the section
 * vocabulary: the model picks from closed lists and anything else is replaced by
 * a sane value, so an invented `cardStyle: "neumorphic"` can never reach a page.
 */
const CARD_STYLES = ["glass", "liquid", "flat", "outline", "soft", "brutal", "editorial"] as const;
const CTA_STYLES = ["solid", "glow", "outline", "ghost", "pill-arrow"] as const;
const DENSITIES = ["compact", "normal", "spacious"] as const;
const TITLE_FX = ["none", "gradient", "outline"] as const;
const DIVIDERS = ["none", "line", "fade", "angle", "curve", "dots"] as const;
const INTENSITIES = ["sobrio", "equilibrado", "expresivo"] as const;
const EFFECTS = ["none", "orbit", "geometry", "aurora", "grid", "dots", "noise"] as const;

export const BRAND_DESIGN_OPTIONS = {
  cardStyle: CARD_STYLES,
  ctaStyle: CTA_STYLES,
  density: DENSITIES,
  titleFx: TITLE_FX,
  divider: DIVIDERS,
  intensity: INTENSITIES,
  effects: EFFECTS,
} as const;

/** Human labels for the admin selects — the raw tokens mean nothing to a client. */
export const BRAND_DESIGN_LABELS = {
  cardStyle: {
    glass: "Cristal oscuro (HUD) — solo con fondo oscuro",
    liquid: "Cristal líquido — refracta el fondo, el más llamativo",
    flat: "Plano — borde sutil, discreto",
    outline: "Solo borde — minimalista",
    soft: "Suave — sombra difusa, cálido",
    brutal: "Brutalista — borde grueso, mucho carácter",
    editorial: "Editorial — sin caja, solo aire",
  },
  ctaStyle: {
    solid: "Relleno plano",
    glow: "Relleno con resplandor",
    outline: "Solo borde",
    ghost: "Sin caja",
    "pill-arrow": "Pastilla que se abre al pasar el ratón",
  },
  density: { compact: "Compacta", normal: "Normal", spacious: "Con mucho aire" },
  titleFx: {
    none: "Normal",
    gradient: "Degradado de marca",
    outline: "Hueco (solo contorno)",
  },
  divider: {
    none: "Sin transición",
    line: "Línea",
    fade: "Desvanecido",
    angle: "Diagonal",
    curve: "Curva",
    dots: "Puntos",
  },
  intensity: {
    sobrio: "Sobrio — casi sin decoración",
    equilibrado: "Equilibrado — un gesto por página",
    expresivo: "Expresivo — decoración en varias bandas",
  },
  effects: {
    none: "Ninguno",
    aurora: "Resplandor en movimiento",
    orbit: "Círculo con elementos girando",
    geometry: "Geometría grande",
    grid: "Retícula técnica",
    dots: "Retícula de puntos",
    noise: "Grano",
  },
} as const;

function pick<T extends readonly string[]>(value: unknown, allowed: T, fallback: T[number]): T[number] {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T[number])
    : fallback;
}

/**
 * Defaults chosen from the palette rather than fixed: `glass` is a dark card, so
 * proposing it on a light brand would produce the grey-slab failure by default.
 */
export function defaultBrandDesign(palette: BrandPalette | null): BrandDesign {
  const light = brandThemeMode(palette) === "light";
  return {
    cardStyle: light ? "liquid" : "glass",
    ctaStyle: "glow",
    density: "normal",
    titleFx: "none",
    divider: "fade",
    intensity: "equilibrado",
    effects: ["aurora"],
  };
}

export function normalizeBrandDesign(raw: unknown, palette: BrandPalette | null): BrandDesign {
  const base = defaultBrandDesign(palette);
  if (!raw || typeof raw !== "object") return base;
  const input = raw as Record<string, unknown>;

  const effects = Array.isArray(input.effects)
    ? input.effects
        .filter((e): e is string => typeof e === "string")
        .map((e) => pick(e, EFFECTS, "none"))
        .filter((e, i, all) => all.indexOf(e) === i)
        .slice(0, 3)
    : base.effects;

  const design: BrandDesign = {
    cardStyle: pick(input.cardStyle, CARD_STYLES, base.cardStyle),
    ctaStyle: pick(input.ctaStyle, CTA_STYLES, base.ctaStyle),
    density: pick(input.density, DENSITIES, base.density),
    titleFx: pick(input.titleFx, TITLE_FX, base.titleFx),
    divider: pick(input.divider, DIVIDERS, base.divider),
    intensity: pick(input.intensity, INTENSITIES, base.intensity),
    effects: effects.length > 0 ? effects : base.effects,
  };

  // `glass` is always a dark card; on a light brand it renders as an unreadable
  // grey slab. Correct it here rather than hoping the model remembered.
  if (design.cardStyle === "glass" && brandThemeMode(palette) === "light") design.cardStyle = "liquid";

  return design;
}

/** The approved system, described for the page-generation prompt. */
export function describeBrandDesign(design: BrandDesign): string {
  return [
    `- Cajas: "${design.cardStyle}" (${BRAND_DESIGN_LABELS.cardStyle[design.cardStyle]}).`,
    `- Botón principal: "${design.ctaStyle}".`,
    `- Densidad: "${design.density}". Titulares: "${design.titleFx}". Separadores: "${design.divider}".`,
    `- Nivel de decoración: ${design.intensity}.`,
    `- Efectos que encajan con esta marca, por orden: ${design.effects.join(", ")}.`,
  ].join("\n");
}
