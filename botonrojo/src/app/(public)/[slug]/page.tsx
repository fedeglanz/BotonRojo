import { db } from "@/db";
import { launches, assets, products } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Script from "next/script";

import { FuturisticGrid } from "@/components/futuristic/grid";
import { CtaBlock } from "@/components/public/cta-block";
import {
  AboutSection,
  AmplifiedPromiseSection,
  FaqSection,
  ForWhomSection,
  GuaranteeSection,
  HeroImage,
  IncludesSection,
  PainSolutionSection,
  PriceTag,
  TestimonialsSection,
} from "@/components/public/landing-sections";
import type { LandingBody } from "@/components/public/landing-types";

import { env } from "@/lib/env";
import { startCheckoutAction, captureLeadAction } from "@/server/checkout";

export const dynamic = "force-dynamic";

export default async function PublicLaunchPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;

  const [launch] = await db.select().from(launches).where(eq(launches.slug, slug)).limit(1);
  if (!launch) notFound();

  const [landingAsset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.launchId, launch.id), eq(assets.kind, "landing")))
    .orderBy(desc(assets.createdAt))
    .limit(1);

  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.launchId, launch.id))
    .limit(1);

  const landing = (landingAsset?.body ?? null) as LandingBody | null;
  const hasStripeProduct = Boolean(product?.stripePriceId);
  const heroHeadline = landing?.hero?.headline ?? launch.name;
  const heroSubheadline = landing?.hero?.subheadline ?? launch.promise ?? "";
  const ctaLabel = landing?.hero?.cta ?? (hasStripeProduct ? "Quiero entrar" : "Apúntame al lanzamiento");
  const finalCtaLabel = landing?.finalCta?.button ?? ctaLabel;
  const finalCtaHeadline = landing?.finalCta?.headline ?? "¿Te apuntas?";

  return (
    <main className="relative min-h-screen overflow-hidden">
      <FuturisticGrid />

      <Script
        src="/track.js"
        data-launch={launch.slug}
        data-api={env.APP_URL}
        strategy="afterInteractive"
      />

      {/* HERO */}
      <section className="relative mx-auto flex max-w-4xl flex-col items-center px-6 pt-24 text-center md:pt-32">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-widest text-zinc-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[--color-red]" />
          {launch.type.replace("_", " ")}
        </div>

        <h1 className="font-[family-name:var(--font-display)] text-5xl font-extrabold leading-[1.05] tracking-tight md:text-7xl">
          {heroHeadline}
        </h1>

        {heroSubheadline && (
          <p className="mt-6 max-w-2xl text-balance text-lg text-zinc-300 md:text-xl">
            {heroSubheadline}
          </p>
        )}

        {product && (
          <PriceTag priceCents={product.priceCents} currency={product.currency} />
        )}

        <div className="mt-10 w-full">
          <CtaBlock
            launchSlug={launch.slug}
            buttonLabel={ctaLabel}
            hasStripeProduct={hasStripeProduct}
            productSlug={product?.slug ?? null}
            startCheckoutAction={startCheckoutAction}
            captureLeadAction={captureLeadAction}
          />
        </div>
      </section>

      {landing?.hero?.imageUrl && (
        <HeroImage url={landing.hero.imageUrl} alt={heroHeadline} />
      )}

      {/* SECTIONS FROM GENERATED LANDING */}
      {landing?.forWhom && (landing.forWhom.yes?.length || landing.forWhom.no?.length) && (
        <ForWhomSection data={landing.forWhom} />
      )}

      {landing?.amplifiedPromise && <AmplifiedPromiseSection text={landing.amplifiedPromise} />}

      {landing?.painBlocks && landing.painBlocks.length > 0 && (
        <PainSolutionSection blocks={landing.painBlocks} />
      )}

      {landing?.includes && landing.includes.length > 0 && <IncludesSection items={landing.includes} />}

      {landing?.about && <AboutSection data={landing.about} />}

      {landing?.testimonials && landing.testimonials.length > 0 && (
        <TestimonialsSection items={landing.testimonials} />
      )}

      {landing?.guarantee && <GuaranteeSection text={landing.guarantee} />}

      {landing?.faq && landing.faq.length > 0 && <FaqSection items={landing.faq} />}

      {/* FINAL CTA */}
      <section className="relative mx-auto max-w-3xl px-6 py-20 text-center">
        <h2 className="font-[family-name:var(--font-display)] text-3xl font-extrabold leading-tight text-white md:text-5xl">
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
          />
        </div>
      </section>

      <footer className="border-t border-white/5 bg-black/30 py-8 text-center text-xs text-zinc-500">
        Escuela Nómada Digital · {new Date().getFullYear()}
      </footer>
    </main>
  );
}
