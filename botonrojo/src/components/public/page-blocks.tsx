import Link from "next/link";

import { Reveal, RevealItem } from "./reveal";
import { BrandIcon } from "./brand-icon";
import { SectionShell } from "./section-shell";
import { usableDivider } from "./section-design";
import { resolveVisualStyle, resolveCtaStyle } from "@/lib/design/presets";
import type { LandingCardStyle, LandingCtaStyle, SectionDesign } from "./landing-types";
import { Editable } from "./edit-overlay";
import type { PageBlock } from "./page-bodies";

/** What each block is called when you point at it. */
const BLOCK_LABELS: Record<PageBlock["type"], string> = {
  benefits: "los beneficios",
  imageText: "la imagen con texto",
  steps: "los pasos",
  faq: "las preguntas",
  testimonials: "los testimonios",
  cta: "la llamada a la acción",
};

/**
 * Renders the stackable blocks of a capture / content page.
 *
 * Same machinery as the landing's sections — SectionShell for the band design,
 * the box presets, the icon vocabulary — so a registro page can be composed
 * rather than being one fixed two-column template.
 */
export function PageBlocks({
  blocks,
  designs,
  cardStyle,
  ctaStyle,
  ctaHref = "#cta",
  editable = false,
}: {
  blocks: PageBlock[] | undefined;
  /** Band design per block, by index. */
  designs: Array<SectionDesign | undefined> | undefined;
  cardStyle: LandingCardStyle;
  ctaStyle?: LandingCtaStyle;
  /** Where a block's button points. Defaults to the page's own form. */
  ctaHref?: string;
  /** Wrap each block so it can be selected in edit mode. */
  editable?: boolean;
}) {
  if (!blocks?.length) return null;

  return (
    <>
      {blocks.map((block, i) => {
        const own = designs?.[i];
        // Same repair as the landing: a shaped divider against a painted
        // neighbour would show a wedge of page background.
        const design = own ? { ...own, divider: usableDivider(own, designs?.[i - 1]) } : own;

        const rendered = (
          <SectionShell key={i} design={design}>
            <Block block={block} cardStyle={cardStyle} ctaStyle={ctaStyle} ctaHref={ctaHref} />
          </SectionShell>
        );

        if (!editable) return rendered;
        return (
          <Editable key={i} target={{ kind: "block", index: i }} label={BLOCK_LABELS[block.type]}>
            {rendered}
          </Editable>
        );
      })}
    </>
  );
}

function Block({
  block,
  cardStyle,
  ctaStyle,
  ctaHref,
}: {
  block: PageBlock;
  cardStyle: LandingCardStyle;
  ctaStyle?: LandingCtaStyle;
  ctaHref: string;
}) {
  const card = resolveVisualStyle(cardStyle);

  if (block.type === "benefits") {
    return (
      <section className="mx-auto max-w-6xl px-6 py-20 xl:max-w-7xl">
        {block.title && (
          <h2 className="text-balance text-center font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-tight md:text-4xl">
            {block.title}
          </h2>
        )}
        <Reveal className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:gap-6">
          {block.items.map((item, i) => (
            <RevealItem
              key={i}
              className={`${card.box} ${card.hudCorners ? "hud-corners" : ""} ${card.padding.normal} ${card.hover}`}
            >
              {item.icon && <BrandIcon name={item.icon} size="lg" plate />}
              <div className="mt-4 font-[family-name:var(--font-display)] font-bold leading-snug">
                {item.title}
              </div>
              {item.text && (
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-muted-2)]">{item.text}</p>
              )}
            </RevealItem>
          ))}
        </Reveal>
      </section>
    );
  }

  if (block.type === "steps") {
    return (
      <section className="mx-auto max-w-4xl px-6 py-20">
        {block.title && (
          <h2 className="text-balance font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-tight md:text-4xl">
            {block.title}
          </h2>
        )}
        <Reveal className="mt-10 space-y-6">
          {block.items.map((item, i) => (
            <RevealItem key={i} className="flex gap-5">
              {/* The number carries the sequence, so it's the loud element. */}
              <div
                aria-hidden
                className="shrink-0 font-[family-name:var(--font-display)] text-4xl font-extrabold leading-none text-[color-mix(in_srgb,var(--color-accent)_55%,transparent)]"
              >
                {String(i + 1).padStart(2, "0")}
              </div>
              <div className="border-l border-[var(--color-border)] pl-5">
                <div className="font-[family-name:var(--font-display)] text-lg font-bold">{item.title}</div>
                {item.text && (
                  <p className="mt-1.5 leading-relaxed text-[var(--color-muted-2)]">{item.text}</p>
                )}
              </div>
            </RevealItem>
          ))}
        </Reveal>
      </section>
    );
  }

  if (block.type === "faq") {
    return (
      <section className="mx-auto max-w-6xl px-6 py-20">
        {block.title && (
          <h2 className="text-balance font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-tight md:text-4xl">
            {block.title}
          </h2>
        )}
        {/* Two columns on wide screens: a seven-question FAQ down the middle of a
            1920px display is a long thin ribbon. */}
        <Reveal className="mt-8 grid gap-3 lg:grid-cols-2 lg:gap-x-5">
          {block.items.map((item, i) => (
            <RevealItem key={i} className="h-fit">
              <details className={`group ${card.box} ${card.padding.compact}`}>
                <summary className="flex cursor-pointer items-center justify-between gap-3">
                  <span className="font-semibold">{item.q}</span>
                  <span className="text-[var(--color-accent)] transition group-open:rotate-45">+</span>
                </summary>
                <p className="mt-4 text-[var(--color-muted-2)]">{item.a}</p>
              </details>
            </RevealItem>
          ))}
        </Reveal>
      </section>
    );
  }

  if (block.type === "testimonials") {
    return (
      <section className="mx-auto max-w-6xl px-6 py-20 xl:max-w-7xl">
        {block.title && (
          <h2 className="text-balance text-center font-[family-name:var(--font-display)] text-3xl font-extrabold tracking-tight md:text-4xl">
            {block.title}
          </h2>
        )}
        <Reveal className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:gap-6">
          {block.items.map((item, i) => (
            <RevealItem
              key={i}
              className={`${card.box} ${card.hudCorners ? "hud-corners" : ""} ${card.padding.normal}`}
            >
              <BrandIcon name="mensajes" size="sm" />
              <p className="mt-3 italic leading-relaxed">{item.quote}</p>
              <div className="mt-4 text-sm font-bold">{item.author}</div>
              {item.role && (
                <div className="text-xs text-[var(--color-muted-2)]">{item.role}</div>
              )}
            </RevealItem>
          ))}
        </Reveal>
      </section>
    );
  }

  if (block.type === "cta") {
    return (
      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        {block.title && (
          <h2 className="text-balance font-[family-name:var(--font-display)] text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
            {block.title}
          </h2>
        )}
        {block.text && (
          <p className="mx-auto mt-4 max-w-xl text-[var(--color-muted-1)]">{block.text}</p>
        )}
        <Link href={ctaHref} className={`${resolveCtaStyle(ctaStyle)} mt-8`}>
          {block.ctaLabel ?? "Quiero apuntarme"}
        </Link>
      </section>
    );
  }

  // imageText — a real two-column band: image one side, argument and button the
  // other. `imageSide` lets consecutive blocks alternate instead of marching.
  const imageFirst = block.imageSide !== "right";

  return (
    <section className="mx-auto max-w-6xl px-6 py-20 xl:max-w-7xl">
      <Reveal className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
        {block.imageUrl && (
          <RevealItem className={imageFirst ? "" : "lg:order-2"}>
            <div className="overflow-hidden rounded-3xl border border-[var(--color-border)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={block.imageUrl}
                alt={block.title ?? ""}
                className="aspect-[4/3] h-full w-full object-cover"
              />
            </div>
          </RevealItem>
        )}

        <RevealItem className={imageFirst ? "" : "lg:order-1"}>
          {block.title && (
            <h2 className="text-balance font-[family-name:var(--font-display)] text-3xl font-extrabold leading-tight tracking-tight md:text-4xl">
              {block.title}
            </h2>
          )}
          {block.text && (
            <p className="mt-4 leading-relaxed text-[var(--color-muted-1)]">{block.text}</p>
          )}
          {block.ctaLabel && (
            <Link href={ctaHref} className={`${resolveCtaStyle(ctaStyle)} mt-8`}>
              {block.ctaLabel}
            </Link>
          )}
        </RevealItem>
      </Reveal>
    </section>
  );
}
