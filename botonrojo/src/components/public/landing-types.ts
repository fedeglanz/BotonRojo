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

export type LandingStyle = {
  palette?: string[];
  fonts?: string[];
  motion?: string;
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
};

export const LANDING_SECTIONS = [
  "hero",
  "forWhom",
  "amplifiedPromise",
  "painBlocks",
  "includes",
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
  includes: { label: "Qué incluye", description: "Módulos / bonus con descripciones e imágenes opcionales", hasImage: false },
  about: { label: "Sobre el creador", description: "Texto + foto del creador", hasImage: true },
  testimonials: { label: "Testimonios", description: "Placeholder de testimonios", hasImage: false },
  guarantee: { label: "Garantía", description: "Texto de garantía / devolución", hasImage: false },
  faq: { label: "FAQ", description: "Preguntas frecuentes", hasImage: false },
  finalCta: { label: "CTA final", description: "Llamada a la acción de cierre", hasImage: false },
};
