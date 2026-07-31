import Script from "next/script";
import {
  BrandStyle,
  logoPlateFor,
  usableCardStyle,
} from "@/components/public/brand-style";
import { PublicFooter } from "@/components/public/public-footer";
import { Reveal, RevealItem } from "@/components/public/reveal";
import { BrandIcon } from "@/components/public/brand-icon";
import { LeadForm } from "@/components/public/lead-form";
import { StickyActionBar } from "@/components/public/sticky-action-bar";
import { env } from "@/lib/env";
import { captureLeadAction } from "@/server/checkout";
import type { Launch } from "@/db/schema/launches";
import { SectionShell } from "@/components/public/section-shell";
import { usableDivider } from "@/components/public/section-design";
import { PageBlocks } from "@/components/public/page-blocks";
import { EditModeProvider, Editable } from "@/components/public/edit-overlay";
import { EDIT_DISABLED, type EditContext } from "@/components/public/edit-mode";
import {
  editRefineAction,
  editDesignAction,
  addBlockAction,
  removeBlockAction,
  moveBlockAction,
} from "@/server/page-edit";
import type { RegistroPageBody } from "@/components/public/page-bodies";

export function RegistroPage({
  launch,
  body,
  edit = EDIT_DISABLED,
}: {
  launch: Launch;
  body: RegistroPageBody | null;
  edit?: EditContext;
}) {
  const headline = body?.headline ?? launch.name;
  const subheadline = body?.subheadline ?? launch.promise ?? "";
  const cardStyle = usableCardStyle(
    launch.brandPalette,
    launch.brandDesign?.cardStyle,
  );
  const ctaStyle = launch.brandDesign?.ctaStyle;
  // The hero photo is optional: a brief that asks for the form to be the only
  // object on screen needs a way to drop it, not just to shrink it.
  const showHeroImage = Boolean(body?.imageUrl) && !body?.hideHeroImage;

  return (
    <EditModeProvider
      ctx={edit}
      refineAction={editRefineAction}
      designAction={editDesignAction}
      addBlockAction={addBlockAction}
      removeBlockAction={removeBlockAction}
      moveBlockAction={moveBlockAction}
      blockCount={body?.blocks?.length ?? 0}
    >
      <main className="relative min-h-screen overflow-hidden">
        <BrandStyle palette={launch.brandPalette} fonts={launch.brandFonts} />
        <Script
          src="/track.js"
          data-launch={launch.slug}
          data-api={env.APP_URL}
          strategy="afterInteractive"
        />

        {/* The hero band takes a design like any landing section: background,
          effect, full height. Without it a capture page could only ever be the
          same flat two-column template. */}
        <Editable target={{ kind: "hero" }} label="la parte principal">
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
            <section className="mx-auto grid min-h-[100svh] max-w-6xl items-center gap-10 px-6 py-10 lg:grid-cols-2 lg:gap-16">
              <div className="text-center lg:text-left">
                <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold leading-[1.08] tracking-tight sm:text-4xl lg:text-5xl">
                  {headline}
                </h1>

                {subheadline && (
                  <p className="mt-4 text-balance text-base text-[var(--color-muted-1)] lg:text-lg">
                    {subheadline}
                  </p>
                )}

                {body?.bullets && body.bullets.length > 0 && (
                  <Reveal className="mx-auto mt-6 max-w-md space-y-2.5 text-left lg:mx-0">
                    {body.bullets.map((b, i) => (
                      <RevealItem
                        key={i}
                        className="flex items-start gap-2.5 text-sm lg:text-base"
                      >
                        <BrandIcon
                          name="check"
                          size="sm"
                          treatment="plain"
                          className="mt-0.5 text-[var(--color-accent)]"
                        />
                        <span className="text-[var(--color-muted-1)]">{b}</span>
                      </RevealItem>
                    ))}
                  </Reveal>
                )}
              </div>

              <Reveal
                className="mx-auto w-full max-w-md lg:mx-0 lg:max-w-none"
                id="cta"
              >
                {showHeroImage && (
                  <div className="mb-6 aspect-[4/3] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_30px_60px_-20px_var(--color-red-glow)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={body!.imageUrl}
                      alt={headline}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                <LeadForm
                  launchSlug={launch.slug}
                  buttonLabel={body?.cta ?? "Apúntame"}
                  action={captureLeadAction}
                  compact
                  cardStyle={cardStyle}
                  ctaStyle={ctaStyle}
                />
              </Reveal>
            </section>
          </SectionShell>
        </Editable>

        <PageBlocks
          blocks={body?.blocks}
          designs={body?.design?.blocks}
          cardStyle={cardStyle}
          ctaStyle={ctaStyle}
          editable={edit.enabled}
        />

        <PublicFooter launch={launch} stickyBar />

        <StickyActionBar
          logoUrl={launch.brandLogoUrl}
          logoAspect={
            ((launch.assetsCache as Record<string, unknown> | null)
              ?.logoAspect as number) ?? null
          }
          logoPlate={logoPlateFor(
            launch.brandPalette,
            (launch.assetsCache as Record<string, unknown> | null)?.logoInk as {
              dark?: number;
              light?: number;
            } | null,
          )}
          // The registration deadline is what a capture page counts down to. It
          // used to use the content drip date, which answers a different question.
          targetDate={
            launch.registrationClosesAt
              ? launch.registrationClosesAt.toISOString()
              : launch.contentDripStartsAt
                ? launch.contentDripStartsAt.toISOString()
                : null
          }
          countdownLabel={
            launch.registrationClosesAt ? "El registro cierra en" : "Empieza en"
          }
          ctaLabel="Registrarse ahora"
        />
      </main>
    </EditModeProvider>
  );
}
