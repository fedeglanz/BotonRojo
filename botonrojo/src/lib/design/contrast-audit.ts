import { contrastRatio, flatten, mix, resolveTheme } from "./theme";
import type { ColorPrimitives } from "./tokens";

/**
 * Measures the text/background contrast of every box, band and button a page
 * will actually render, BEFORE it ships.
 *
 * This exists because "looks fine" is not a check. The failures we hit were all
 * mechanical and all invisible to the model writing the copy: a dark glass card
 * dropped on a white page, a brand-coloured button with white text on a pale
 * accent, mint "yes" markers at 1.9:1 on white. Each one ruins a page instantly,
 * and each one is a number you can compute.
 *
 * Everything here is arithmetic — no AI, no screenshots — so it runs on every
 * generation and cannot be talked out of a verdict.
 */

/** WCAG AA: 4.5 for body text, 3.0 for large text and UI borders. */
export const AA_BODY = 4.5;
export const AA_LARGE = 3;

export type ContrastTarget = {
  /** What the reader sees, in plain Spanish — this reaches the admin. */
  label: string;
  foreground: string;
  background: string;
  /** Large display type and icons only need 3:1. */
  large?: boolean;
};

export type ContrastFinding = ContrastTarget & {
  ratio: number;
  required: number;
  passes: boolean;
};

export type ContrastAudit = {
  findings: ContrastFinding[];
  failures: ContrastFinding[];
  /** Lowest ratio measured — a quick single number for the panel. */
  worst: number;
};

function check(target: ContrastTarget, backdrop: string): ContrastFinding {
  // Translucent values are judged by what the eye sees, not by their raw alpha.
  const fg = flatten(target.foreground, target.background.startsWith("#") ? target.background : backdrop);
  const bg = flatten(target.background, backdrop);
  const ratio = Number(contrastRatio(fg, bg).toFixed(2));
  const required = target.large ? AA_LARGE : AA_BODY;
  return { ...target, ratio, required, passes: ratio >= required };
}

/**
 * The surface each box preset paints, resolved to an opaque colour so it can be
 * measured. Mirrors VISUAL_STYLE_PRESETS / globals.css — when a preset's fill
 * changes there, it has to change here too, which is the price of measuring
 * something CSS computes.
 */
function surfaceFor(style: string, page: { bg: string; fg: string; accent: string }): string {
  switch (style) {
    // A fixed dark card, whatever the palette. This is the one that ruins light pages.
    case "glass":
      return mix("#1c1c20", "#101013", 50);
    case "liquid":
      // Blurred backdrop plus a faint accent tint: effectively the page, nudged.
      return mix(page.accent, page.bg, 12);
    case "flat":
    case "soft":
      return mix(page.fg, page.bg, 5);
    case "brutal":
      return mix(page.fg, page.bg, 4);
    case "outline":
    case "editorial":
      return page.bg;
    default:
      return page.bg;
  }
}

/** The band colour behind a section, resolved from its background token. */
function bandFor(background: string | undefined, page: { bg: string; fg: string; accent: string }): string {
  switch (background) {
    case "tint":
      return mix(page.accent, page.bg, 7);
    case "accent":
      return mix(page.accent, page.bg, 16);
    case "gradient":
      return mix(page.accent, page.bg, 18);
    case "spotlight":
      return mix(page.accent, page.bg, 20);
    // Both force light text on a near-black band, so they're measured as such.
    case "dark":
    case "photo":
      return "#0a0a0a";
    default:
      return page.bg;
  }
}

const FORCES_LIGHT_TEXT = new Set(["dark", "photo"]);

export function auditPageContrast(input: {
  palette: ColorPrimitives | null;
  cardStyle?: string;
  ctaStyle?: string;
  sectionDesign?: Record<string, { background?: string; style?: string } | undefined> | null;
}): ContrastAudit {
  const theme = resolveTheme({ palette: input.palette });
  const c = theme.colors;
  const page = { bg: theme.palette?.background ?? "#050505", fg: theme.palette?.foreground ?? "#f4f4f5", accent: theme.palette?.accent ?? c.accent };

  const targets: ContrastTarget[] = [
    { label: "Texto de la página sobre su fondo", foreground: page.fg, background: page.bg },
    { label: "Texto secundario sobre el fondo", foreground: c.textMuted, background: page.bg },
  ];

  // The CTA: its fill and the label the presets put on it.
  const ctaFill = input.ctaStyle === "outline" || input.ctaStyle === "ghost" ? page.bg : c.primary;
  const ctaText =
    input.ctaStyle === "outline"
      ? c.accent
      : input.ctaStyle === "ghost"
        ? c.textMuted
        : c.textOnAccent;
  targets.push({ label: "Texto del botón principal sobre su relleno", foreground: ctaText, background: ctaFill, large: true });

  // The page's default box. Only `glass` carries its own text colour; every
  // other preset inherits the page's, which is what has to be measured.
  const cardSurface = surfaceFor(input.cardStyle ?? "glass", page);
  const cardText = (input.cardStyle ?? "glass") === "glass" ? "#f4f4f5" : page.fg;
  targets.push({ label: `Texto dentro de las cajas "${input.cardStyle ?? "glass"}"`, foreground: cardText, background: cardSurface });

  // Every band, plus any box that overrides the page style inside it.
  for (const [key, design] of Object.entries(input.sectionDesign ?? {})) {
    if (!design) continue;
    const band = bandFor(design.background, page);
    const bandText = FORCES_LIGHT_TEXT.has(design.background ?? "") ? "#ffffff" : page.fg;
    if (design.background && design.background !== "none") {
      targets.push({ label: `Texto de la sección "${key}" sobre su banda`, foreground: bandText, background: band });
    }
    if (design.style) {
      const surface = surfaceFor(design.style, { ...page, bg: band });
      const text = design.style === "glass" ? "#f4f4f5" : bandText;
      targets.push({ label: `Texto de las cajas "${design.style}" en "${key}"`, foreground: text, background: surface });
    }
  }

  const findings = targets.map((t) => check(t, page.bg));
  const failures = findings.filter((f) => !f.passes);
  return {
    findings,
    failures,
    worst: findings.length > 0 ? Math.min(...findings.map((f) => f.ratio)) : 21,
  };
}

/** One line per failure, ready to store as a design-review warning. */
export function describeContrastFailures(audit: ContrastAudit): string[] {
  return audit.failures.map(
    (f) =>
      `Contraste insuficiente — ${f.label}: ${f.ratio}:1, hace falta ${f.required}:1. ` +
      `Con esa diferencia el texto cuesta de leer.`,
  );
}
