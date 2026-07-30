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
};

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
