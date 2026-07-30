import {
  resolveBackground,
  resolveDivider,
  resolveVisualStyle,
  type BackgroundPreset,
  type DividerPreset,
  type VisualStylePreset,
} from "@/lib/design/presets";
import type { AlignmentTokens, DensityTokens } from "@/lib/design/tokens";
import { contrastRatio, type ThemeContext } from "@/lib/design/theme";
import type {
  SectionBackground,
  SectionDesign,
  SectionDesignKey,
  SectionEffect,
  SectionHeight,
  SectionWidth,
} from "./landing-types";

/** Bumped when the stored shape changes, so old rows can be migrated on read. */
export const SECTION_DESIGN_SCHEMA_VERSION = 2;

/**
 * What kind of section this is. Drives sensible defaults and compatibility
 * rules: an orbit around a 700-word block is never right, a photo band behind
 * a form hurts the form.
 */
export type SectionKind =
  | "hero"
  | "statement"
  | "list"
  | "cards"
  | "media"
  | "form"
  | "pricing"
  | "faq"
  | "cta"
  | "legal";

/** Raw, untrusted input: from the AI, the admin dropdowns, or an old DB row. */
export type SectionDesignInput = Partial<{
  version: number;
  background: string;
  effect: string;
  height: string;
  width: string;
  align: string;
  density: string;
  style: string;
  divider: string;
  imageUrl: string;
  imagePrompt: string;
  orbitItems: unknown;
  // Accepted aliases — see ALIASES.
  bg: string;
  fx: string;
  fullHeight: boolean;
  fullBleed: boolean;
  cardStyle: string;
}>;

/** Validated and defaulted, but not yet turned into classes. */
export type NormalizedSectionDesign = {
  version: number;
  background: SectionBackground;
  effect: SectionEffect;
  height: SectionHeight;
  width: SectionWidth;
  align: AlignmentTokens;
  density: DensityTokens;
  style: VisualStylePreset;
  divider: DividerPreset;
  imageUrl?: string;
  imagePrompt?: string;
  orbitItems?: Array<{ label: string; href?: string }>;
};

/** Ready to render: class strings and flags, no decisions left. */
export type ResolvedSectionDesign = {
  /** True when nothing differs from the defaults — callers skip the wrapper. */
  isDefault: boolean;
  wrapperClass: string;
  contentClass: string;
  dividerClass: string;
  background: SectionBackground;
  effect: SectionEffect;
  needsPhoto: boolean;
  forcesLightText: boolean;
  imageUrl?: string;
  orbitItems?: Array<{ label: string; href?: string }>;
};

export type ResolveOptions = {
  theme?: ThemeContext;
  kind?: SectionKind;
  /** Approximate characters of copy in the section. Used to reject an orbit
   *  around a long text block before it ships, not after. */
  contentLength?: number;
};

export type NormalizationIssue = {
  field: string;
  /** `dropped`: unknown value removed. `coerced`: mapped to something valid.
   *  `incompatible`: valid on its own but wrong with the rest. */
  kind: "dropped" | "coerced" | "incompatible";
  message: string;
};

export type ValidationResult = {
  ok: boolean;
  issues: NormalizationIssue[];
};

/** What each section kind is allowed to use. The generator reads this so it
 *  never offers an option that will be rejected downstream. */
export type DesignCapabilityMap = Record<
  SectionKind,
  { backgrounds: SectionBackground[]; effects: SectionEffect[]; allowFullHeight: boolean }
>;

/* ----------------------------------------------------------- vocabularies */

const BACKGROUNDS: SectionBackground[] = ["none", "tint", "accent", "dark", "photo"];
const EFFECTS: SectionEffect[] = ["none", "orbit", "geometry", "aurora", "grid"];
const HEIGHTS: SectionHeight[] = ["auto", "full"];
const WIDTHS: SectionWidth[] = ["normal", "wide", "full"];
const ALIGNMENTS: AlignmentTokens[] = ["start", "center", "end"];
const DENSITIES: DensityTokens[] = ["compact", "normal", "spacious"];
const STYLES: VisualStylePreset[] = ["glass", "flat", "outline", "soft", "brutal", "editorial"];
const DIVIDERS: DividerPreset[] = ["none", "line", "fade", "angle", "curve", "dots"];

/** Deprecated keys and values kept working, so nothing already stored breaks. */
const ALIASES: Record<string, string> = {
  bg: "background",
  fx: "effect",
  cardStyle: "style",
  // Values.
  solid: "none",
  image: "photo",
  glow: "aurora",
  circle: "orbit",
  lines: "grid",
};

export const DESIGN_CAPABILITIES: DesignCapabilityMap = {
  hero: { backgrounds: BACKGROUNDS, effects: EFFECTS, allowFullHeight: true },
  statement: { backgrounds: BACKGROUNDS, effects: EFFECTS, allowFullHeight: true },
  list: { backgrounds: ["none", "tint", "accent", "dark"], effects: ["none", "geometry", "aurora", "grid"], allowFullHeight: false },
  cards: { backgrounds: ["none", "tint", "accent", "dark"], effects: ["none", "geometry", "aurora", "grid"], allowFullHeight: false },
  media: { backgrounds: ["none", "tint", "dark"], effects: ["none", "aurora"], allowFullHeight: true },
  // A form needs maximum legibility: no photo behind it, no orbit stealing focus.
  form: { backgrounds: ["none", "tint", "dark"], effects: ["none", "aurora", "grid"], allowFullHeight: true },
  pricing: { backgrounds: ["none", "tint", "accent", "dark"], effects: ["none", "geometry", "grid"], allowFullHeight: false },
  faq: { backgrounds: ["none", "tint", "dark"], effects: ["none", "grid"], allowFullHeight: false },
  cta: { backgrounds: BACKGROUNDS, effects: EFFECTS, allowFullHeight: true },
  // Legal pages are documents: decoration would only hurt reading.
  legal: { backgrounds: ["none"], effects: ["none"], allowFullHeight: false },
};

/**
 * Which kind each landing section is. This is what makes the capability rules
 * actually bite: without it every section would be treated as a `statement`
 * and a photo band could still land behind the registration form.
 */
export const SECTION_KIND_BY_KEY: Record<SectionDesignKey, SectionKind> = {
  hero: "hero",
  forWhom: "list",
  amplifiedPromise: "statement",
  painBlocks: "cards",
  speakers: "cards",
  agenda: "list",
  includes: "cards",
  pricingTiers: "pricing",
  about: "media",
  testimonials: "cards",
  guarantee: "statement",
  faq: "faq",
  finalCta: "cta",
  countdown: "statement",
};

/** Per-kind starting point, used by inferMissingDesign(). */
const KIND_DEFAULTS: Partial<Record<SectionKind, Partial<NormalizedSectionDesign>>> = {
  hero: { height: "full", align: "center", density: "spacious" },
  statement: { align: "center", density: "spacious" },
  cards: { width: "wide" },
  pricing: { width: "wide", background: "tint" },
  faq: { align: "start" },
  cta: { align: "center", density: "spacious" },
  legal: { align: "start", density: "normal" },
};

/** An orbit puts the copy in a narrow column inside the ring; past this many
 *  characters the labels start colliding with the text. */
const ORBIT_MAX_CONTENT_LENGTH = 320;

/* -------------------------------------------------------------- functions */

function pick<T extends string>(value: unknown, allowed: T[]): T | undefined {
  if (typeof value !== "string") return undefined;
  const direct = allowed.find((a) => a === value);
  if (direct) return direct;
  const aliased = ALIASES[value];
  return aliased ? allowed.find((a) => a === aliased) : undefined;
}

function normalizeOrbitItems(raw: unknown): Array<{ label: string; href?: string }> | undefined {
  if (!Array.isArray(raw)) return undefined;
  const items = raw
    .filter((i): i is Record<string, unknown> => Boolean(i) && typeof i === "object")
    .map((i) => ({
      label: typeof i.label === "string" ? i.label.trim() : "",
      // Only relative or http(s) targets — blocks javascript: URLs.
      href:
        typeof i.href === "string" && /^(https?:\/\/|\/|#)/.test(i.href.trim()) ? i.href.trim() : undefined,
    }))
    .filter((i) => i.label.length > 0)
    .slice(0, 8);
  return items.length > 0 ? items : undefined;
}

/**
 * Turns untrusted input into a valid design, reporting what it had to change.
 * Silently discarding unknown keys is the point: the generator once invented a
 * `background: {type: "parallax"}` object, it got stored verbatim, and the
 * public page crashed. Nothing outside this vocabulary is ever persisted.
 */
export function normalizeSectionDesign(
  raw: unknown,
  options: ResolveOptions = {},
): { design: NormalizedSectionDesign | null; issues: NormalizationIssue[] } {
  const issues: NormalizationIssue[] = [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { design: null, issues };

  // Resolve key aliases first, so `bg`/`fx`/`cardStyle` land on real fields.
  const input: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const target = ALIASES[key] ?? key;
    if (target !== key) {
      issues.push({ field: key, kind: "coerced", message: `"${key}" es un alias de "${target}"` });
    }
    input[target] = value;
  }

  // Legacy booleans from the first iteration of the vocabulary.
  if (input.fullHeight === true && input.height === undefined) input.height = "full";
  if (input.fullBleed === true && input.width === undefined) input.width = "full";

  const kind = options.kind ?? "statement";
  const caps = DESIGN_CAPABILITIES[kind];
  const defaults = KIND_DEFAULTS[kind] ?? {};

  const track = <T extends string>(field: string, allowed: T[]): T | undefined => {
    if (input[field] === undefined) return undefined;
    const value = pick(input[field], allowed);
    if (!value) {
      issues.push({
        field,
        kind: "dropped",
        message: `"${String(input[field])}" no es un valor válido de ${field}; se ignora`,
      });
    }
    return value;
  };

  let background = track("background", BACKGROUNDS) ?? defaults.background ?? "none";
  let effect = track("effect", EFFECTS) ?? defaults.effect ?? "none";
  let height = track("height", HEIGHTS) ?? defaults.height ?? "auto";
  const width = track("width", WIDTHS) ?? defaults.width ?? "normal";
  const align = track("align", ALIGNMENTS) ?? defaults.align ?? "start";
  const density = track("density", DENSITIES) ?? defaults.density ?? "normal";
  const style = track("style", STYLES) ?? defaults.style ?? "glass";
  const divider = track("divider", DIVIDERS) ?? defaults.divider ?? "none";

  // Per-kind capability: valid in the abstract, not allowed here.
  if (!caps.backgrounds.includes(background)) {
    issues.push({
      field: "background",
      kind: "incompatible",
      message: `"${background}" no está permitido en una sección de tipo "${kind}"`,
    });
    background = "none";
  }
  if (!caps.effects.includes(effect)) {
    issues.push({
      field: "effect",
      kind: "incompatible",
      message: `el efecto "${effect}" no está permitido en una sección de tipo "${kind}"`,
    });
    effect = "none";
  }
  if (height === "full" && !caps.allowFullHeight) {
    issues.push({
      field: "height",
      kind: "incompatible",
      message: `una sección de tipo "${kind}" no debería ocupar toda la pantalla`,
    });
    height = "auto";
  }

  const design: NormalizedSectionDesign = {
    version: SECTION_DESIGN_SCHEMA_VERSION,
    background,
    effect,
    height,
    width,
    align,
    density,
    style,
    divider,
  };

  if (background === "photo") {
    if (typeof input.imageUrl === "string" && input.imageUrl.trim()) design.imageUrl = input.imageUrl.trim();
    if (typeof input.imagePrompt === "string" && input.imagePrompt.trim()) {
      design.imagePrompt = input.imagePrompt.trim();
    }
  }

  if (effect === "orbit") {
    const items = normalizeOrbitItems(input.orbitItems);
    if (items) design.orbitItems = items;

    // An orbit around a long block puts labels on the copy. Downgrade rather
    // than ship something illegible.
    if (options.contentLength && options.contentLength > ORBIT_MAX_CONTENT_LENGTH) {
      issues.push({
        field: "effect",
        kind: "incompatible",
        message: `la sección tiene demasiado texto (${options.contentLength} caracteres) para el efecto órbita; se usa "aurora"`,
      });
      design.effect = "aurora";
      delete design.orbitItems;
    }
  }

  return { design, issues };
}

/** Checks input without keeping the result — for the admin UI and tests. */
export function validateSectionDesign(raw: unknown, options: ResolveOptions = {}): ValidationResult {
  const { issues } = normalizeSectionDesign(raw, options);
  return { ok: issues.length === 0, issues };
}

/** Fills in what wasn't specified from the section kind's defaults. */
export function inferMissingDesign(
  partial: Partial<NormalizedSectionDesign> | null,
  kind: SectionKind,
): NormalizedSectionDesign {
  const { design } = normalizeSectionDesign({ ...(KIND_DEFAULTS[kind] ?? {}), ...(partial ?? {}) }, { kind });
  return (
    design ?? {
      version: SECTION_DESIGN_SCHEMA_VERSION,
      background: "none",
      effect: "none",
      height: "auto",
      width: "normal",
      align: "start",
      density: "normal",
      style: "glass",
      divider: "none",
    }
  );
}

/**
 * Applies theme-level choices a section didn't override. Section wins over
 * theme; theme wins over the hardcoded default.
 */
export function mergeSectionWithTheme(
  design: NormalizedSectionDesign,
  theme: ThemeContext,
): NormalizedSectionDesign {
  return {
    ...design,
    density: design.density ?? theme.density,
    // With reduced motion there is nothing to animate, so an ambient effect is
    // dead weight — swap the animated ones for the static geometry.
    effect:
      theme.a11y.reducedMotion && (design.effect === "aurora" || design.effect === "orbit")
        ? "geometry"
        : design.effect,
    // High contrast drops decorative tints that reduce text contrast.
    background: theme.a11y.highContrast && (design.background === "tint" || design.background === "accent")
      ? "none"
      : design.background,
  };
}

/**
 * Contrast of the section's text against its own background, as a WCAG ratio.
 * Reported so the design review can flag a band that fails AA instead of
 * relying on someone noticing.
 */
export function scoreSectionContrast(design: NormalizedSectionDesign, theme: ThemeContext): number {
  const fg = design.background === "dark" || design.background === "photo" ? "#ffffff" : theme.colors.text;
  const bg =
    design.background === "dark" || design.background === "photo"
      ? "#0a0a0a"
      : theme.palette?.background ?? theme.colors.bg;
  return Number(contrastRatio(fg, bg).toFixed(2));
}

/**
 * How much visual noise a section carries, 0..1. Design rule 10 asks for ONE
 * protagonist gesture per page, so the page-level check sums these and warns
 * when several sections are all shouting.
 */
export function scoreSectionComplexity(design: NormalizedSectionDesign): number {
  let score = 0;
  if (design.background !== "none") score += design.background === "photo" ? 0.35 : 0.15;
  if (design.effect !== "none") score += design.effect === "orbit" ? 0.4 : 0.25;
  if (design.height === "full") score += 0.15;
  if (design.divider !== "none") score += 0.05;
  return Number(Math.min(1, score).toFixed(2));
}

/** Whether a design suits a section kind, without normalizing it. */
export function checkSectionCompatibility(
  design: NormalizedSectionDesign,
  kind: SectionKind,
  contentLength?: number,
): ValidationResult {
  const caps = DESIGN_CAPABILITIES[kind];
  const issues: NormalizationIssue[] = [];

  if (!caps.backgrounds.includes(design.background)) {
    issues.push({ field: "background", kind: "incompatible", message: `"${design.background}" no encaja en "${kind}"` });
  }
  if (!caps.effects.includes(design.effect)) {
    issues.push({ field: "effect", kind: "incompatible", message: `"${design.effect}" no encaja en "${kind}"` });
  }
  if (design.height === "full" && !caps.allowFullHeight) {
    issues.push({ field: "height", kind: "incompatible", message: `"${kind}" no debería ir a pantalla completa` });
  }
  if (design.effect === "orbit" && contentLength && contentLength > ORBIT_MAX_CONTENT_LENGTH) {
    issues.push({ field: "effect", kind: "incompatible", message: "demasiado texto para el efecto órbita" });
  }
  if (design.background === "photo" && !design.imageUrl) {
    issues.push({ field: "imageUrl", kind: "incompatible", message: "fondo de foto sin imagen resuelta" });
  }

  return { ok: issues.length === 0, issues };
}

/* --------------------------------------------------------------- resolve */

/**
 * These must stay literal strings: Tailwind scans the source as text, so a
 * class built by interpolating a token (`max-w-[${CONTAINERS.wide}]`) is never
 * generated. The values mirror CONTAINERS.wide and LAYOUT.sectionY.
 */
const WIDTH_CLASSES: Record<SectionWidth, string> = {
  normal: "",
  wide: "[&_section]:max-w-[80rem]",
  full: "[&_section]:max-w-none",
};

const ALIGN_CLASSES: Record<AlignmentTokens, string> = {
  start: "",
  center: "text-center",
  end: "text-right",
};

const DENSITY_CLASSES: Record<DensityTokens, string> = {
  compact: "[&_section]:!py-12",
  normal: "",
  spacious: "[&_section]:!py-32",
};

/**
 * Final step: classes and flags, nothing left to decide. Accepts either the
 * normalized shape or the older loose `SectionDesign`, so existing callers
 * (SectionShell) keep working while the pages are still on the old vocabulary.
 */
export function resolveSectionDesign(
  design?: SectionDesign | NormalizedSectionDesign | null,
  options: ResolveOptions = {},
): ResolvedSectionDesign {
  const d = design as Partial<NormalizedSectionDesign> | null | undefined;

  const background = d?.background ?? "none";
  const effect = d?.effect ?? "none";
  const height = d?.height ?? "auto";
  const width = d?.width ?? "normal";
  const align = d?.align ?? "start";
  const density = d?.density ?? options.theme?.density ?? "normal";
  const divider = d?.divider ?? "none";

  const isDefault =
    background === "none" &&
    effect === "none" &&
    height === "auto" &&
    width === "normal" &&
    align === "start" &&
    density === "normal" &&
    divider === "none";

  const bg = resolveBackground(background as BackgroundPreset);

  // The orbit's labels ride a ~52rem ring, so the copy must stay inside it or
  // they land on the text. This deliberately overrides the width token.
  const widthClass = effect === "orbit" ? "[&_section]:max-w-xl" : WIDTH_CLASSES[width];

  return {
    isDefault,
    // `overflow-hidden` is per-section so decoration is clipped to its own band
    // rather than by a global clip on <main>.
    wrapperClass: [
      "relative w-full overflow-hidden",
      bg.className,
      height === "full" ? "flex min-h-[100svh] items-center" : "",
      widthClass,
      DENSITY_CLASSES[density],
      ALIGN_CLASSES[align],
    ]
      .filter(Boolean)
      .join(" "),
    contentClass: "relative z-10 w-full",
    dividerClass: resolveDivider(divider as DividerPreset),
    background,
    effect,
    needsPhoto: bg.needsPhoto,
    forcesLightText: bg.forcesLightText,
    imageUrl: d?.imageUrl,
    orbitItems: d?.orbitItems,
  };
}

/** Re-exported so callers get the component chrome from the same place. */
export { resolveVisualStyle };
