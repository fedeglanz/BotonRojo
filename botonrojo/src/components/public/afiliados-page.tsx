import Link from "next/link";
import { BrandStyle } from "@/components/public/brand-style";
import { Reveal, RevealItem } from "@/components/public/reveal";
import type { Launch } from "@/db/schema/launches";
import type { AfiliadosPageBody } from "@/components/public/page-bodies";

export function AfiliadosPage({
  launch,
  body,
  signupHref,
}: {
  launch: Launch;
  body: AfiliadosPageBody | null;
  signupHref: string;
}) {
  const paragraphs = (body?.pitch ?? "").split(/\n{2,}/).filter(Boolean);
  const commissionPct = ((launch.affiliateCommissionRate ?? 3000) / 100).toFixed(0);

  return (
    <main className="relative min-h-screen overflow-hidden">
      <BrandStyle palette={launch.brandPalette} fonts={launch.brandFonts} />

      <div className="mx-auto grid min-h-[100svh] max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-[1fr_320px] lg:gap-16">
        <div>
          <div className="text-xs uppercase tracking-widest text-[--color-accent]">Programa de afiliados</div>
          <Reveal>
            <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-extrabold leading-tight md:text-5xl">
              {body?.headline ?? `Sé afiliado de ${launch.name}`}
            </h1>
          </Reveal>

          <Reveal className="mt-8 grid gap-5 sm:grid-cols-2">
            {paragraphs.map((p, i) => (
              <RevealItem key={i} className="leading-relaxed text-[--color-muted-1]">
                {p}
              </RevealItem>
            ))}
          </Reveal>
        </div>

        <Reveal className="lg:sticky lg:top-16">
          <div className="glass p-6 text-center">
            <div className="text-xs uppercase tracking-widest text-[--color-muted-2]">Tu comisión</div>
            <div className="mt-2 font-[family-name:var(--font-mono)] text-5xl font-bold text-[--color-red-bright]">
              {commissionPct}%
            </div>
            {body?.commissionNote && (
              <p className="mt-3 text-sm text-[--color-muted-1]">{body.commissionNote}</p>
            )}
            <Link href={signupHref} className="big-red-button mt-6 w-full">
              Quiero ser afiliado
            </Link>
          </div>
        </Reveal>
      </div>

      <footer className="border-t border-[--color-border] py-8 text-center text-xs text-[--color-muted-3]">
        {new Date().getFullYear()}
      </footer>
    </main>
  );
}
