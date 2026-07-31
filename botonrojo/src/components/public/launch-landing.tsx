import { db } from "@/db";
import { launches, assets, products } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Script from "next/script";

import { CtaBlock } from "@/components/public/cta-block";
import {
  AboutSection,
  AgendaSection,
  AmplifiedPromiseSection,
  CountdownSection,
  FaqSection,
  ForWhomSection,
  GuaranteeSection,
  HeroImage,
  IncludesSection,
  PainSolutionSection,
  PriceTag,
  PricingTiersSection,
  SpeakersSection,
  TestimonialsSection,
  type PricingProduct,
} from "@/components/public/landing-sections";
import { LAYOUT_PRESETS } from "@/components/public/landing-types";
import type { LandingBody, LandingCardStyle, MiddleSectionKey } from "@/components/public/landing-types";
import { BrandStyle, usableCardStyle } from "@/components/public/brand-style";
import { PublicFooter } from "@/components/public/public-footer";
import { StickyActionBar } from "@/components/public/sticky-action-bar";
import { SectionShell } from "@/components/public/section-shell";
import { usableDivider } from "@/components/public/section-design";

import { env } from "@/lib/env";
import { startCheckoutAction, captureLeadAction } from "@/server/checkout";
import type { Launch, LaunchType } from "@/db/schema/launches";

type RenderCtx = {
  products: PricingProduct[];
  cartClosesAt: Date | null;
  /** Already resolved against the brand, so a section never has to
   *  fall back to `glass` (which is always a dark card). */
  cardStyle: LandingCardStyle;
};

/**
 * Last line of defence for text sections. Data saved before shape validation
 * existed (or hand-edited since) can hold an object where a string belongs;
 * rendering that throws "Objects are not valid as a React child" and takes the
 * whole public page down. Better to show the salvageable text, or nothing.
 */
function asText(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const inner = value as Record<string, unknown>;
    if (typeof inner.text === "string") return inner.text;
    // One level of accidental wrapping, e.g. { amplifiedPromise: { text } }.
    for (const nested of Object.values(inner)) {
      if (typeof nested === "string") return nested;
      if (nested && typeof nested === "object" && typeof (nested as { text?: unknown }).text === "string") {
        return (nested as { text: string }).text;
      }
    }
  }
  return null;
}

// Middle-of-page sections (everything between the hero and the final CTA),
// keyed so each launch type can order/include them differently — a
// venta_directa closes fast (guarantee before testimonials), a semilla stays
// short, a plf is the full sequence with About included.
const MIDDLE_SECTION_RENDERERS = {
  forWhom: (landing: LandingBody) =>
    landing.forWhom && (landing.forWhom.yes?.length || landing.forWhom.no?.length) ? (
      <ForWhomSection key="forWhom" data={landing.forWhom} />
    ) : null,
  amplifiedPromise: (landing: LandingBody) => {
    const text = asText(landing.amplifiedPromise);
    return text ? (
      <AmplifiedPromiseSection
        key="amplifiedPromise"
        text={text}
        subline={asText(landing.amplifiedPromiseSubline) ?? undefined}
      />
    ) : null;
  },
  painBlocks: (landing: LandingBody, ctx: RenderCtx) =>
    landing.painBlocks && landing.painBlocks.length > 0 ? (
      <PainSolutionSection key="painBlocks" blocks={landing.painBlocks} cardStyle={ctx.cardStyle} />
    ) : null,
  speakers: (landing: LandingBody) =>
    landing.speakers && landing.speakers.length > 0 ? (
      <SpeakersSection key="speakers" items={landing.speakers} />
    ) : null,
  agenda: (landing: LandingBody) =>
    landing.agenda && landing.agenda.length > 0 ? <AgendaSection key="agenda" items={landing.agenda} /> : null,
  includes: (landing: LandingBody, ctx: RenderCtx) =>
    landing.includes && landing.includes.length > 0 ? (
      <IncludesSection key="includes" items={landing.includes} cardStyle={ctx.cardStyle} />
    ) : null,
  pricingTiers: (landing: LandingBody, ctx: RenderCtx) =>
    landing.pricingTiers && landing.pricingTiers.length > 1 && ctx.products.length > 1 ? (
      <PricingTiersSection
        key="pricingTiers"
        tiers={landing.pricingTiers}
        products={ctx.products}
        scarcityNote={landing.scarcityNote}
        startCheckoutAction={startCheckoutAction}
        cardStyle={ctx.cardStyle}
      />
    ) : null,
  countdown: (landing: LandingBody, ctx: RenderCtx) =>
    ctx.cartClosesAt ? (
      <CountdownSection key="countdown" targetDate={ctx.cartClosesAt.toISOString()} />
    ) : null,
  about: (landing: LandingBody) => (landing.about ? <AboutSection key="about" data={landing.about} /> : null),
  testimonials: (landing: LandingBody, ctx: RenderCtx) =>
    landing.testimonials && landing.testimonials.length > 0 ? (
      <TestimonialsSection key="testimonials" items={landing.testimonials} cardStyle={ctx.cardStyle} />
    ) : null,
  guarantee: (landing: LandingBody, ctx: RenderCtx) => {
    const text = asText(landing.guarantee);
    return text ? <GuaranteeSection key="guarantee" text={text} cardStyle={ctx.cardStyle} /> : null;
  },
  faq: (landing: LandingBody, ctx: RenderCtx) =>
    landing.faq && landing.faq.length > 0 ? (
      <FaqSection key="faq" items={landing.faq} cardStyle={ctx.cardStyle} />
    ) : null,
} as const;


export async function LaunchLandingPage({ launch, pageKey = "main" }: { launch: Launch; pageKey?: string }) {
  const [landingAsset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.launchId, launch.id), eq(assets.kind, "landing"), eq(assets.pageKey, pageKey)))
    .orderBy(desc(assets.createdAt))
    .limit(1);

  const activeProducts = await db
    .select()
    .from(products)
    .where(and(eq(products.launchId, launch.id), eq(products.active, true)));

  // The hero keeps pointing at a single product for its CTA/price tag, even
  // when there are several tiers — the tier choice itself lives further down
  // in PricingTiersSection.
  const product = activeProducts[0];

  const landing = (landingAsset?.body ?? null) as LandingBody | null;
  const hasStripeProduct = Boolean(product?.stripePriceId);
  const heroHeadline = landing?.hero?.headline ?? launch.name;
  const heroSubheadline = landing?.hero?.subheadline ?? launch.promise ?? "";
  const ctaLabel = landing?.hero?.cta ?? (hasStripeProduct ? "Quiero entrar" : "Apúntame al lanzamiento");
  const finalCtaLabel = landing?.finalCta?.button ?? ctaLabel;
  const finalCtaHeadline = landing?.finalCta?.headline ?? "¿Te apuntas?";

  const palette = launch.brandPalette;
  // The generator may not set a box style; the fallback has to follow the
  // brand, since `glass` is always a dark card.
  const cardStyle = usableCardStyle(palette, landing?.style?.cardStyle);
  const ctaStyle = landing?.style?.ctaStyle;
  const fonts = launch.brandFonts;

  return (
    // No `overflow-hidden` here: each SectionShell clips its own decoration, so
    // a global clip would only stop sections from bleeding as intended.
    // `overflow-x-clip` still prevents sideways page scroll.
    <main className="relative min-h-screen overflow-x-clip">
      <BrandStyle palette={palette} fonts={fonts} />
      <Script
        src="/track.js"
        data-launch={launch.slug}
        data-api={env.APP_URL}
        strategy="afterInteractive"
      />

      {/* HERO — sized to the viewport and vertically centered so the CTA/form
          is visible without scrolling, on mobile and desktop alike. */}
      <section className="relative mx-auto flex min-h-[100svh] max-w-3xl flex-col items-center justify-center px-6 py-6 text-center">
        {/* No launch-type badge: "plf" / "venta directa" is our internal
            vocabulary, and it was the first thing a visitor read. */}
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold leading-[1.08] tracking-tight sm:text-4xl md:text-6xl">
          {heroHeadline}
        </h1>

        {heroSubheadline && (
          <p className="mt-2 max-w-2xl text-balance text-sm text-[var(--color-muted-1)] sm:mt-4 sm:text-base md:text-lg">
            {heroSubheadline}
          </p>
        )}

        {product && (
          <PriceTag priceCents={product.priceCents} currency={product.currency} />
        )}

        <div id="cta" className="mt-3 w-full sm:mt-6">
          <CtaBlock
            launchSlug={launch.slug}
            buttonLabel={ctaLabel}
            hasStripeProduct={hasStripeProduct}
            productSlug={product?.slug ?? null}
            startCheckoutAction={startCheckoutAction}
            captureLeadAction={captureLeadAction}
            compact
            cardStyle={cardStyle}
            ctaStyle={ctaStyle}
          />
        </div>
      </section>

      {landing?.hero?.imageUrl && (
        <HeroImage url={landing.hero.imageUrl} alt={heroHeadline} />
      )}

      {/* SECTIONS FROM GENERATED LANDING — order/inclusion depends on launch type,
          unless the client's general instructions asked Claude for a custom order.
          Each is wrapped in SectionShell, which is a no-op unless that section
          has a design (background / effect / full height / width) set. */}
      {landing &&
        (landing.sectionOrder?.length ? landing.sectionOrder : LAYOUT_PRESETS[launch.type] ?? LAYOUT_PRESETS.plf).map(
          (key, index, all) => {
            const previousKey = index > 0 ? all[index - 1] : undefined;
            const rendered = MIDDLE_SECTION_RENDERERS[key]?.(landing, {
              // The section's own box style wins over the page default.
              cardStyle: usableCardStyle(palette, landing.sectionDesign?.[key]?.style as LandingCardStyle),
              products: activeProducts.map((p) => ({ slug: p.slug, name: p.name, priceCents: p.priceCents, currency: p.currency })),
              cartClosesAt: launch.cartClosesAt,
            });
            if (!rendered) return null;
            // Repaired on read: a shape divider against a painted neighbour shows
            // a wedge of page background between the two colours.
            const own = landing.sectionDesign?.[key];
            const design = own
              ? { ...own, divider: usableDivider(own, landing.sectionDesign?.[previousKey!]) }
              : own;
            return (
              <SectionShell key={key} design={design}>
                {rendered}
              </SectionShell>
            );
          },
        )}

      {/* FINAL CTA — also wrapped in SectionShell: it's a visible band like any
          other, so it can take a background, full height and an effect. */}
      <SectionShell design={landing?.sectionDesign?.finalCta}>
        <section className="relative mx-auto max-w-3xl px-6 py-20 text-center">
          <h2 className="font-[family-name:var(--font-display)] text-3xl font-extrabold leading-tight md:text-5xl">
            {finalCtaHeadline}
          </h2>
          {landing?.finalCta?.subheadline && (
            <p className="mx-auto mt-4 max-w-xl text-balance text-[var(--color-muted-1)]">
              {landing.finalCta.subheadline}
            </p>
          )}
          <div className="mt-10">
            <CtaBlock
              launchSlug={launch.slug}
              buttonLabel={finalCtaLabel}
              hasStripeProduct={hasStripeProduct}
              productSlug={product?.slug ?? null}
              startCheckoutAction={startCheckoutAction}
              captureLeadAction={captureLeadAction}
              cardStyle={cardStyle}
              ctaStyle={ctaStyle}
            />
          </div>
        </section>
      </SectionShell>

      <PublicFooter launch={launch} stickyBar />

      <StickyActionBar
        logoUrl={launch.brandLogoUrl}
        targetDate={launch.cartClosesAt ? launch.cartClosesAt.toISOString() : null}
        countdownLabel="El carrito cierra en"
        ctaLabel={hasStripeProduct ? "Acceder ahora" : "Registrarse ahora"}
      />
    </main>
  );
}

export async function findLaunchBySlugOrNotFound(slug: string) {
  const [launch] = await db.select().from(launches).where(eq(launches.slug, slug)).limit(1);
  if (!launch) notFound();
  return launch;
}
