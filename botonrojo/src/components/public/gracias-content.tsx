import Link from "next/link";
import Script from "next/script";
import { env } from "@/lib/env";
import { BrandStyle } from "@/components/public/brand-style";
import type { Launch } from "@/db/schema/launches";

export function GraciasContent({ isLead, launch }: { isLead: boolean; launch: Launch | null }) {
  const telegramInviteLink = launch?.telegramInviteLink ?? null;
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
          {isLead ? "¡Estas dentro!" : "¡Bienvenido!"}
        </h1>

        <p className="mt-4 max-w-xl text-balance text-lg text-[var(--color-muted-1)]">
          {isLead
            ? "Te avisaremos por email cuando se abra el carrito. Revisa tu bandeja de entrada (tambien el spam) en los proximos minutos."
            : "Tu compra esta confirmada. Te enviamos los detalles por email en unos minutos."}
        </p>

        {telegramInviteLink && (
          <div className="mt-10 w-full max-w-md rounded-xl border border-white/10 bg-white/[0.03] p-6">
            <div className="flex items-center justify-center gap-2 text-lg font-semibold text-white">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-sky-400">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
              </svg>
              Unite a la comunidad
            </div>
            <p className="mt-2 text-sm text-zinc-400">
              Sumate al grupo de Telegram{launch?.name ? ` de ${launch.name}` : ""} para recibir contenido exclusivo, novedades y conectar con la comunidad.
            </p>
            <a
              href={telegramInviteLink}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-sky-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-sky-400"
            >
              Abrir grupo en Telegram
            </a>
          </div>
        )}

        <Link
          href={launch ? `/${launch.slug}` : "/"}
          className="mt-10 text-xs uppercase tracking-widest text-[var(--color-muted-3)] transition hover:text-[var(--color-muted-1)]"
        >
          ← Volver {launch ? "a la página" : "al inicio"}
        </Link>
      </section>
    </main>
  );
}
