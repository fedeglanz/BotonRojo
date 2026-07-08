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

  const telegramInviteLink = launch.telegramInviteLink;
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

      {telegramInviteLink && (
        <section className="mx-auto max-w-3xl px-6 py-16 text-center">
          <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-8 md:p-10">
            <div className="flex items-center justify-center gap-2">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7 text-sky-400">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
              </svg>
              <h2 className="font-[family-name:var(--font-display)] text-2xl font-extrabold text-white md:text-3xl">
                Unite a la comunidad
              </h2>
            </div>
            <p className="mx-auto mt-3 max-w-lg text-sm text-zinc-300 md:text-base">
              Sumate al grupo de Telegram para recibir contenido exclusivo, novedades y conectar con otros participantes.
            </p>
            <a
              href={telegramInviteLink}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-sky-500 px-8 py-3 text-sm font-semibold text-white transition hover:bg-sky-400 md:text-base"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
              </svg>
              Abrir grupo en Telegram
            </a>
          </div>
        </section>
      )}

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
