import { googleFontsUrl } from "@/lib/brand-kit";
import { resolveTheme, themeToCssVars } from "@/lib/design/theme";
import type { BrandPalette, BrandFonts } from "@/db/schema/launches";
import type { LandingCardStyle } from "@/components/public/landing-types";

type Props = {
  palette: BrandPalette | null;
  fonts: BrandFonts | null;
};

/**
 * Shared per-launch theming for every public-facing page (landing, gracias,
 * registro, contenido, legal, afiliados).
 *
 * The whole semantic set is resolved in TypeScript from the approved palette
 * (lib/design/theme.ts) instead of being patched var by var here. That is what
 * makes light mode actually work: a white background needs its surfaces mixed
 * towards black and its hairlines dark, and overriding `--color-bg` alone never
 * got you there — cards stayed near-black and borders invisible.
 *
 * The mode is DERIVED from the palette, never from the visitor's OS: a brand
 * that approved a white page must not flip to dark because someone's phone is
 * in dark mode.
 */
export function BrandStyle({ palette, fonts }: Props) {
  const theme = resolveTheme({ palette });
  const vars = Object.entries(themeToCssVars(theme))
    .map(([name, value]) => `${name}: ${value};`)
    .join("\n          ");

  return (
    <>
      <style>{`
        /* A client's page isn't our dashboard: hide Botón Rojo's own app-shell
           ambient effects. */
        .mesh-bg, .circuit-grid, .vignette { display: none; }

        /* "html:root" rather than plain ":root" on purpose: it outweighs the
           "html, body" rule in globals.css regardless of stylesheet order, so
           the page background follows the brand instead of racing it. The
           variables then inherit down to everything. */
        html:root {
          color-scheme: ${theme.mode};
          ${vars}
          ${fonts ? `--font-display: "${fonts.display}", "Inter", system-ui, sans-serif;` : ""}
          ${fonts ? `--font-sans: "${fonts.body}", system-ui, sans-serif;` : ""}
        }
      `}</style>
      {fonts && <link rel="stylesheet" href={googleFontsUrl(fonts)} />}
    </>
  );
}

/** The mode a launch resolves to, for callers that need it outside CSS. */
export function brandThemeMode(palette: BrandPalette | null): "light" | "dark" {
  return resolveTheme({ palette }).mode;
}

/**
 * Which box treatment to use when the launch hasn't chosen one. `glass` is
 * always a dark blurred card, so on a light brand it landed as a near-black
 * panel in the middle of a white page — with its own fixed light-on-dark labels.
 * `soft` is the light-mode equivalent: same weight, follows the palette.
 */
export function defaultCardStyleFor(palette: BrandPalette | null): LandingCardStyle {
  return brandThemeMode(palette) === "light" ? "liquid" : "glass";
}

/**
 * Coerces a stored or AI-chosen box style into one that can actually work on
 * this palette. `glass` is a fixed dark card with its own light-on-dark text: on
 * a white page it renders as a grey slab with unreadable copy. That must not
 * depend on the model remembering — it's a property of the preset, so it's
 * enforced here, which also repairs pages already stored with it.
 */
export function usableCardStyle(
  palette: BrandPalette | null,
  style: LandingCardStyle | undefined,
): LandingCardStyle {
  if (!style) return defaultCardStyleFor(palette);
  if (style === "glass" && brandThemeMode(palette) === "light") return "liquid";
  return style;
}
