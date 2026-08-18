import Script from "next/script";

import { BrandStyle, usableCardStyle } from "@/components/public/brand-style";
import { PublicFooter } from "@/components/public/public-footer";
import { Reveal, RevealItem } from "@/components/public/reveal";
import { BrandIcon } from "@/components/public/brand-icon";
import { SectionShell } from "@/components/public/section-shell";
import { usableDivider } from "@/components/public/section-design";
import { PageBlocks } from "@/components/public/page-blocks";
import { UnsubscribeForm } from "@/components/public/unsubscribe-form";
import { resolveCtaStyle, resolveVisualStyle } from "@/lib/design/presets";
import type { Launch } from "@/db/schema/launches";
import type { RegistroPageBody } from "@/components/public/page-bodies";

/**
 * Las dos páginas de servicio de una newsletter: la de gracias y la de baja.
 *
 * Una sola plantilla porque tienen la misma forma —un titular, una explicación, unas
 * viñetas y una acción— y se diferencian en qué hace esa acción: descargar lo
 * prometido o irse de la lista. Separarlas en dos componentes habría duplicado el
 * armazón para cambiar un botón.
 *
 * La de gracias es entrega, no acuse de recibo: quien llega ya dejó su email, así que
 * no hay nada que vender y sí algo que dar.
 */
export function ServicePage({
  launch,
  body,
  kind,
}: {
  launch: Launch;
  body: RegistroPageBody | null;
  kind: "gracias" | "baja";
}) {
  const cardStyle = usableCardStyle(
    launch.brandPalette,
    launch.brandDesign?.cardStyle,
  );
  const card = resolveVisualStyle(cardStyle);
  const esBaja = kind === "baja";

  const headline =
    body?.headline ?? (esBaja ? "Darte de baja" : "Ya estás dentro");
  const subheadline =
    body?.subheadline ??
    (esBaja
      ? "Un clic y dejas de recibir estos correos. Sin preguntas."
      : launch.promise ??
        "Revisa tu correo: te acabamos de escribir.");

  return (
    <main className="relative min-h-screen overflow-x-clip">
      <BrandStyle palette={launch.brandPalette} fonts={launch.brandFonts} />
      <Script
        src="/track.js"
        data-launch={launch.slug}
        strategy="afterInteractive"
      />

      <SectionShell
        design={
          body?.design?.hero
            ? {
                ...body.design.hero,
                divider: usableDivider(body.design.hero, undefined, true),
              }
            : undefined
        }
      >
        <section
          className={`mx-auto flex max-w-2xl flex-col justify-center px-6 ${
            esBaja ? "min-h-[70svh] py-16" : "min-h-[85svh] py-16"
          }`}
        >
          <Reveal>
            <h1 className="text-balance font-[family-name:var(--font-display)] text-3xl font-extrabold leading-[1.08] tracking-tight sm:text-4xl md:text-5xl">
              {headline}
            </h1>
          </Reveal>

          {subheadline && (
            <p className="mt-4 text-lg leading-relaxed text-[var(--color-muted-1)]">
              {subheadline}
            </p>
          )}

          {body?.bullets && body.bullets.length > 0 && (
            <Reveal className="mt-8 space-y-3">
              {body.bullets.map((bullet, i) => (
                <RevealItem key={i} className="flex items-start gap-3">
                  <BrandIcon name="check" size="sm" />
                  <span className="leading-relaxed text-[var(--color-muted-1)]">
                    {bullet}
                  </span>
                </RevealItem>
              ))}
            </Reveal>
          )}

          <div className="mt-10">
            {esBaja ? (
              <UnsubscribeForm
                launchSlug={launch.slug}
                ctaLabel={body?.cta ?? "Darme de baja"}
                ctaClass={resolveCtaStyle(launch.brandDesign?.ctaStyle)}
                cardClass={`${card.box} ${card.padding.normal}`}
              />
            ) : (
              body?.cta && (
                <a
                  href={body.ctaHref ?? "#"}
                  className={resolveCtaStyle(launch.brandDesign?.ctaStyle)}
                >
                  {body.cta}
                </a>
              )
            )}
          </div>
        </section>
      </SectionShell>

      <PageBlocks
        blocks={body?.blocks}
        designs={body?.design?.blocks}
        cardStyle={cardStyle}
        ctaStyle={launch.brandDesign?.ctaStyle}
      />

      <PublicFooter launch={launch} />
    </main>
  );
}
