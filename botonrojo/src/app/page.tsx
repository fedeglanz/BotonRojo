import Link from "next/link";
import { BigRedButton } from "@/components/public/big-red-button";
import { FuturisticGrid } from "@/components/futuristic/grid";
import { Scanlines } from "@/components/futuristic/scanlines";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <FuturisticGrid />
      <Scanlines />

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <span className="inline-block h-3 w-3 rounded-full bg-[--color-red] shadow-[0_0_18px_var(--color-red-glow)]" />
          <span className="font-[family-name:var(--font-display)] text-sm font-bold uppercase tracking-[0.2em]">
            Botón Rojo
          </span>
        </div>
        <nav className="hidden gap-6 text-sm text-zinc-400 md:flex">
          <Link href="/registro-afiliado" className="transition hover:text-white">
            Programa afiliados
          </Link>
          <Link href="/admin" className="transition hover:text-white">Dashboard</Link>
          <Link href="/login" className="transition hover:text-white">Acceder</Link>
        </nav>
      </header>

      <section className="relative mx-auto flex max-w-4xl flex-col items-center px-6 pt-16 text-center md:pt-28">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-widest text-zinc-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[--color-red]" />
          Sistema de lanzamientos · v0.1
        </div>

        <h1 className="font-[family-name:var(--font-display)] text-5xl font-extrabold leading-[1.05] tracking-tight md:text-7xl">
          Un solo botón.
          <br />
          <span className="bg-gradient-to-br from-white via-zinc-200 to-zinc-500 bg-clip-text text-transparent">
            Tu lanzamiento entero.
          </span>
        </h1>

        <p className="mt-6 max-w-2xl text-balance text-lg text-zinc-400 md:text-xl">
          Avatar, copy, landing, emails, anuncios, afiliados y carrito. Todo lo que necesita
          un lanzamiento digital, generado y conectado a Stripe. Sin WordPress.
        </p>

        <div className="mt-12">
          <BigRedButton href="/admin">Pulsar el botón rojo</BigRedButton>
        </div>

        <p className="mt-5 font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.25em] text-zinc-500">
          → tres tipos · venta directa · semilla · plf
        </p>
      </section>

      <section className="relative mx-auto mt-28 grid max-w-6xl gap-4 px-6 pb-24 md:grid-cols-3">
        {[
          { k: "01", t: "Marco de copy", d: "Avatar, promesa, dolores y beneficios desde un brief." },
          { k: "02", t: "Landing + carrito", d: "Diseño futurista generado y conectado a Stripe." },
          { k: "03", t: "Afiliados + tracking", d: "Códigos `?ref=`, UTMs y conversiones por lanzamiento." },
          { k: "04", t: "Email + Telegram", d: "Secuencias específicas por tipo de lanzamiento." },
          { k: "05", t: "Anuncios Meta + Google", d: "UGC, voz en off y clips de YouTube + CTA overlay." },
          { k: "06", t: "Lead magnets + pop-ups", d: "Descargables, banners RRSS y captación previa." },
        ].map((c) => (
          <div key={c.k} className="glass relative p-6">
            <div className="font-[family-name:var(--font-mono)] text-xs text-zinc-500">{c.k}</div>
            <div className="mt-2 font-[family-name:var(--font-display)] text-xl font-bold">{c.t}</div>
            <div className="mt-2 text-sm text-zinc-400">{c.d}</div>
          </div>
        ))}
      </section>

      <footer className="border-t border-white/5 bg-black/30 py-8 text-center text-xs text-zinc-500">
        Escuela Nómada Digital · Sistema interno
      </footer>
    </main>
  );
}
