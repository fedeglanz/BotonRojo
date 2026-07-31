"use client";

import { googleFontsUrl } from "@/lib/brand-kit";
import { resolveTheme, themeToCssVars } from "@/lib/design/theme";
import { resolveCtaStyle, resolveVisualStyle, resolveBackground, resolveDivider } from "@/lib/design/presets";
import { BrandIcon } from "@/components/public/brand-icon";
import type { BrandDesign, BrandFonts, BrandPalette } from "@/db/schema/launches";

/**
 * Previews the design system, not just the palette.
 *
 * What was here showed a heading, a paragraph, a plain button and the mood image
 * cropped to a strip — so changing the box treatment, the density, the heading
 * treatment or the divider changed nothing on screen and the only visible effect
 * of the whole panel was the button's colour.
 *
 * This renders the same presets and the same CSS the public pages use, driven by
 * the same variables, so what you see is what a page will do.
 */
export function BrandPreview({
  palette,
  fonts,
  design,
  moodImageUrl,
}: {
  palette: BrandPalette;
  fonts: BrandFonts;
  design: BrandDesign;
  moodImageUrl: string | null;
}) {
  // The public pages get these from <BrandStyle>; here they're scoped to the
  // preview so the admin's own dark chrome around it is unaffected.
  const theme = resolveTheme({ palette });
  const vars = themeToCssVars(theme) as React.CSSProperties;

  const card = resolveVisualStyle(design.cardStyle);
  const cta = resolveCtaStyle(design.ctaStyle);
  const band = resolveBackground("tint");
  const dividerClass = resolveDivider(design.divider);
  const pad = card.padding[design.density];

  const titleClass =
    design.titleFx === "gradient"
      ? "section-title-gradient"
      : design.titleFx === "outline"
        ? "section-title-outline"
        : "";

  const sectionY =
    design.density === "compact" ? "py-6" : design.density === "spacious" ? "py-14" : "py-10";

  return (
    <div
      className="overflow-hidden rounded-2xl border border-white/10"
      style={{ ...vars, background: palette.background, color: theme.colors.text }}
    >
      <link rel="stylesheet" href={googleFontsUrl(fonts)} />

      <div style={{ fontFamily: `"${fonts.body}", system-ui, sans-serif` }}>
        {/* First band: plain, so the divider below it has something to cut into. */}
        <div className={`px-6 text-center ${sectionY} ${titleClass}`}>
          <div className="font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-[0.3em] opacity-50">
            Vista previa
          </div>
          <h2
            className="mt-3 text-3xl font-extrabold leading-[1.05] tracking-tight"
            style={{ fontFamily: `"${fonts.display}", system-ui, sans-serif` }}
          >
            Tu titular, con este sistema.
          </h2>
          <p className="mx-auto mt-3 max-w-sm text-sm" style={{ color: theme.colors.textMuted }}>
            Así se ve el cuerpo de texto, y debajo el botón y las cajas con lo que has elegido.
          </p>
          <button type="button" className={`${cta} mt-6 pointer-events-none`}>
            Quiero mi plaza
          </button>
        </div>

        {/* Second band: painted, with the chosen divider shaping its own paint —
            exactly how SectionShell does it on the public page. */}
        <div className="relative">
          <div aria-hidden className={`absolute inset-0 ${band.paint} ${dividerClass}`} />
          <div className={`relative px-6 ${sectionY}`}>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { icon: "rayo", title: "Una caja", body: "Con el tratamiento elegido." },
                { icon: "escudoOk", title: "Otra caja", body: "Y su relleno según la densidad." },
              ].map((c) => (
                <div key={c.title} className={`${card.box} ${card.hudCorners ? "hud-corners" : ""} ${pad}`}>
                  <BrandIcon name={c.icon} size="md" plate />
                  <div className="mt-3 text-sm font-bold">{c.title}</div>
                  <div className="mt-1 text-xs" style={{ color: theme.colors.textMuted }}>
                    {c.body}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {design.effects
                .filter((e) => e !== "none")
                .map((e) => (
                  <span
                    key={e}
                    className="rounded-full border px-2.5 py-1 font-[family-name:var(--font-mono)] text-[10px] uppercase tracking-widest"
                    style={{
                      borderColor: theme.colors.border,
                      color: theme.colors.textMuted,
                    }}
                  >
                    {e}
                  </span>
                ))}
              {moodImageUrl && (
                // A thumbnail, not a cropped strip: it's a reference, not the design.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={moodImageUrl}
                  alt="Referencia de mood"
                  className="ml-auto h-10 w-16 rounded-md object-cover"
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
