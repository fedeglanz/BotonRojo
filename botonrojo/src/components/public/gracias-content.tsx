import Link from "next/link";
import Script from "next/script";
import { env } from "@/lib/env";
import { BrandStyle } from "@/components/public/brand-style";
import type { Launch } from "@/db/schema/launches";

export function GraciasContent({ isLead, launch }: { isLead: boolean; launch: Launch | null }) {
  return (
    <main className="relative min-h-screen overflow-hidden">
      {launch && <BrandStyle palette={launch.brandPalette} fonts={launch.brandFonts} />}
      <Script
        src="/track.js"
        data-launch={launch?.slug ?? ""}
        data-api={env.APP_URL}
        strategy="afterInteractive"
      />

      <section className="mx-auto flex min-h-svh max-w-2xl flex-col items-center justify-center px-6 text-center">
        {launch?.brandLogoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={launch.brandLogoUrl} alt={launch.name} className="mb-8 max-h-12 w-auto" />
        )}

        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-3xl">
          ✓
        </div>

        <h1 className="mt-8 font-[family-name:var(--font-display)] text-4xl font-extrabold leading-tight md:text-5xl">
          {isLead ? "¡Estás dentro!" : "¡Bienvenido!"}
        </h1>

        <p className="mt-4 max-w-xl text-balance text-lg text-[--color-muted-1]">
          {isLead
            ? "Te avisaremos por email cuando se abra el carrito. Revisa tu bandeja de entrada (también el spam) en los próximos minutos."
            : "Tu compra está confirmada. Te enviamos los detalles por email en unos minutos."}
        </p>

        <Link
          href={launch ? `/${launch.slug}` : "/"}
          className="mt-10 text-xs uppercase tracking-widest text-[--color-muted-3] transition hover:text-[--color-muted-1]"
        >
          ← Volver {launch ? "a la página" : "al inicio"}
        </Link>
      </section>
    </main>
  );
}
