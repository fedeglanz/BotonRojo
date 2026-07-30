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
import type { LandingBody } from "@/components/public/landing-types";
import { BrandStyle } from "@/components/public/brand-style";
import { StickyActionBar } from "@/components/public/sticky-action-bar";
import { SectionShell } from "@/components/public/section-shell";

import { env } from "@/lib/env";
import { startCheckoutAction, captureLeadAction } from "@/server/checkout";
import type { Launch, LaunchType } from "@/db/schema/launches";

type RenderCtx = { products: PricingProduct[]; cartClosesAt: Date | null };

// Middle-of-page sections (everything between the hero and the final CTA),
// keyed so each launch type can order/include them differently — a
// venta_directa closes fast (guarantee before testimonials), a semilla stays
// short, a plf is the full sequence with About included.
const MIDDLE_SECTION_RENDERERS = {
  forWhom: (landing: LandingBody) =>
    landing.forWhom && (landing.forWhom.yes?.length || landing.forWhom.no?.length) ? (
      <ForWhomSection key="forWhom" data={landing.forWhom} />
    ) : null,
  amplifiedPromise: (landing: LandingBody) =>
    landing.amplifiedPromise ? <AmplifiedPromiseSection key="amplifiedPromise" text={landing.amplifiedPromise} /> : null,
  painBlocks: (landing: LandingBody) =>
    landing.painBlocks && landing.painBlocks.length > 0 ? (
      <PainSolutionSection key="painBlocks" blocks={landing.painBlocks} cardStyle={landing.style?.cardStyle} />
    ) : null,
  speakers: (landing: LandingBody) =>
    landing.speakers && landing.speakers.length > 0 ? (
      <SpeakersSection key="speakers" items={landing.speakers} />
    ) : null,
  agenda: (landing: LandingBody) =>
    landing.agenda && landing.agenda.length > 0 ? <AgendaSection key="agenda" items={landing.agenda} /> : null,
  includes: (landing: LandingBody) =>
    landing.includes && landing.includes.length > 0 ? (
      <IncludesSection key="includes" items={landing.includes} cardStyle={landing.style?.cardStyle} />
    ) : null,
  pricingTiers: (landing: LandingBody, ctx: RenderCtx) =>
    landing.pricingTiers && landing.pricingTiers.length > 1 && ctx.products.length > 1 ? (
      <PricingTiersSection
        key="pricingTiers"
        tiers={landing.pricingTiers}
        products={ctx.products}
        scarcityNote={landing.scarcityNote}
        startCheckoutAction={startCheckoutAction}
        cardStyle={landing.style?.cardStyle}
      />
    ) : null,
  countdown: (landing: LandingBody, ctx: RenderCtx) =>
    ctx.cartClosesAt ? (
      <CountdownSection key="countdown" targetDate={ctx.cartClosesAt.toISOString()} />
    ) : null,
  about: (landing: LandingBody) => (landing.about ? <AboutSection key="about" data={landing.about} /> : null),
  testimonials: (landing: LandingBody) =>
    landing.testimonials && landing.testimonials.length > 0 ? (
      <TestimonialsSection key="testimonials" items={landing.testimonials} cardStyle={landing.style?.cardStyle} />
    ) : null,
  guarantee: (landing: LandingBody) =>
    landing.guarantee ? <GuaranteeSection key="guarantee" text={landing.guarantee} cardStyle={landing.style?.cardStyle} /> : null,
  faq: (landing: LandingBody) =>
    landing.faq && landing.faq.length > 0 ? (
      <FaqSection key="faq" items={landing.faq} cardStyle={landing.style?.cardStyle} />
    ) : null,
} as const;

type MiddleSectionKey = keyof typeof MIDDLE_SECTION_RENDERERS;

const LAYOUT_PRESETS: Record<LaunchType, MiddleSectionKey[]> = {
  // Evento con cierre: ponentes/agenda si los hay, niveles de precio y
  // countdown antes de la garantía, de cara al cierre.
  venta_directa: [
    "painBlocks",
    "speakers",
    "agenda",
    "amplifiedPromise",
    "includes",
    "pricingTiers",
    "countdown",
    "guarantee",
    "testimonials",
    "faq",
  ],
  // Validación ligera: corta y directa, sin Includes/About.
  semilla: ["forWhom", "amplifiedPromise", "testimonials", "faq"],
  // Secuencia larga: la más completa, incluye About porque la relación con
  // el creador pesa más en un PLF.
  plf: ["forWhom", "painBlocks", "includes", "about", "testimonials", "guarantee", "faq"],
};

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
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-widest text-[--color-muted-1] sm:mb-4">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[--color-red]" />
          {launch.type.replace("_", " ")}
        </div>

        <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold leading-[1.08] tracking-tight sm:text-4xl md:text-6xl">
          {heroHeadline}
        </h1>

        {heroSubheadline && (
          <p className="mt-2 max-w-2xl text-balance text-sm text-[--color-muted-1] sm:mt-4 sm:text-base md:text-lg">
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
            cardStyle={landing?.style?.cardStyle}
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
          (key) => {
            const rendered = MIDDLE_SECTION_RENDERERS[key]?.(landing, {
              products: activeProducts.map((p) => ({ slug: p.slug, name: p.name, priceCents: p.priceCents, currency: p.currency })),
              cartClosesAt: launch.cartClosesAt,
            });
            if (!rendered) return null;
            return (
              <SectionShell key={key} design={landing.sectionDesign?.[key]}>
                {rendered}
              </SectionShell>
            );
          },
        )}

      {/* FINAL CTA */}
      <section className="relative mx-auto max-w-3xl px-6 py-20 text-center">
        <h2 className="font-[family-name:var(--font-display)] text-3xl font-extrabold leading-tight md:text-5xl">
          {finalCtaHeadline}
        </h2>
        <div className="mt-10">
          <CtaBlock
            launchSlug={launch.slug}
            buttonLabel={finalCtaLabel}
            hasStripeProduct={hasStripeProduct}
            productSlug={product?.slug ?? null}
            startCheckoutAction={startCheckoutAction}
            captureLeadAction={captureLeadAction}
            cardStyle={landing?.style?.cardStyle}
          />
        </div>
      </section>

      <footer className="border-t border-white/10 py-8 pb-28 text-center text-xs text-[--color-muted-3]">
        Escuela Nómada Digital · {new Date().getFullYear()}
      </footer>

      <StickyActionBar
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
