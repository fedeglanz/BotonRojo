import { formatPrice } from "@/lib/utils";
import type {
  LandingBody,
  LandingForWhom,
  LandingPainBlock,
  LandingIncludeItem,
  LandingAbout,
  LandingTestimonial,
  LandingFaq,
} from "./landing-types";

export type { LandingBody };

export function HeroImage({ url, alt }: { url: string; alt: string }) {
  return (
    <div className="mx-auto mt-12 max-w-4xl overflow-hidden rounded-2xl border border-white/10 bg-black/40 shadow-[0_30px_60px_-20px_rgba(239,43,61,0.35)]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={alt} className="h-full w-full object-cover" />
    </div>
  );
}

export function ForWhomSection({ data }: { data: LandingForWhom }) {
  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <SectionLabel>Para quién</SectionLabel>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6">
          <div className="font-[family-name:var(--font-display)] text-lg font-bold text-emerald-300">
            Sí, esto es para ti si…
          </div>
          <ul className="mt-4 space-y-2 text-zinc-200">
            {data.yes?.map((p, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-1 text-emerald-400">✓</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6">
          <div className="font-[family-name:var(--font-display)] text-lg font-bold text-red-300">
            No es para ti si…
          </div>
          <ul className="mt-4 space-y-2 text-zinc-300">
            {data.no?.map((p, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-1 text-red-400">✗</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function AmplifiedPromiseSection({ text }: { text: string }) {
  return (
    <section className="mx-auto max-w-3xl px-6 py-20 text-center">
      <SectionLabel>La promesa</SectionLabel>
      <p className="mt-6 text-balance font-[family-name:var(--font-display)] text-3xl font-bold leading-tight text-white md:text-4xl">
        {text}
      </p>
    </section>
  );
}

export function PainSolutionSection({ blocks }: { blocks: LandingPainBlock[] }) {
  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <SectionLabel>Antes y después</SectionLabel>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {blocks.map((b, i) => (
          <div key={i} className="glass space-y-3 p-6">
            {b.icon && <div className="text-3xl">{b.icon}</div>}
            <div className="text-sm uppercase tracking-widest text-red-300">El problema</div>
            <p className="text-zinc-300">{b.pain}</p>
            <div className="pt-3 border-t border-white/10" />
            <div className="text-sm uppercase tracking-widest text-emerald-300">→ Cómo lo resolvemos</div>
            <p className="text-white">{b.solution}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function IncludesSection({ items }: { items: LandingIncludeItem[] }) {
  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <SectionLabel>Qué incluye</SectionLabel>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {items.map((it, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]">
            {it.imageUrl && (
              <div className="aspect-video w-full overflow-hidden bg-black/40">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.imageUrl} alt="" className="h-full w-full object-cover" />
              </div>
            )}
            <div className="flex items-start gap-3 p-5">
              <div className="font-[family-name:var(--font-mono)] text-xs text-zinc-500">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div>
                <div className="font-bold text-white">
                  {it.icon && <span className="mr-2">{it.icon}</span>}
                  {it.title}
                </div>
                <p className="mt-1 text-sm text-zinc-400">{it.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AboutSection({ data }: { data: LandingAbout }) {
  if (typeof data === "string") {
    return (
      <section className="mx-auto max-w-3xl px-6 py-20">
        <SectionLabel>Sobre el creador</SectionLabel>
        <p className="mt-6 whitespace-pre-line text-lg text-zinc-300">{data}</p>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-4xl px-6 py-20">
      <SectionLabel>Sobre el creador</SectionLabel>
      <div className="mt-8 flex flex-col items-center gap-6 md:flex-row md:items-start">
        {data.creatorImageUrl && (
          <div className="relative h-40 w-40 shrink-0 overflow-hidden rounded-2xl border border-white/10 shadow-[0_15px_40px_-10px_rgba(239,43,61,0.35)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.creatorImageUrl} alt={data.creatorName ?? ""} className="h-full w-full object-cover" />
          </div>
        )}
        <div className="flex-1">
          {data.creatorName && (
            <div className="font-[family-name:var(--font-display)] text-xl font-bold text-white">
              {data.creatorName}
            </div>
          )}
          {data.creatorRole && (
            <div className="text-xs uppercase tracking-widest text-zinc-500">{data.creatorRole}</div>
          )}
          <p className="mt-4 whitespace-pre-line text-lg text-zinc-300">{data.text}</p>
        </div>
      </div>
    </section>
  );
}

export function TestimonialsSection({ items }: { items: LandingTestimonial[] }) {
  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <SectionLabel>Testimonios</SectionLabel>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {items.map((t, i) => (
          <blockquote key={i} className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
            <p className="text-lg italic text-zinc-200">"{t.quote}"</p>
            <footer className="mt-4 flex items-center gap-3">
              {t.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.imageUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="h-10 w-10 rounded-full bg-zinc-700" />
              )}
              <div>
                <div className="text-sm font-bold text-white">{t.author}</div>
                {t.role && <div className="text-xs text-zinc-500">{t.role}</div>}
              </div>
            </footer>
          </blockquote>
        ))}
      </div>
    </section>
  );
}

export function GuaranteeSection({ text }: { text: string }) {
  return (
    <section className="mx-auto max-w-3xl px-6 py-20">
      <div className="glass p-8 text-center">
        <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15 text-3xl">
          🛡️
        </div>
        <div className="mt-4 font-[family-name:var(--font-display)] text-2xl font-bold text-white">
          Garantía
        </div>
        <p className="mt-3 text-zinc-300">{text}</p>
      </div>
    </section>
  );
}

export function FaqSection({ items }: { items: LandingFaq[] }) {
  return (
    <section className="mx-auto max-w-3xl px-6 py-20">
      <SectionLabel>Preguntas frecuentes</SectionLabel>
      <div className="mt-8 space-y-2">
        {items.map((q, i) => (
          <details key={i} className="group rounded-xl border border-white/10 bg-white/[0.02] p-5">
            <summary className="flex cursor-pointer items-center justify-between text-white">
              <span className="font-semibold">{q.q}</span>
              <span className="text-[--color-red-bright] transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-4 text-zinc-400">{q.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

export function PriceTag({ priceCents, currency }: { priceCents: number; currency: string }) {
  return (
    <div className="mt-3 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-zinc-400">
      Inversión: <span className="text-white">{formatPrice(priceCents, currency)}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-center font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.3em] text-zinc-500">
      ● {children} ●
    </div>
  );
}
