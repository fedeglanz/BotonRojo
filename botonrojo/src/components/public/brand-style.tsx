import { googleFontsUrl, hexToRgba } from "@/lib/brand-kit";
import type { BrandPalette, BrandFonts } from "@/db/schema/launches";

type Props = {
  palette: BrandPalette | null;
  fonts: BrandFonts | null;
};

/**
 * Shared per-launch theming for every public-facing page (landing, gracias):
 * hides Botón Rojo's own app-shell ambient effects (a client's page isn't our
 * dashboard), and derives muted-text tones from the foreground so copy stays
 * legible whether the brand kit is light or dark.
 */
export function BrandStyle({ palette, fonts }: Props) {
  const foreground = palette?.foreground ?? "#f4f4f5";

  return (
    <>
      <style>{`
        .mesh-bg, .circuit-grid, .vignette { display: none; }
        body {
          --color-muted-1: ${hexToRgba(foreground, 0.82)};
          --color-muted-2: ${hexToRgba(foreground, 0.58)};
          --color-muted-3: ${hexToRgba(foreground, 0.42)};
        }
      `}</style>
      {palette && (
        <style>{`
          body {
            --color-red: ${palette.primary};
            --color-red-bright: ${palette.primary};
            --color-red-glow: ${hexToRgba(palette.primary, 0.55)};
            --color-accent: ${palette.accent};
            --color-accent-glow: ${hexToRgba(palette.accent, 0.45)};
            --color-bg: ${palette.background};
            --color-fg: ${palette.foreground};
            ${fonts ? `--font-display: "${fonts.display}", "Inter", system-ui, sans-serif;` : ""}
            ${fonts ? `--font-sans: "${fonts.body}", system-ui, sans-serif;` : ""}
          }
        `}</style>
      )}
      {fonts && <link rel="stylesheet" href={googleFontsUrl(fonts)} />}
    </>
  );
}
