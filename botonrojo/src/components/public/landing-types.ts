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
 * HUD look (blurred dark card + corner brackets) — the other three are
 * flatter, lighter-weight treatments for when that reads as dated or
 * mismatched with a lighter/more editorial brand.
 */
export type LandingCardStyle = "glass" | "flat" | "outline" | "soft";

export type LandingStyle = {
  cardStyle?: LandingCardStyle;
};

/**
 * Per-section design vocabulary. Deliberately a CLOSED set: the renderer only
 * knows how to paint these values, so anything else is dropped instead of
 * stored. An earlier version let the model invent fields (a `background` with
 * parallax/overlay) and that took the whole public page down — see
 * normalizeSectionDesign.
 */
export type SectionBackground = "none" | "tint" | "accent" | "dark" | "photo";
export type SectionEffect = "none" | "orbit" | "geometry" | "aurora" | "grid";
export type SectionHeight = "auto" | "full";
export type SectionWidth = "normal" | "wide" | "full";

export type SectionOrbitItem = { label: string; href?: string };

export type SectionDesign = {
  background?: SectionBackground;
  effect?: SectionEffect;
  height?: SectionHeight;
  width?: SectionWidth;
  /** Only meaningful with `background: "photo"`. */
  imageUrl?: string;
  imagePrompt?: string;
  /** Only meaningful with `effect: "orbit"`. */
  orbitItems?: SectionOrbitItem[];
};

export const SECTION_BACKGROUNDS: SectionBackground[] = ["none", "tint", "accent", "dark", "photo"];
export const SECTION_EFFECTS: SectionEffect[] = ["none", "orbit", "geometry", "aurora", "grid"];
export const SECTION_HEIGHTS: SectionHeight[] = ["auto", "full"];
export const SECTION_WIDTHS: SectionWidth[] = ["normal", "wide", "full"];

/**
 * Keeps only recognised keys and values. Silently discarding is the point:
 * "make it parallax with a background video" should degrade to a design the
 * renderer can actually draw, never to a stored field nobody reads.
 * Returns null when nothing survives, so callers can skip storing anything.
 */
export function normalizeSectionDesign(raw: unknown): SectionDesign | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const input = raw as Record<string, unknown>;
  const design: SectionDesign = {};

  const pick = <T extends string>(value: unknown, allowed: T[]): T | undefined =>
    typeof value === "string" && (allowed as string[]).includes(value) ? (value as T) : undefined;

  const background = pick(input.background, SECTION_BACKGROUNDS);
  const effect = pick(input.effect, SECTION_EFFECTS);
  const height = pick(input.height, SECTION_HEIGHTS);
  const width = pick(input.width, SECTION_WIDTHS);

  if (background) design.background = background;
  if (effect) design.effect = effect;
  if (height) design.height = height;
  if (width) design.width = width;

  // Image fields only make sense for a photo background.
  if (background === "photo") {
    if (typeof input.imageUrl === "string" && input.imageUrl.trim()) design.imageUrl = input.imageUrl.trim();
    if (typeof input.imagePrompt === "string" && input.imagePrompt.trim()) {
      design.imagePrompt = input.imagePrompt.trim();
    }
  }

  // Orbit items only for the orbit effect, and only well-formed entries.
  if (effect === "orbit" && Array.isArray(input.orbitItems)) {
    const items = input.orbitItems
      .filter((i): i is Record<string, unknown> => Boolean(i) && typeof i === "object")
      .map((i) => ({
        label: typeof i.label === "string" ? i.label.trim() : "",
        // Only same-origin/relative or http(s) links — no javascript: URLs.
        href:
          typeof i.href === "string" && /^(https?:\/\/|\/|#)/.test(i.href.trim())
            ? i.href.trim()
            : undefined,
      }))
      .filter((i) => i.label.length > 0)
      .slice(0, 8);
    if (items.length > 0) design.orbitItems = items;
  }

  return Object.keys(design).length > 0 ? design : null;
}

export type LandingBody = {
  hero?: LandingHero;
  forWhom?: LandingForWhom;
  amplifiedPromise?: string;
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

  // Unwrap `{ amplifiedPromise: ... }` → `...` (model echoing the section key).
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const keys = Object.keys(value as Record<string, unknown>);
    if (keys.length === 1 && keys[0] === section) {
      value = (value as Record<string, unknown>)[section];
    }
  }

  if (STRING_SECTIONS.has(section)) {
    if (typeof value === "string") return value;
    // Tolerate `{ text: "..." }`, a common shape for the model to volunteer.
    if (value && typeof value === "object" && typeof (value as { text?: unknown }).text === "string") {
      return (value as { text: string }).text;
    }
    throw new Error(`section_shape_invalid: "${section}" debe ser texto`);
  }

  if (ARRAY_SECTIONS.has(section)) {
    if (Array.isArray(value)) return value;
    throw new Error(`section_shape_invalid: "${section}" debe ser una lista`);
  }

  // `about` is legitimately either a string or an object.
  if (section === "about") {
    if (typeof value === "string" || (value && typeof value === "object" && !Array.isArray(value))) return value;
    throw new Error(`section_shape_invalid: "about" debe ser texto u objeto`);
  }

  // hero / finalCta / forWhom / style
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  throw new Error(`section_shape_invalid: "${section}" debe ser un objeto`);
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
