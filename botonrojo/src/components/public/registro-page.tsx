import Script from "next/script";
import { BrandStyle, usableCardStyle } from "@/components/public/brand-style";
import { PublicFooter } from "@/components/public/public-footer";
import { Reveal, RevealItem } from "@/components/public/reveal";
import { LeadForm } from "@/components/public/lead-form";
import { StickyActionBar } from "@/components/public/sticky-action-bar";
import { env } from "@/lib/env";
import { captureLeadAction } from "@/server/checkout";
import type { Launch } from "@/db/schema/launches";
import type { RegistroPageBody } from "@/components/public/page-bodies";

export function RegistroPage({ launch, body }: { launch: Launch; body: RegistroPageBody | null }) {
  const headline = body?.headline ?? launch.name;
  const subheadline = body?.subheadline ?? launch.promise ?? "";

  return (
    <main className="relative min-h-screen overflow-hidden">
      <BrandStyle palette={launch.brandPalette} fonts={launch.brandFonts} />
      <Script src="/track.js" data-launch={launch.slug} data-api={env.APP_URL} strategy="afterInteractive" />

      {/* Two columns on wide screens: copy left, image+form right — instead
          of one narrow centered block floating in a lot of empty space. */}
      <section className="mx-auto grid min-h-[100svh] max-w-6xl items-center gap-10 px-6 py-10 lg:grid-cols-2 lg:gap-16">
        <div className="text-center lg:text-left">
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-extrabold leading-[1.08] tracking-tight sm:text-4xl lg:text-5xl">
            {headline}
          </h1>

          {subheadline && (
            <p className="mt-4 text-balance text-base text-[var(--color-muted-1)] lg:text-lg">{subheadline}</p>
          )}

          {body?.bullets && body.bullets.length > 0 && (
            <Reveal className="mx-auto mt-6 max-w-md space-y-2 text-left lg:mx-0">
              {body.bullets.map((b, i) => (
                <RevealItem key={i} className="flex gap-2 text-sm text-[var(--color-muted-1)] lg:text-base">
                  <span className="text-[var(--color-accent)]">✓</span>
                  <span>{b}</span>
                </RevealItem>
              ))}
            </Reveal>
          )}
        </div>

        <Reveal className="mx-auto w-full max-w-md lg:mx-0 lg:max-w-none" id="cta">
          {body?.imageUrl && (
            <div className="mb-6 aspect-[4/3] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_30px_60px_-20px_var(--color-red-glow)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={body.imageUrl} alt={headline} className="h-full w-full object-cover" />
            </div>
          )}
          <LeadForm
            launchSlug={launch.slug}
            buttonLabel={body?.cta ?? "Apúntame"}
            action={captureLeadAction}
            compact
            cardStyle={usableCardStyle(launch.brandPalette, undefined)}
          />
        </Reveal>
      </section>

      <PublicFooter launch={launch} stickyBar />

      <StickyActionBar
        targetDate={launch.contentDripStartsAt ? launch.contentDripStartsAt.toISOString() : null}
        countdownLabel="Empieza en"
        ctaLabel="Registrarse ahora"
      />
    </main>
  );
}
