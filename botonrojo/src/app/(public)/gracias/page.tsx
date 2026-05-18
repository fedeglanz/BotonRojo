import Link from "next/link";
import Script from "next/script";
import { FuturisticGrid } from "@/components/futuristic/grid";
import { env } from "@/lib/env";

type SearchParams = Promise<{
  session_id?: string;
  lead?: string;
  launch?: string;
}>;

export default async function GraciasPage(props: { searchParams: SearchParams }) {
  const sp = await props.searchParams;
  const isLead = sp.lead === "1";
  const launchSlug = sp.launch;

  return (
    <main className="relative min-h-screen overflow-hidden">
      <FuturisticGrid />

      <Script
        src="/track.js"
        data-launch={launchSlug ?? ""}
        data-api={env.APP_URL}
        strategy="afterInteractive"
      />

      <section className="mx-auto flex max-w-2xl flex-col items-center px-6 pt-32 text-center">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-3xl">
          ✓
        </div>

        <h1 className="mt-8 font-[family-name:var(--font-display)] text-4xl font-extrabold leading-tight md:text-5xl">
          {isLead ? "¡Estás dentro!" : "¡Bienvenido!"}
        </h1>

        <p className="mt-4 max-w-xl text-balance text-lg text-zinc-300">
          {isLead
            ? "Te avisaremos por email cuando se abra el carrito. Revisa tu bandeja de entrada (también el spam) en los próximos minutos."
            : "Tu compra está confirmada. Te enviamos los detalles por email en unos minutos."}
        </p>

        <Link
          href="/"
          className="mt-10 text-xs uppercase tracking-widest text-zinc-500 transition hover:text-zinc-300"
        >
          ← Volver al inicio
        </Link>
      </section>
    </main>
  );
}
