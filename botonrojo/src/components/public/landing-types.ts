export type LandingHero = {
  headline?: string;
  subheadline?: string;
  cta?: string;
  imageUrl?: string;
  imagePrompt?: string;
};

export type LandingForWhom = {
  yes?: string[];
  no?: string[];
};

export type LandingPainBlock = {
  pain: string;
  solution: string;
  icon?: string;
};

export type LandingIncludeItem = {
  title: string;
  description: string;
  imageUrl?: string;
  imagePrompt?: string;
  icon?: string;
};

export type LandingAbout =
  | string
  | {
      text: string;
      creatorName?: string;
      creatorRole?: string;
      creatorImageUrl?: string;
      creatorImagePrompt?: string;
    };

export type LandingTestimonial = {
  quote: string;
  author: string;
  role?: string;
  imageUrl?: string;
};

export type LandingFinalCta = {
  headline?: string;
  subheadline?: string;
  button?: string;
};

export type LandingFaq = { q: string; a: string };

/** One purchase option shown side by side with others — `productSlug` must
 * match a real Stripe product the admin created for this launch; price/name
 * come from that product, never invented by the AI. */
export type LandingPricingTier = {
  productSlug: string;
  bullets?: string[];
  highlight?: string;
};

export type LandingSpeaker = {
  name: string;
  role?: string;
  imageUrl?: string;
  imagePrompt?: string;
};

export type LandingAgendaItem = { time: string; topic: string };

/**
 * How "boxes" (registration form, pain/solution blocks, includes cards,
 * testimonials, guarantee) are rendered. "glass" is Botón Rojo's own dark
 * HUD look (blurred dark card + corner brackets) and stays the default — the
 * rest are for brands that read as dated or mismatched in it.
 *
 * Resolved by `resolveVisualStyle` in lib/design/presets.ts, which is also
 * where the padding-by-density and hover treatments live.
 */
export type LandingCardStyle =
  | "glass"
  | "liquid"
  | "flat"
  | "outline"
  | "soft"
  | "brutal"
  | "editorial";

export type LandingCtaStyle = "solid" | "glow" | "outline" | "ghost" | "pill-arrow";

export type LandingStyle = {
  cardStyle?: LandingCardStyle;
  /** Resolved by `resolveCtaStyle` in lib/design/presets.ts. */
  ctaStyle?: LandingCtaStyle;
};

/**
 * Per-section design vocabulary. Deliberately a CLOSED set: the renderer only
 * knows how to paint these values, so anything else is dropped instead of
 * stored. An earlier version let the model invent fields (a `background` with
 * parallax/overlay) and that took the whole public page down — see
 * normalizeSectionDesign.
 */
// "gradient" and "spotlight" already existed in BACKGROUND_PRESETS but no
// vocabulary exposed them, so nothing could ever ask for them.
export type SectionBackground =
  | "none"
  | "tint"
  | "accent"
  | "dark"
  | "photo"
  | "gradient"
  | "spotlight";
export type SectionEffect = "none" | "orbit" | "geometry" | "aurora" | "grid" | "dots" | "noise";
/** Display treatment for the section's heading — the size/shape contrast the
 *  client keeps asking for, without touching the section components. */
export type SectionTitleFx = "none" | "gradient" | "outline";
export type SectionHeight = "auto" | "full";
export type SectionWidth = "normal" | "wide" | "full";

export type SectionOrbitItem = { label: string; href?: string };

export type SectionDesign = {
  /** Schema version, so an older stored row can be migrated on read. */
  version?: number;
  background?: SectionBackground;
  effect?: SectionEffect;
  height?: SectionHeight;
  width?: SectionWidth;
  align?: "start" | "center" | "end";
  density?: "compact" | "normal" | "spacious";
  style?: LandingCardStyle;
  divider?: "none" | "line" | "fade" | "angle" | "curve" | "dots";
  titleFx?: SectionTitleFx;
  /** Only meaningful with `background: "photo"`. */
  imageUrl?: string;
  imagePrompt?: string;
  /** Only meaningful with `effect: "orbit"`. */
  orbitItems?: SectionOrbitItem[];
};

export const SECTION_BACKGROUNDS: SectionBackground[] = [
  "none",
  "tint",
  "accent",
  "dark",
  "photo",
  "gradient",
  "spotlight",
];
export const SECTION_EFFECTS: SectionEffect[] = [
  "none",
  "orbit",
  "geometry",
  "aurora",
  "grid",
  "dots",
  "noise",
];
export const SECTION_TITLE_FX: SectionTitleFx[] = ["none", "gradient", "outline"];
export const SECTION_HEIGHTS: SectionHeight[] = ["auto", "full"];
export const SECTION_WIDTHS: SectionWidth[] = ["normal", "wide", "full"];

/**
 * The validator lives in `./section-design` — a single implementation, on
 * purpose. Two normalisers with the same name (one here, one there) meant the
 * server persisted through the weaker one, so the capability and compatibility
 * rules never reached the stored row.
 *
 * Import it from `@/components/public/section-design`, not from here.
 */

export type LandingBody = {
  hero?: LandingHero;
  forWhom?: LandingForWhom;
  amplifiedPromise?: string;
  /** 40-100 characters under the promise, set much smaller. Required shape when
   *  the promise carries the orbit: 4-6 big words can't say enough alone. */
  amplifiedPromiseSubline?: string;
  painBlocks?: LandingPainBlock[];
  includes?: LandingIncludeItem[];
  about?: LandingAbout;
  testimonials?: LandingTestimonial[];
  guarantee?: string;
  faq?: LandingFaq[];
  finalCta?: LandingFinalCta;
  style?: LandingStyle;
  /** Only rendered when the launch has more than one active Stripe product —
   * a single product keeps the plain CtaBlock, unchanged. */
  pricingTiers?: LandingPricingTier[];
  /** Short urgency line (e.g. "quedan pocas plazas") — copy only, no real
   * inventory tracking behind it. */
  scarcityNote?: string;
  speakers?: LandingSpeaker[];
  agenda?: LandingAgendaItem[];
  /** Optional override for middle-section order/inclusion, set only when the
   * client's general instructions asked to reorder or drop sections. */
  sectionOrder?: Array<Exclude<LandingSectionKey, "hero" | "finalCta">>;
  /** Per-section background/effect/height/width, set from the section refine
   * box or the design dropdowns. Absent = every section keeps its defaults. */
  sectionDesign?: Partial<Record<SectionDesignKey, SectionDesign>>;
};

/**
 * Bands that can carry a design. Wider than `LandingSectionKey` because the
 * countdown is rendered from the launch's cart date rather than from editable
 * body content, so it has no entry in LANDING_SECTIONS — but it's still a
 * visible band that can take a background or an effect.
 */
export type SectionDesignKey = LandingSectionKey | "countdown";

export const LANDING_SECTIONS = [
  "hero",
  "forWhom",
  "amplifiedPromise",
  "painBlocks",
  "speakers",
  "agenda",
  "includes",
  "pricingTiers",
  "about",
  "testimonials",
  "guarantee",
  "faq",
  "finalCta",
] as const;

export type LandingSectionKey = (typeof LANDING_SECTIONS)[number];

/** Sections whose value is a plain string, not an object or array. */
const STRING_SECTIONS = new Set<LandingSectionKey>(["amplifiedPromise", "guarantee"]);
/** Sections whose value is an array. */
const ARRAY_SECTIONS = new Set<LandingSectionKey>([
  "painBlocks",
  "includes",
  "testimonials",
  "faq",
  "speakers",
  "agenda",
  "pricingTiers",
]);

/**
 * Coerces an AI- or human-supplied section value into the shape the renderer
 * expects, or throws. Without this, a model that wraps its answer in the
 * section name (or invents fields like a `background` object) gets stored
 * verbatim and crashes the public page with "Objects are not valid as a React
 * child" — the page breaks far away from where the bad data came in.
 */
export function normalizeSectionValue(section: LandingSectionKey, raw: unknown): unknown {
  let value = raw;

  // Peel the wrappers models actually produce, in a loop because they combine:
  // `[{ forWhom: { yes, no } }]` is one array wrapper plus one key echo.
  for (let i = 0; i < 3; i++) {
    // `[ {...} ]` → `{...}`. A single-element array around an object section is
    // never meaningful; the model is just being conversational.
    if (Array.isArray(value) && value.length === 1 && !ARRAY_SECTIONS.has(section)) {
      value = value[0];
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj);
      // `{ amplifiedPromise: ... }` → `...` (model echoing the section key), and
      // the generic envelopes it reaches for when asked for "the value".
      if (keys.length === 1 && (keys[0] === section || ["value", "content", "data", "section"].includes(keys[0]))) {
        value = obj[keys[0]];
        continue;
      }
    }
    break;
  }

  // `forWhom` split across two objects: `[{ yes: [...] }, { no: [...] }]`.
  if (section === "forWhom" && Array.isArray(value)) {
    const merged = value
      .filter((v): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v))
      .reduce<Record<string, unknown>>((acc, v) => ({ ...acc, ...v }), {});
    if (Array.isArray(merged.yes) || Array.isArray(merged.no)) value = merged;
  }

  if (STRING_SECTIONS.has(section)) {
    if (typeof value === "string") return value;
    // Tolerate `{ text: "..." }`, a common shape for the model to volunteer.
    if (value && typeof value === "object" && typeof (value as { text?: unknown }).text === "string") {
      return (value as { text: string }).text;
    }
    throw new Error(
      `La IA devolvió la sección "${section}" con una forma que no encaja (se esperaba texto). ` +
        "No se ha guardado nada: vuelve a intentarlo o edítala a mano.",
    );
  }

  if (ARRAY_SECTIONS.has(section)) {
    if (Array.isArray(value)) return value;
    throw new Error(
      `La IA devolvió la sección "${section}" con una forma que no encaja (se esperaba una lista). ` +
        "No se ha guardado nada: vuelve a intentarlo o edítala a mano.",
    );
  }

  // `about` is legitimately either a string or an object.
  if (section === "about") {
    if (typeof value === "string" || (value && typeof value === "object" && !Array.isArray(value))) return value;
    throw new Error(
      'La IA devolvió la sección "about" con una forma que no encaja. ' +
        "No se ha guardado nada: vuelve a intentarlo o edítala a mano.",
    );
  }

  // hero / finalCta / forWhom / style
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  throw new Error(
    `La IA devolvió la sección "${section}" con una forma que no encaja (se esperaba un objeto). ` +
      "No se ha guardado nada: vuelve a intentarlo o edítala a mano.",
  );
}

export const SECTION_META: Record<LandingSectionKey, { label: string; description: string; hasImage: boolean }> = {
  hero: { label: "Hero", description: "Titular principal + subtítulo + CTA + imagen destacada", hasImage: true },
  forWhom: { label: "Para quién", description: "Listado sí/no — quién encaja y quién no", hasImage: false },
  amplifiedPromise: { label: "Promesa amplificada", description: "Frase grande con la transformación", hasImage: false },
  painBlocks: { label: "Dolor → solución", description: "Bloques de problemas y cómo se resuelven", hasImage: false },
  speakers: { label: "Ponentes", description: "Grid de ponentes/expertos — solo eventos con varios ponentes", hasImage: true },
  agenda: { label: "Agenda", description: "Horario → tema — solo eventos con agenda por franjas", hasImage: false },
  includes: { label: "Qué incluye", description: "Módulos / bonus con descripciones e imágenes opcionales", hasImage: false },
  pricingTiers: { label: "Niveles de precio", description: "Varias opciones de compra lado a lado — solo si hay más de un producto Stripe", hasImage: false },
  about: { label: "Sobre el creador", description: "Texto + foto del creador", hasImage: true },
  testimonials: { label: "Testimonios", description: "Placeholder de testimonios", hasImage: false },
  guarantee: { label: "Garantía", description: "Texto de garantía / devolución", hasImage: false },
  faq: { label: "FAQ", description: "Preguntas frecuentes", hasImage: false },
  finalCta: { label: "CTA final", description: "Llamada a la acción de cierre", hasImage: false },
};

/**
 * Which middle sections each launch type shows, and in what order. Lives here
 * rather than in the renderer because the generator needs the same list to
 * compose the page's design rhythm — two copies would drift.
 */
export type MiddleSectionKey = Exclude<LandingSectionKey, "hero" | "finalCta"> | "countdown";

export const LAYOUT_PRESETS: Record<"venta_directa" | "semilla" | "plf", MiddleSectionKey[]> = {
  // Evento con cierre: ponentes/agenda si los hay, niveles de precio y
  // countdown antes de la garantía, de cara al cierre.
  venta_directa: [
    "painBlocks",
    "speakers",
    "agenda",
    "amplifiedPromise",
    "includes",
    "pricingTiers",
    "countdown",
    "guarantee",
    "testimonials",
    "faq",
  ],
  // Validación ligera: corta y directa, sin Includes/About.
  semilla: ["forWhom", "amplifiedPromise", "testimonials", "faq"],
  // Secuencia larga: la más completa, incluye About porque la relación con
  // el creador pesa más en un PLF.
  plf: ["forWhom", "painBlocks", "includes", "about", "testimonials", "guarantee", "faq"],
};
