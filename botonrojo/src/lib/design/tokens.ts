/**
 * Design tokens for the page generator.
 *
 * Two layers, deliberately separated:
 * - PRIMITIVES are raw values with no meaning attached (a spacing step, a hex).
 * - SEMANTIC tokens say what a value is *for* (surface, border, text-muted).
 *
 * Only semantic tokens should be referenced by components. That indirection is
 * what lets one launch be light and another dark without touching a component.
 *
 * Theme mode is DERIVED from the launch's approved brand palette (see
 * `theme.ts`), not from the visitor's OS preference: a brand that approved a
 * white background must not flip to dark because someone's phone is in dark
 * mode. `prefers-color-scheme` is only a fallback when there is no palette.
 */

export type ThemeMode = "light" | "dark";

/* ------------------------------------------------------------------ colour */

/** Raw palette input: exactly what the brand kit approves. */
export type ColorPrimitives = {
  primary: string;
  accent: string;
  background: string;
  foreground: string;
};

/**
 * What components actually consume. Every entry is a CSS colour string, so it
 * can be emitted as a custom property and used from Tailwind arbitrary values.
 */
export type SemanticColors = {
  /** Page background. */
  bg: string;
  /** Raised surface (cards, panels). */
  surface: string;
  /** Surface one step further from the page (nested cards, inputs). */
  surfaceRaised: string;
  /** Body text. */
  text: string;
  /** Secondary text — still readable, lower emphasis. */
  textMuted: string;
  /** Tertiary text: labels, captions. Do not use for body copy. */
  textSubtle: string;
  /** Text that sits on top of `primary` / `accent` fills. */
  textOnAccent: string;
  primary: string;
  primaryHover: string;
  accent: string;
  accentSoft: string;
  border: string;
  borderStrong: string;
  /** Focus ring — must stay visible on every surface above. */
  focus: string;
  /** Status colours keep their conventional hue: a green "yes" that turned
   *  brand-red would stop communicating. */
  success: string;
  warning: string;
  danger: string;
};

/* -------------------------------------------------------------- typography */

export type TypographyPrimitives = {
  /** Font families as full CSS stacks. */
  display: string;
  body: string;
  mono: string;
  /** Modular type scale, rem strings, small → large. */
  size: {
    "3xs": string;
    "2xs": string;
    xs: string;
    sm: string;
    base: string;
    lg: string;
    xl: string;
    "2xl": string;
    "3xl": string;
    "4xl": string;
    "5xl": string;
    "6xl": string;
    "7xl": string;
  };
  weight: { regular: number; medium: number; semibold: number; bold: number; black: number };
  leading: { tight: string; snug: string; normal: string; relaxed: string };
  tracking: { tighter: string; tight: string; normal: string; wide: string; widest: string };
};

/** Named roles, so a component asks for "eyebrow" rather than picking sizes. */
export type TypographySemantics = {
  displayXl: string;
  display: string;
  headline: string;
  title: string;
  subtitle: string;
  body: string;
  bodySmall: string;
  caption: string;
  /** Small uppercase mono label above a heading. */
  eyebrow: string;
  /** Numeric/monospace emphasis: countdowns, prices. */
  numeric: string;
};

export const TYPOGRAPHY: TypographyPrimitives = {
  display: 'var(--font-display, "Space Grotesk", system-ui, sans-serif)',
  body: 'var(--font-sans, "Inter", system-ui, sans-serif)',
  mono: 'var(--font-mono, "JetBrains Mono", ui-monospace, monospace)',
  size: {
    "3xs": "0.625rem",
    "2xs": "0.6875rem",
    xs: "0.75rem",
    sm: "0.875rem",
    base: "1rem",
    lg: "1.125rem",
    xl: "1.25rem",
    "2xl": "1.5rem",
    "3xl": "1.875rem",
    "4xl": "2.25rem",
    "5xl": "3rem",
    "6xl": "3.75rem",
    "7xl": "4.5rem",
  },
  weight: { regular: 400, medium: 500, semibold: 600, bold: 700, black: 800 },
  leading: { tight: "1.05", snug: "1.2", normal: "1.5", relaxed: "1.65" },
  tracking: { tighter: "-0.03em", tight: "-0.015em", normal: "0", wide: "0.06em", widest: "0.2em" },
};

/* ------------------------------------------------------------------ scales */

/** 4px base, doubling rhythm — matches the 8/16/24/32 rule in the design rules. */
export type SpacingScale = Record<
  "0" | "px" | "1" | "2" | "3" | "4" | "5" | "6" | "8" | "10" | "12" | "16" | "20" | "24" | "32" | "40",
  string
>;

export const SPACING: SpacingScale = {
  "0": "0",
  px: "1px",
  "1": "0.25rem",
  "2": "0.5rem",
  "3": "0.75rem",
  "4": "1rem",
  "5": "1.25rem",
  "6": "1.5rem",
  "8": "2rem",
  "10": "2.5rem",
  "12": "3rem",
  "16": "4rem",
  "20": "5rem",
  "24": "6rem",
  "32": "8rem",
  "40": "10rem",
};

export type RadiusScale = Record<"none" | "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "full", string>;

export const RADIUS: RadiusScale = {
  none: "0",
  sm: "0.25rem",
  md: "0.5rem",
  lg: "0.75rem",
  xl: "1rem",
  "2xl": "1.5rem",
  "3xl": "2rem",
  full: "999px",
};

/** Elevation. `glow` is brand-coloured rather than neutral, hence separate. */
export type ShadowScale = Record<"none" | "sm" | "md" | "lg" | "xl" | "inner" | "glow", string>;

export type BorderTokens = {
  width: { hairline: string; thin: string; thick: string };
  style: { solid: string; dashed: string };
};

export const BORDERS: BorderTokens = {
  width: { hairline: "1px", thin: "1.5px", thick: "2px" },
  style: { solid: "solid", dashed: "dashed" },
};

/* ------------------------------------------------------------------ layout */

export type LayoutTokens = {
  /** Vertical rhythm between page sections, by density. */
  sectionY: { compact: string; normal: string; spacious: string };
  /** Horizontal page gutter, mobile → desktop. */
  gutter: { sm: string; md: string };
  /** Grid gaps. */
  gap: { sm: string; md: string; lg: string };
  /** Full-viewport height. `svh` avoids the mobile URL-bar jump that `vh` has. */
  viewportHeight: string;
};

export const LAYOUT: LayoutTokens = {
  sectionY: { compact: SPACING["12"], normal: SPACING["20"], spacious: SPACING["32"] },
  gutter: { sm: SPACING["6"], md: SPACING["8"] },
  gap: { sm: SPACING["4"], md: SPACING["6"], lg: SPACING["12"] },
  viewportHeight: "100svh",
};

/** Mobile-first: every value is a min-width. */
export type BreakpointTokens = Record<"sm" | "md" | "lg" | "xl" | "2xl", string>;

export const BREAKPOINTS: BreakpointTokens = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
};

/** Content measures. `prose` is capped for line-length legibility, not looks. */
export type ContainerTokens = Record<"prose" | "narrow" | "normal" | "wide" | "full", string>;

export const CONTAINERS: ContainerTokens = {
  prose: "42rem",
  narrow: "36rem",
  normal: "72rem",
  wide: "80rem",
  full: "none",
};

/* ------------------------------------------------------------------ motion */

/**
 * Motion is dual-resolved: `resolveMotion()` in theme.ts returns the `reduced`
 * variant when the visitor asks for less movement, so a component never has to
 * check the preference itself.
 */
export type MotionTokens = {
  duration: { instant: string; fast: string; normal: string; slow: string; slower: string };
  easing: { standard: string; out: string; in: string; spring: string };
  /** Ambient loops (drifting glows, orbits) — long by design. */
  ambient: { slow: string; slower: string };
  /** Stagger between children of a revealed group. */
  stagger: string;
};

export const MOTION: MotionTokens = {
  duration: { instant: "0.001ms", fast: "150ms", normal: "300ms", slow: "600ms", slower: "900ms" },
  easing: {
    standard: "cubic-bezier(0.4, 0, 0.2, 1)",
    out: "cubic-bezier(0.16, 1, 0.3, 1)",
    in: "cubic-bezier(0.5, 0, 0.75, 0)",
    spring: "cubic-bezier(0.34, 1.56, 0.64, 1)",
  },
  ambient: { slow: "22s", slower: "28s" },
  stagger: "0.12s",
};

/* ----------------------------------------------------- effects and surfaces */

export type EffectTokens = {
  blur: { sm: string; md: string; lg: string };
  /** Backdrop blur for glass surfaces. */
  backdrop: string;
  /** Opacity steps for decorative layers. */
  decorOpacity: { faint: string; soft: string; visible: string };
  /** Scrim over a photo so text stays legible on top of it. */
  scrim: string;
};

export const EFFECTS: EffectTokens = {
  blur: { sm: "8px", md: "24px", lg: "60px" },
  backdrop: "blur(20px) saturate(150%)",
  decorOpacity: { faint: "0.08", soft: "0.18", visible: "0.32" },
  scrim: "72%",
};

export type MediaTokens = {
  aspect: { square: string; video: string; portrait: string; wide: string; ultrawide: string };
  fit: { cover: string; contain: string };
  /** Rounding applied to media by default. */
  radius: string;
};

export const MEDIA: MediaTokens = {
  aspect: { square: "1 / 1", video: "16 / 9", portrait: "3 / 4", wide: "3 / 2", ultrawide: "21 / 9" },
  fit: { cover: "cover", contain: "contain" },
  radius: RADIUS["2xl"],
};

/* ------------------------------------------------------------- interaction */

export type InteractionTokens = {
  /** Minimum touch target — 44px is the accessibility floor, not a preference. */
  minTouchTarget: string;
  hover: { lift: string; scale: string };
  press: { scale: string };
  focus: { ringWidth: string; ringOffset: string };
  /** Cursor for elements that look clickable. */
  cursor: string;
};

export const INTERACTION: InteractionTokens = {
  minTouchTarget: "44px",
  hover: { lift: "-2px", scale: "1.02" },
  press: { scale: "0.99" },
  focus: { ringWidth: "2px", ringOffset: "2px" },
  cursor: "pointer",
};

/** How tightly a page packs its content. Drives spacing, not font size. */
export type DensityTokens = "compact" | "normal" | "spacious";

export type AlignmentTokens = "start" | "center" | "end";

/* ---------------------------------------------------------- accessibility */

/**
 * Runtime accessibility state. Resolved once per render and passed down, so
 * behaviour is decided in one place instead of scattered media queries.
 */
export type AccessibilityFlags = {
  /** Visitor asked for less movement — ambient loops must not run. */
  reducedMotion: boolean;
  /** Visitor asked for higher contrast: drop decorative tints and scrims. */
  highContrast: boolean;
  /** Minimum contrast ratio enforced when deriving text colours. */
  minContrastRatio: number;
};

export const ACCESSIBILITY_DEFAULTS: AccessibilityFlags = {
  reducedMotion: false,
  highContrast: false,
  // WCAG AA for body text.
  minContrastRatio: 4.5,
};

/** Layer order. Centralised because "which thing covers which" is a frequent
 *  source of invisible bugs (a decorative layer eating clicks, a modal behind
 *  a sticky bar). */
export const Z_INDEX = {
  behind: -1,
  base: 0,
  decor: 1,
  content: 10,
  raised: 20,
  sticky: 30,
  overlay: 40,
  modal: 50,
  toast: 60,
} as const;

export type ZIndexToken = keyof typeof Z_INDEX;
