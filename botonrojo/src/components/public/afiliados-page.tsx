import Link from "next/link";
import { BrandStyle, usableCardStyle } from "@/components/public/brand-style";
import { PublicFooter } from "@/components/public/public-footer";
import { PageBlocks } from "@/components/public/page-blocks";
import { Reveal, RevealItem } from "@/components/public/reveal";
import type { Launch } from "@/db/schema/launches";
import { SectionShell } from "@/components/public/section-shell";
import { usableDivider } from "@/components/public/section-design";
import { EditModeProvider, Editable } from "@/components/public/edit-overlay";
import { EDIT_DISABLED, type EditContext } from "@/components/public/edit-mode";
import {
  editRefineAction,
  editDesignAction,
  addBlockAction,
  removeBlockAction,
  movePartAction,
} from "@/server/page-edit";
import type { AfiliadosPageBody } from "@/components/public/page-bodies";

export function AfiliadosPage({
  launch,
  body,
  signupHref,
  edit = EDIT_DISABLED,
}: {
  launch: Launch;
  body: AfiliadosPageBody | null;
  signupHref: string;
  edit?: EditContext;
}) {
  const paragraphs = (body?.pitch ?? "").split(/\n{2,}/).filter(Boolean);
  const commissionPct = (
    (launch.affiliateCommissionRate ?? 3000) / 100
  ).toFixed(0);

  return (
    <EditModeProvider
      ctx={edit}
      refineAction={editRefineAction}
      designAction={editDesignAction}
      addBlockAction={addBlockAction}
      removeBlockAction={removeBlockAction}
      moveAction={movePartAction}
      blockCount={body?.blocks?.length ?? 0}
    >
      <main className="relative min-h-screen overflow-hidden">
        <BrandStyle palette={launch.brandPalette} fonts={launch.brandFonts} />

        <Editable target={{ kind: "hero" }} label="la parte principal">
          <SectionShell
            design={
              body?.design?.hero
                ? {
                    ...body.design.hero,
                    divider: usableDivider(body.design.hero, undefined, true),
                  }
                : undefined
            }
          >
            <div className="mx-auto grid min-h-[100svh] max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-[1fr_320px] lg:gap-16">
              <div>
                <div className="text-xs uppercase tracking-widest text-[var(--color-accent)]">
                  Programa de afiliados
                </div>
                <Reveal>
                  <h1 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-extrabold leading-tight md:text-5xl">
                    {body?.headline ?? `Sé afiliado de ${launch.name}`}
                  </h1>
                </Reveal>

                <Reveal className="mt-8 grid gap-5 sm:grid-cols-2">
                  {paragraphs.map((p, i) => (
                    <RevealItem
                      key={i}
                      className="leading-relaxed text-[var(--color-muted-1)]"
                    >
                      {p}
                    </RevealItem>
                  ))}
                </Reveal>
              </div>

              <Reveal className="lg:sticky lg:top-16">
                <div className="glass p-6 text-center">
                  <div className="text-xs uppercase tracking-widest text-[var(--color-muted-2)]">
                    Tu comisión
                  </div>
                  <div className="mt-2 font-[family-name:var(--font-mono)] text-5xl font-bold text-[var(--color-red-bright)]">
                    {commissionPct}%
                  </div>
                  {body?.commissionNote && (
                    <p className="mt-3 text-sm text-[var(--color-muted-1)]">
                      {body.commissionNote}
                    </p>
                  )}
                  <Link
                    href={signupHref}
                    className="big-red-button mt-6 w-full"
                  >
                    Quiero ser afiliado
                  </Link>
                </div>
              </Reveal>
            </div>
          </SectionShell>
        </Editable>

        <PageBlocks
          blocks={body?.blocks}
          designs={body?.design?.blocks}
          cardStyle={usableCardStyle(
            launch.brandPalette,
            launch.brandDesign?.cardStyle,
          )}
          ctaStyle={launch.brandDesign?.ctaStyle}
          editable={edit.enabled}
        />

        <PublicFooter launch={launch} />
      </main>
    </EditModeProvider>
  );
}
