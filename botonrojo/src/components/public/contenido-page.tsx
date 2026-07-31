import Link from "next/link";
import Script from "next/script";
import { BrandStyle, logoPlateFor, usableCardStyle } from "@/components/public/brand-style";
import { PublicFooter } from "@/components/public/public-footer";
import { PageBlocks } from "@/components/public/page-blocks";
import { Reveal } from "@/components/public/reveal";
import { Countdown } from "@/components/public/countdown";
import { StickyActionBar } from "@/components/public/sticky-action-bar";
import { env } from "@/lib/env";
import type { Launch } from "@/db/schema/launches";
import type { ContenidoPageBody } from "@/components/public/page-bodies";

type Props = {
  launch: Launch;
  body: ContenidoPageBody | null;
  nextHref: string;
  index: number;
  total: number;
  /** Set only when the next content page is still locked — shown as a
   * countdown in the sidebar, nothing to do with this page's own gate. */
  nextUnlockDate: Date | null;
  /** Set only when THIS page itself hasn't unlocked yet — replaces the
   * whole page with a "vuelve el..." countdown instead of the real content. */
  lockedUntil: Date | null;
};

export function ContenidoPage({ launch, body, nextHref, index, total, nextUnlockDate, lockedUntil }: Props) {
  if (lockedUntil) {
    return (
      <main className="relative min-h-screen overflow-hidden">
        <BrandStyle palette={launch.brandPalette} fonts={launch.brandFonts} />
        <section className="mx-auto flex min-h-[100svh] max-w-xl flex-col items-center justify-center px-6 text-center">
          <div className="text-xs uppercase tracking-widest text-[var(--color-accent)]">
            Contenido {index} de {total}
          </div>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-extrabold">
            Todavía no está disponible
          </h1>
          <p className="mt-3 text-[var(--color-muted-1)]">Esta entrega se abre en:</p>
          <div className="mt-4">
            <Countdown targetDate={lockedUntil.toISOString()} />
          </div>
        </section>
      </main>
    );
  }

  const paragraphs = (body?.body ?? "").split(/\n{2,}/).filter(Boolean);

  return (
    <main className="relative min-h-screen overflow-hidden">
      <BrandStyle palette={launch.brandPalette} fonts={launch.brandFonts} />
      <Script src="/track.js" data-launch={launch.slug} data-api={env.APP_URL} strategy="afterInteractive" />

      {/* Main column (kept a readable width) + a sticky sidebar — real use
          of a wide screen instead of one narrow block floating in the middle. */}
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 lg:grid-cols-[1fr_300px] lg:items-start">
        <article className="max-w-2xl">
          <div className="text-xs uppercase tracking-widest text-[var(--color-accent)]">
            Contenido {index} de {total}
          </div>

          <Reveal>
            <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-extrabold leading-tight md:text-5xl">
              {body?.headline ?? launch.name}
            </h1>
          </Reveal>

          {body?.imageUrl && (
            <Reveal className="mt-8">
              <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_30px_60px_-20px_var(--color-red-glow)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={body.imageUrl} alt="" className="h-full w-full object-cover" />
              </div>
            </Reveal>
          )}

          <Reveal className="mt-10 space-y-6 text-lg leading-relaxed text-[var(--color-muted-1)]">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </Reveal>

          <Reveal className="mt-14" id="cta">
            <Link href={nextHref} className="big-red-button inline-flex">
              {body?.ctaLabel ?? "Siguiente →"}
            </Link>
          </Reveal>
        </article>

        <aside className="space-y-4 lg:sticky lg:top-16">
          <div className="glass p-5">
            <div className="text-xs uppercase tracking-widest text-[var(--color-muted-2)]">Progreso</div>
            <div className="mt-3 flex gap-1.5">
              {Array.from({ length: total }, (_, i) => (
                <div
                  key={i}
                  className={`h-1.5 flex-1 rounded-full ${i < index ? "bg-[var(--color-accent)]" : "bg-[var(--color-border-strong)]"}`}
                />
              ))}
            </div>
          </div>

          {nextUnlockDate && (
            <div className="glass p-5">
              <div className="text-xs uppercase tracking-widest text-[var(--color-muted-2)]">
                La siguiente entrega se abre en
              </div>
              <div className="mt-3">
                <Countdown targetDate={nextUnlockDate.toISOString()} />
              </div>
            </div>
          )}
        </aside>
      </div>

      <PageBlocks
        blocks={body?.blocks}
        designs={body?.design?.blocks}
        cardStyle={usableCardStyle(launch.brandPalette, launch.brandDesign?.cardStyle)}
        ctaStyle={launch.brandDesign?.ctaStyle}
      />

      <PublicFooter launch={launch} stickyBar />

      <StickyActionBar
        logoUrl={launch.brandLogoUrl}
        logoAspect={
          ((launch.assetsCache as Record<string, unknown> | null)?.logoAspect as number) ?? null
        }
        logoPlate={logoPlateFor(
          launch.brandPalette,
          (launch.assetsCache as Record<string, unknown> | null)?.logoInk as {
            dark?: number;
            light?: number;
          } | null,
        )}
        targetDate={nextUnlockDate ? nextUnlockDate.toISOString() : null}
        countdownLabel="Siguiente entrega en"
        ctaLabel="Acceder ahora"
        href={nextUnlockDate ? undefined : nextHref}
      />
    </main>
  );
}
