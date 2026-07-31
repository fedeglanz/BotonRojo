import {
  ACCESSIBILITY_DEFAULTS,
  MOTION,
  type AccessibilityFlags,
  type ColorPrimitives,
  type DensityTokens,
  type SemanticColors,
  type ThemeMode,
} from "./tokens";

/* -------------------------------------------------------- colour utilities */

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.trim().replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

/** WCAG relative luminance. */
export function relativeLuminance(hex: string): number {
  const rgb = parseHex(hex);
  if (!rgb) return 0;
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

/** WCAG contrast ratio, 1..21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

export function rgba(hex: string, alpha: number): string {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

/**
 * Which of black/white reads better on `bg`. Used so text on a brand-coloured
 * fill is never chosen by assumption — a light accent needs dark text.
 */
export function readableTextOn(bg: string): string {
  return contrastRatio(bg, "#ffffff") >= contrastRatio(bg, "#000000") ? "#ffffff" : "#111111";
}

/**
 * Resolves `color-mix(in srgb, a p%, b)` numerically. The CSS does this in the
 * browser, but a contrast check has to know the resulting colour *before*
 * shipping the page, so the same mix is computed here.
 */
export function mix(a: string, b: string, percentA: number): string {
  const ca = parseHex(a);
  const cb = parseHex(b);
  if (!ca || !cb) return a;
  const t = Math.min(100, Math.max(0, percentA)) / 100;
  const ch = (x: number, y: number) => Math.round(x * t + y * (1 - t));
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${hex(ch(ca.r, cb.r))}${hex(ch(ca.g, cb.g))}${hex(ch(ca.b, cb.b))}`;
}

/**
 * Flattens `rgba(r,g,b,a)` over an opaque backdrop. Translucent text and
 * surfaces are everywhere in this design system, and their *effective* colour is
 * what the eye judges — measuring the unflattened value overstates contrast.
 */
export function flatten(color: string, backdrop: string): string {
  const m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(color.trim());
  if (!m) return color;
  const [, r, g, b, a] = m;
  const alpha = a === undefined ? 1 : Number(a);
  const bd = parseHex(backdrop);
  if (!bd) return color;
  const ch = (x: string, y: number) => Math.round(Number(x) * alpha + y * (1 - alpha));
  const hex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${hex(ch(r!, bd.r))}${hex(ch(g!, bd.g))}${hex(ch(b!, bd.b))}`;
}

/* ------------------------------------------------------------- theme mode */

/**
 * Mode comes from the approved background, not from the visitor's OS. A brand
 * that chose a white page stays light everywhere; `prefers-color-scheme` only
 * decides when there is no palette at all (see resolveTheme).
 */
export function deriveThemeMode(palette: ColorPrimitives | null | undefined): ThemeMode {
  if (!palette?.background) return "dark";
  return relativeLuminance(palette.background) > 0.5 ? "light" : "dark";
}

/** Everything a section needs to resolve its own design. */
export type ThemeContext = {
  mode: ThemeMode;
  colors: SemanticColors;
  density: DensityTokens;
  a11y: AccessibilityFlags;
  /** Present only when the launch has an approved palette. */
  palette: ColorPrimitives | null;
};

const FALLBACK_PALETTE: ColorPrimitives = {
  primary: "#ef2b3d",
  accent: "#ff3849",
  background: "#050505",
  foreground: "#f4f4f5",
};

/**
 * Builds semantic colours from the raw palette. Surfaces are mixed *towards*
 * the foreground on a dark theme and *towards* black on a light one, so a card
 * always separates from the page without hardcoding greys that would clash
 * with the brand.
 */
export function resolveSemanticColors(
  palette: ColorPrimitives,
  mode: ThemeMode,
  a11y: AccessibilityFlags = ACCESSIBILITY_DEFAULTS,
): SemanticColors {
  const { primary, accent, background, foreground } = palette;

  // On a dark page a raised surface is lighter; on a light page it's darker.
  const lift = (pct: number) =>
    mode === "dark"
      ? `color-mix(in srgb, ${foreground} ${pct}%, ${background})`
      : `color-mix(in srgb, #000000 ${pct}%, ${background})`;

  // High contrast drops the softening: muted text moves closer to full text.
  const mute = (pct: number) => rgba(foreground, a11y.highContrast ? Math.min(1, pct + 0.25) : pct);

  return {
    bg: background,
    surface: lift(4),
    surfaceRaised: lift(8),
    text: foreground,
    textMuted: mute(0.82),
    textSubtle: mute(0.58),
    textOnAccent: readableTextOn(accent),
    textOnPrimary: readableTextOn(primary),
    primary,
    primaryHover: `color-mix(in srgb, ${primary} 85%, ${foreground})`,
    accent,
    accentSoft: `color-mix(in srgb, ${accent} 14%, transparent)`,
    border: rgba(foreground, a11y.highContrast ? 0.32 : 0.12),
    borderStrong: rgba(foreground, a11y.highContrast ? 0.55 : 0.28),
    focus: accent,
    // Status hues stay conventional on purpose: a brand-red "success" would
    // stop communicating success. But the shade has to follow the mode — the
    // light mints and ambers that read well on black drop to ~1.9:1 on white,
    // so the light theme takes the saturated versions instead.
    ...(mode === "dark"
      ? { success: "#34d399", warning: "#fbbf24", danger: "#f87171" }
      : { success: "#047857", warning: "#b45309", danger: "#b91c1c" }),
  };
}

export function resolveTheme(input?: {
  palette?: ColorPrimitives | null;
  density?: DensityTokens;
  a11y?: Partial<AccessibilityFlags>;
  /** Only consulted when there's no palette. */
  systemPrefersDark?: boolean;
}): ThemeContext {
  const a11y = { ...ACCESSIBILITY_DEFAULTS, ...input?.a11y };
  const palette = input?.palette ?? null;
  const mode: ThemeMode = palette
    ? deriveThemeMode(palette)
    : input?.systemPrefersDark === false
      ? "light"
      : "dark";

  return {
    mode,
    colors: resolveSemanticColors(palette ?? FALLBACK_PALETTE, mode, a11y),
    density: input?.density ?? "normal",
    a11y,
    palette,
  };
}

/**
 * Dual-resolves a motion value: returns the near-zero duration when the
 * visitor asked for reduced motion, so callers don't branch. Ambient loops
 * should be dropped entirely rather than sped up — use `a11y.reducedMotion`
 * directly for those.
 */
export function resolveMotion(
  token: keyof typeof MOTION.duration,
  a11y: AccessibilityFlags = ACCESSIBILITY_DEFAULTS,
): string {
  return a11y.reducedMotion ? MOTION.duration.instant : MOTION.duration[token];
}

/**
 * Emits the theme as CSS custom properties for a `<style>` tag. Keeps the
 * names already used across the app (`--color-bg`, `--color-muted-1`…) so the
 * existing components keep working untouched, and adds the semantic ones.
 */
export function themeToCssVars(theme: ThemeContext): Record<string, string> {
  const c = theme.colors;
  return {
    "--color-bg": c.bg,
    "--color-fg": c.text,
    "--color-surface": c.surface,
    "--color-surface-raised": c.surfaceRaised,
    "--color-text": c.text,
    "--color-text-muted": c.textMuted,
    "--color-text-subtle": c.textSubtle,
    "--color-text-on-accent": c.textOnAccent,
    "--color-text-on-primary": c.textOnPrimary,
    // Both were missing, so every preset that fills with --color-primary (the
    // "solid" and "pill-arrow" CTAs) fell back to the @theme default red — a
    // red button in the middle of a blue brand.
    "--color-primary": c.primary,
    "--color-primary-hover": c.primaryHover,
    "--color-accent": c.accent,
    "--color-accent-soft": c.accentSoft,
    "--color-border": c.border,
    "--color-border-strong": c.borderStrong,
    "--color-focus": c.focus,
    "--color-success": c.success,
    "--color-warning": c.warning,
    "--color-danger": c.danger,
    // Legacy aliases still referenced by the existing components.
    "--color-red": c.primary,
    "--color-red-bright": c.primary,
    "--color-red-glow": rgba(theme.palette?.primary ?? c.primary, 0.55),
    "--color-muted-1": c.textMuted,
    "--color-muted-2": c.textSubtle,
    "--color-muted-3": rgba(c.text, 0.42),
  };
}
