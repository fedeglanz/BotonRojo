/**
 * Presets are named combinations of tokens. They exist so the generator (and
 * the AI) picks from a short list of art directions that are all known to work,
 * instead of assembling raw tokens and producing something incoherent.
 *
 * Every preset resolves to class strings that reference SEMANTIC variables, so
 * a preset looks right on any approved palette, light or dark.
 */

export type VisualStylePreset =
  | "glass"
  | "liquid"
  | "flat"
  | "outline"
  | "soft"
  | "brutal"
  | "editorial";

export type ComponentAppearanceTokens = {
  /** Classes for the container itself. */
  box: string;
  /** Padding class, by density. */
  padding: { compact: string; normal: string; spacious: string };
  /** Whether the sci-fi corner brackets suit this style. */
  hudCorners: boolean;
  /** Hover treatment, if the component is interactive. */
  hover: string;
};

/**
 * `glass` is Botón Rojo's own dark HUD look and stays the default so existing
 * pages don't change. The rest are for brands that read as dated in it.
 */
export const VISUAL_STYLE_PRESETS: Record<VisualStylePreset, ComponentAppearanceTokens> = {
  glass: {
    box: "glass",
    padding: { compact: "p-4", normal: "p-6", spacious: "p-8" },
    hudCorners: true,
    hover: "glass-hover",
  },
  // Refracting lens with a specular edge — see .liquid-glass in globals.css.
  // Needs something behind it to refract, so it belongs on bands that carry a
  // background, a photo or an effect.
  liquid: {
    box: "liquid-glass",
    padding: { compact: "p-5", normal: "p-7", spacious: "p-10" },
    hudCorners: false,
    hover: "liquid-glass-hover",
  },
  flat: {
    box: "rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]",
    padding: { compact: "p-4", normal: "p-6", spacious: "p-8" },
    hudCorners: false,
    hover: "transition hover:border-[var(--color-border-strong)]",
  },
  outline: {
    box: "rounded-2xl border-2 border-[var(--color-accent)]/40 bg-transparent",
    padding: { compact: "p-4", normal: "p-6", spacious: "p-8" },
    hudCorners: false,
    hover: "transition hover:border-[var(--color-accent)]",
  },
  soft: {
    box: "rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_20px_50px_-30px_rgba(0,0,0,0.35)]",
    padding: { compact: "p-5", normal: "p-7", spacious: "p-10" },
    hudCorners: false,
    hover: "transition hover:-translate-y-0.5 hover:shadow-[0_28px_60px_-30px_rgba(0,0,0,0.45)]",
  },
  // Hard edges, thick borders, no blur — leans on the contrast the client likes.
  brutal: {
    box: "rounded-none border-2 border-[var(--color-text)] bg-[var(--color-surface)]",
    padding: { compact: "p-4", normal: "p-6", spacious: "p-8" },
    hudCorners: false,
    hover: "transition hover:-translate-y-0.5 hover:shadow-[6px_6px_0_0_var(--color-accent)]",
  },
  // Almost no chrome: a rule and generous space. For long-form content.
  editorial: {
    box: "rounded-none border-0 border-t border-[var(--color-border)] bg-transparent",
    padding: { compact: "pt-4", normal: "pt-6", spacious: "pt-10" },
    hudCorners: false,
    hover: "",
  },
};

export function resolveVisualStyle(preset?: VisualStylePreset | null): ComponentAppearanceTokens {
  return VISUAL_STYLE_PRESETS[preset ?? "glass"];
}

/* ---------------------------------------------------------------- CTA -- */

export type CTAStylePreset = "solid" | "glow" | "outline" | "ghost" | "pill-arrow";

/** Only ONE dominant CTA per page (design rule 1) — these are for that one
 *  button plus its quieter secondary variants. */
export const CTA_STYLE_PRESETS: Record<CTAStylePreset, string> = {
  // The existing hero button, kept as-is.
  glow: "big-red-button",
  solid:
    "inline-flex items-center justify-center gap-2 rounded-full bg-[var(--color-primary)] px-8 py-4 font-[family-name:var(--font-display)] text-base font-extrabold uppercase tracking-wide text-[var(--color-text-on-accent)] transition hover:brightness-110",
  outline:
    "inline-flex items-center justify-center gap-2 rounded-full border-2 border-[var(--color-accent)] px-8 py-4 font-[family-name:var(--font-display)] text-base font-extrabold uppercase tracking-wide text-[var(--color-accent)] transition hover:bg-[var(--color-accent-soft)]",
  ghost:
    "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-[var(--color-text-muted)] transition hover:text-[var(--color-text)]",
  "pill-arrow":
    "group inline-flex items-center justify-center gap-3 rounded-full bg-[var(--color-primary)] px-8 py-4 font-[family-name:var(--font-display)] text-base font-extrabold uppercase tracking-wide text-[var(--color-text-on-accent)] transition hover:gap-4",
};

export function resolveCtaStyle(preset?: CTAStylePreset | null): string {
  return CTA_STYLE_PRESETS[preset ?? "glow"];
}

/* -------------------------------------------------------- backgrounds -- */

export type BackgroundPreset =
  | "none"
  | "tint"
  | "accent"
  | "dark"
  | "photo"
  | "gradient"
  | "spotlight";

export type ResolvedBackground = {
  /** Class applied to the section wrapper. */
  className: string;
  /** True when the caller must also render a photo layer + scrim. */
  needsPhoto: boolean;
  /** True when the band is dark and text must be forced light. */
  forcesLightText: boolean;
};

export const BACKGROUND_PRESETS: Record<BackgroundPreset, ResolvedBackground> = {
  none: { className: "", needsPhoto: false, forcesLightText: false },
  tint: {
    className: "bg-[color-mix(in_srgb,var(--color-accent)_7%,transparent)]",
    needsPhoto: false,
    forcesLightText: false,
  },
  accent: {
    className: "bg-[color-mix(in_srgb,var(--color-accent)_16%,transparent)]",
    needsPhoto: false,
    forcesLightText: false,
  },
  // Forces light text: on a light brand the page foreground is near-black and
  // would be invisible against this band. Fully opaque, not white/90 — a
  // translucent letter over the orbit's glow lets the glow show through and the
  // word reads as tinted.
  dark: {
    className: "bg-[color-mix(in_srgb,var(--color-fg)_4%,black_88%)] text-white [&_*]:!text-white",
    needsPhoto: false,
    forcesLightText: true,
  },
  photo: {
    className: "text-white [&_*]:!text-white",
    needsPhoto: true,
    forcesLightText: true,
  },
  gradient: {
    className:
      "bg-[linear-gradient(160deg,color-mix(in_srgb,var(--color-accent)_18%,transparent),transparent_60%)]",
    needsPhoto: false,
    forcesLightText: false,
  },
  spotlight: {
    className:
      "bg-[radial-gradient(ellipse_60%_50%_at_50%_0%,color-mix(in_srgb,var(--color-accent)_20%,transparent),transparent_70%)]",
    needsPhoto: false,
    forcesLightText: false,
  },
};

export function resolveBackground(preset?: BackgroundPreset | null): ResolvedBackground {
  return BACKGROUND_PRESETS[preset ?? "none"];
}

/* ----------------------------------------------------------- dividers -- */

export type DividerPreset = "none" | "line" | "fade" | "angle" | "curve" | "dots";

/** Rendered by the section shell between bands, so two adjacent backgrounds
 *  don't meet in a flat seam. */
export const DIVIDER_PRESETS: Record<DividerPreset, string> = {
  none: "",
  line: "border-t border-[var(--color-border)]",
  fade: "bg-[linear-gradient(to_bottom,transparent,color-mix(in_srgb,var(--color-fg)_6%,transparent))]",
  angle: "[clip-path:polygon(0_0,100%_3rem,100%_100%,0_100%)]",
  curve: "[border-radius:50%_50%_0_0/2rem_2rem_0_0]",
  dots: "bg-[radial-gradient(circle,color-mix(in_srgb,var(--color-fg)_22%,transparent)_1px,transparent_1px)] bg-[length:12px_12px]",
};

export function resolveDivider(preset?: DividerPreset | null): string {
  return DIVIDER_PRESETS[preset ?? "none"];
}
