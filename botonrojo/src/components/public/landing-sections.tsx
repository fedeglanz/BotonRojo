import { SubmitButton } from "@/components/admin/submit-button";
import { formatPrice } from "@/lib/utils";
import { Reveal, RevealItem } from "./reveal";
import { resolveVisualStyle } from "@/lib/design/presets";
import { Countdown } from "./countdown";
import type {
  LandingBody,
  LandingForWhom,
  LandingPainBlock,
  LandingIncludeItem,
  LandingAbout,
  LandingTestimonial,
  LandingFaq,
  LandingCardStyle,
  LandingPricingTier,
  LandingSpeaker,
  LandingAgendaItem,
} from "./landing-types";

export type { LandingBody };

export type PricingProduct = { slug: string; name: string; priceCents: number; currency: string };

export function HeroImage({ url, alt }: { url: string; alt: string }) {
  return (
    <Reveal className="mx-auto mt-12 max-w-4xl">
      <div className="overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_30px_60px_-20px_var(--color-red-glow)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt={alt} className="h-full w-full object-cover" />
      </div>
    </Reveal>
  );
}

export function ForWhomSection({ data }: { data: LandingForWhom }) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 xl:max-w-7xl">
      <SectionLabel>Para quién</SectionLabel>
      <Reveal className="mt-8 grid gap-5 md:grid-cols-2 xl:gap-6">
        <RevealItem className="rounded-xl border border-[color-mix(in_srgb,var(--color-success)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-success)_8%,transparent)] p-6">
          <div className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-success)]">
            Sí, esto es para ti si…
          </div>
          <ul className="mt-4 space-y-2 text-[var(--color-muted-1)]">
            {data.yes?.map((p, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-1 text-[var(--color-success)]">✓</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </RevealItem>
        <RevealItem className="rounded-xl border border-[color-mix(in_srgb,var(--color-danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--color-danger)_8%,transparent)] p-6">
          <div className="font-[family-name:var(--font-display)] text-lg font-bold text-[var(--color-danger)]">
            No es para ti si…
          </div>
          <ul className="mt-4 space-y-2 text-[var(--color-muted-1)]">
            {data.no?.map((p, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-1 text-[var(--color-danger)]">✗</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </RevealItem>
      </Reveal>
    </section>
  );
}

export function AmplifiedPromiseSection({ text }: { text: string }) {
  return (
    <section className="mx-auto max-w-3xl px-6 py-20 text-center">
      <SectionLabel>La promesa</SectionLabel>
      <Reveal>
        <p className="mt-6 text-balance font-[family-name:var(--font-display)] text-3xl font-bold leading-tight md:text-4xl">
          {text}
        </p>
      </Reveal>
    </section>
  );
}

export function PainSolutionSection({
  blocks,
  cardStyle,
}: {
  blocks: LandingPainBlock[];
  cardStyle?: LandingCardStyle;
}) {
  const card = resolveVisualStyle(cardStyle);
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 xl:max-w-7xl">
      <SectionLabel>Antes y después</SectionLabel>
      <Reveal className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:gap-6">
        {blocks.map((b, i) => (
          <RevealItem key={i} className={`${card.box} ${card.hudCorners ? "hud-corners" : ""} ${card.padding.normal} space-y-3`}>
            {b.icon && <div className="text-3xl">{b.icon}</div>}
            <div className="text-sm uppercase tracking-widest text-[var(--color-danger)]">El problema</div>
            <p className="text-[var(--color-muted-1)]">{b.pain}</p>
            <div className="pt-3 border-t border-[var(--color-border)]" />
            <div className="text-sm uppercase tracking-widest text-[var(--color-success)]">→ Cómo lo resolvemos</div>
            <p>{b.solution}</p>
          </RevealItem>
        ))}
      </Reveal>
    </section>
  );
}

export function IncludesSection({
  items,
  cardStyle,
}: {
  items: LandingIncludeItem[];
  cardStyle?: LandingCardStyle;
}) {
  const card = resolveVisualStyle(cardStyle);
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 xl:max-w-7xl">
      <SectionLabel>Qué incluye</SectionLabel>
      <Reveal className="mt-8 grid gap-5 md:grid-cols-2 xl:gap-6">
        {items.map((it, i) => (
          <RevealItem
            key={i}
            className={`group overflow-hidden ${card.box} ${card.hover}`}
          >
            {it.imageUrl && (
              <div className="aspect-video w-full overflow-hidden bg-[var(--color-surface)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={it.imageUrl}
                  alt=""
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                />
              </div>
            )}
            <div className="flex items-start gap-3 p-5">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-accent)_18%,transparent)] font-[family-name:var(--font-mono)] text-xs text-[var(--color-accent)]">
                {String(i + 1).padStart(2, "0")}
              </div>
              <div>
                <div className="font-bold">
                  {it.icon && <span className="mr-2">{it.icon}</span>}
                  {it.title}
                </div>
                <p className="mt-1 text-sm text-[var(--color-muted-2)]">{it.description}</p>
              </div>
            </div>
          </RevealItem>
        ))}
      </Reveal>
    </section>
  );
}

export function AboutSection({ data }: { data: LandingAbout }) {
  if (typeof data === "string") {
    return (
      <section className="mx-auto max-w-3xl px-6 py-20">
        <SectionLabel>Sobre el creador</SectionLabel>
        <Reveal>
          <p className="mt-6 whitespace-pre-line text-lg text-[var(--color-muted-1)]">{data}</p>
        </Reveal>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-5xl px-6 py-20">
      <SectionLabel>Sobre el creador</SectionLabel>
      <Reveal className="mt-8 flex flex-col items-center gap-10 md:flex-row md:items-start">
        {data.creatorImageUrl && (
          <RevealItem className="relative aspect-[3/4] w-64 shrink-0 overflow-hidden rounded-2xl border border-[var(--color-border)] shadow-[0_20px_50px_-15px_var(--color-red-glow)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.creatorImageUrl} alt={data.creatorName ?? ""} className="h-full w-full object-cover" />
          </RevealItem>
        )}
        <RevealItem className="flex-1">
          {data.creatorName && (
            <div className="font-[family-name:var(--font-display)] text-xl font-bold">
              {data.creatorName}
            </div>
          )}
          {data.creatorRole && (
            <div className="text-xs uppercase tracking-widest text-[var(--color-accent)]">{data.creatorRole}</div>
          )}
          <p className="mt-4 whitespace-pre-line text-lg text-[var(--color-muted-1)]">{data.text}</p>
        </RevealItem>
      </Reveal>
    </section>
  );
}

export function TestimonialsSection({
  items,
  cardStyle,
}: {
  items: LandingTestimonial[];
  cardStyle?: LandingCardStyle;
}) {
  const card = resolveVisualStyle(cardStyle);
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 xl:max-w-7xl">
      <SectionLabel>Testimonios</SectionLabel>
      <Reveal className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:gap-6">
        {items.map((t, i) => (
          <RevealItem key={i} className={`${card.box} ${card.padding.normal}`}>
            <div className="font-[family-name:var(--font-display)] text-3xl leading-none text-[var(--color-accent)]">
              &ldquo;
            </div>
            <p className="-mt-2 text-lg italic text-[var(--color-muted-1)]">{t.quote}</p>
            <footer className="mt-4 flex items-center gap-3">
              {t.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={t.imageUrl}
                  alt=""
                  className="h-10 w-10 rounded-full border-2 border-[var(--color-accent)] object-cover"
                />
              ) : (
                <div className="h-10 w-10 rounded-full bg-zinc-700" />
              )}
              <div>
                <div className="text-sm font-bold">{t.author}</div>
                {t.role && <div className="text-xs text-[var(--color-muted-3)]">{t.role}</div>}
              </div>
            </footer>
          </RevealItem>
        ))}
      </Reveal>
    </section>
  );
}

export function SpeakersSection({ items }: { items: LandingSpeaker[] }) {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 xl:max-w-7xl">
      <SectionLabel>Ponentes</SectionLabel>
      <Reveal className="mt-8 grid gap-5 grid-cols-2 lg:grid-cols-4 xl:gap-6">
        {items.map((s, i) => (
          <RevealItem key={i} className="text-center">
            <div className="mx-auto aspect-square w-full max-w-[160px] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]">
              {s.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={s.imageUrl} alt={s.name} className="h-full w-full object-cover" />
              )}
            </div>
            <div className="mt-3 font-bold">{s.name}</div>
            {s.role && <div className="text-xs text-[var(--color-muted-2)]">{s.role}</div>}
          </RevealItem>
        ))}
      </Reveal>
    </section>
  );
}

export function AgendaSection({ items }: { items: LandingAgendaItem[] }) {
  return (
    <section className="mx-auto max-w-2xl px-6 py-20">
      <SectionLabel>Agenda</SectionLabel>
      <Reveal className="mt-8 space-y-3">
        {items.map((a, i) => (
          <RevealItem key={i} className="flex gap-4 border-l-2 border-[var(--color-accent)]/40 pl-4">
            <div className="w-16 shrink-0 font-[family-name:var(--font-mono)] text-sm text-[var(--color-accent)]">
              {a.time}
            </div>
            <div className="text-[var(--color-muted-1)]">{a.topic}</div>
          </RevealItem>
        ))}
      </Reveal>
    </section>
  );
}

export function PricingTiersSection({
  tiers,
  products,
  scarcityNote,
  startCheckoutAction,
  cardStyle,
}: {
  tiers: LandingPricingTier[];
  products: PricingProduct[];
  scarcityNote?: string;
  startCheckoutAction: (formData: FormData) => Promise<void>;
  cardStyle?: LandingCardStyle;
}) {
  const card = resolveVisualStyle(cardStyle);
  const rows = tiers
    .map((tier) => ({ tier, product: products.find((p) => p.slug === tier.productSlug) }))
    .filter((r): r is { tier: LandingPricingTier; product: PricingProduct } => Boolean(r.product));

  if (rows.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-6 py-20 xl:max-w-7xl">
      <SectionLabel>Elige tu entrada</SectionLabel>
      {scarcityNote && (
        <p className="mt-3 text-center text-sm font-semibold text-[var(--color-red-bright)]">{scarcityNote}</p>
      )}
      <Reveal className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:gap-6">
        {rows.map(({ tier, product }) => (
          <RevealItem
            key={product.slug}
            className={`flex flex-col ${card.box} ${card.hudCorners ? "hud-corners" : ""} ${card.padding.normal}`}
          >
            {tier.highlight && (
              <div className="mb-2 inline-block self-start rounded-full bg-[var(--color-accent)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-black">
                {tier.highlight}
              </div>
            )}
            <div className="font-[family-name:var(--font-display)] text-lg font-bold">{product.name}</div>
            <div className="mt-2 font-[family-name:var(--font-mono)] text-3xl font-bold text-[var(--color-red-bright)]">
              {formatPrice(product.priceCents, product.currency)}
            </div>
            <ul className="mt-4 flex-1 space-y-2 text-sm text-[var(--color-muted-1)]">
              {tier.bullets?.map((b, j) => (
                <li key={j} className="flex gap-2">
                  <span className="text-[var(--color-accent)]">✓</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>
            <form action={startCheckoutAction} className="mt-6">
              <input type="hidden" name="productSlug" value={product.slug} />
              <SubmitButton className="big-red-button w-full" pendingLabel="Redirigiendo…">
                Comprar
              </SubmitButton>
            </form>
          </RevealItem>
        ))}
      </Reveal>
    </section>
  );
}

export function CountdownSection({ targetDate, label }: { targetDate: string; label?: string }) {
  return (
    <section className="mx-auto max-w-3xl px-6 py-14 text-center">
      <p className="text-xs uppercase tracking-widest text-[var(--color-muted-2)]">{label ?? "El precio sube en"}</p>
      <div className="mt-3">
        <Countdown targetDate={targetDate} />
      </div>
    </section>
  );
}

export function GuaranteeSection({ text, cardStyle }: { text: string; cardStyle?: LandingCardStyle }) {
  const card = resolveVisualStyle(cardStyle);
  return (
    <section className="mx-auto max-w-3xl px-6 py-20">
      <Reveal>
        <div className={`${card.box} ${card.hudCorners ? "hud-corners" : ""} ${card.padding.spacious} text-center`}>
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--color-accent)_18%,transparent)] text-3xl">
            🛡️
          </div>
          <div className="mt-4 font-[family-name:var(--font-display)] text-2xl font-bold">
            Garantía
          </div>
          <p className="mt-3 text-[var(--color-muted-1)]">{text}</p>
        </div>
      </Reveal>
    </section>
  );
}

export function FaqSection({ items, cardStyle }: { items: LandingFaq[]; cardStyle?: LandingCardStyle }) {
  const card = resolveVisualStyle(cardStyle);
  return (
    <section className="mx-auto max-w-6xl px-6 py-20">
      <SectionLabel>Preguntas frecuentes</SectionLabel>
      {/* Two columns on wide screens so a 7-question FAQ doesn't become a
          long thin ribbon down the middle of a 1920px display. */}
      <Reveal className="mt-8 grid gap-3 lg:grid-cols-2 lg:gap-x-5">
        {items.map((q, i) => (
          <RevealItem key={i} className="h-fit">
            <details className={`group ${card.box} ${card.padding.compact}`}>
              <summary className="flex cursor-pointer items-center justify-between">
                <span className="font-semibold">{q.q}</span>
                <span className="text-[var(--color-red-bright)] transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-4 text-[var(--color-muted-2)]">{q.a}</p>
            </details>
          </RevealItem>
        ))}
      </Reveal>
    </section>
  );
}

export function PriceTag({ priceCents, currency }: { priceCents: number; currency: string }) {
  return (
    <div className="mt-3 font-[family-name:var(--font-mono)] text-xs uppercase tracking-widest text-[var(--color-muted-2)]">
      Inversión: <span className="font-semibold">{formatPrice(priceCents, currency)}</span>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-center font-[family-name:var(--font-mono)] text-xs uppercase tracking-[0.3em] text-[var(--color-muted-3)]">
      <span className="text-[var(--color-accent)]">●</span> {children} <span className="text-[var(--color-accent)]">●</span>
    </div>
  );
}
