import Link from "next/link";
import { notFound } from "next/navigation";

import { isCustomPageBody } from "@/lib/custom-page";
import { retireCustomPageAction } from "@/server/page-edit";
import { env } from "@/lib/env";
import { hasActiveConnector } from "@/mcp/auth";
import { ClaudeGoButton } from "@/components/admin/claude-go-button";
import {
  CLAUDE_DESIGN_URL,
  claudeDesignPagePrompt,
  claudeEditPagePrompt,
} from "@/lib/claude-link";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { assets, launches, users } from "@/db/schema";
import { requireOrgAdmin } from "@/lib/auth-helpers";
import { pagePath, resolvePages, contentUnlockDate } from "@/lib/launch-pages";
import { fieldsForKind } from "@/lib/page-fields";
import { LAUNCH_TYPES, type LaunchType } from "@/lib/launch-types";

import {
  regenerateSinglePageAction,
  updatePageFieldsAction,
  refinePageFieldAction,
  refineLandingSectionAction,
  updateSectionRawAction,
  setSectionImageAction,
  updateSectionDesignAction,
  applyDesignFixesAction,
  reviewPageDesignAction,
  applyReviewSuggestionAction,
} from "@/server/launches";
import { LandingEditor } from "@/components/admin/landing-editor";
import { PagePartsEditor } from "@/components/admin/page-parts-editor";
import { DesignReviewPanel } from "@/components/admin/design-review-panel";
import { SubmitButton } from "@/components/admin/submit-button";
import { AiGeneratingOverlay } from "@/components/admin/ai-generating-overlay";
import type { LandingBody } from "@/components/public/landing-types";

export const dynamic = "force-dynamic";

/**
 * One screen per page of the launch. Before this only the sales page could be
 * edited part by part, buried inside a step of the launch hub, while every other
 * page got a raw JSON box — so the pages didn't feel equally important and the
 * hub carried far too much at once.
 */
export default async function LaunchPageEditor(props: {
  params: Promise<{ slug: string; pageKey: string }>;
}) {
  const { slug, pageKey } = await props.params;
  const { organizationId } = await requireOrgAdmin();

  const [launch] = await db
    .select()
    .from(launches)
    .where(
      and(eq(launches.slug, slug), eq(launches.organizationId, organizationId)),
    )
    .limit(1);
  if (!launch) notFound();

  const pages = resolvePages(launch.type as LaunchType, launch.pageConfig);
  const pageDef = pages.find((p) => p.pageKey === pageKey);
  if (!pageDef) notFound();

  const [asset] = await db
    .select()
    .from(assets)
    .where(
      and(
        eq(assets.launchId, launch.id),
        eq(assets.kind, "landing"),
        eq(assets.pageKey, pageKey),
      ),
    )
    .orderBy(desc(assets.createdAt))
    .limit(1);

  const body = (asset?.body ?? null) as Record<string, unknown> | null;
  const hasContent = Boolean(asset);
  // Designed outside the app. Everything below that would rewrite the page is
  // hidden: regenerating or editing a section would replace a design nobody here
  // can reproduce, and the JSON editors have nothing to edit — the content is a
  // finished HTML document.
  const fromClaude = isCustomPageBody(asset?.body);
  // Un botón que abre Claude solo sirve si la cuenta tiene el conector conectado.
  const connector = await hasActiveConnector(launch.organizationId);
  const publicUrl = pagePath(launch.slug, pageDef);
  const claudeLinkArgs = {
    launchSlug: launch.slug,
    launchName: launch.name,
    pageKey,
    pageLabel: pageDef.label,
    publicUrl: `${env.APP_URL.replace(/\/$/, "")}${publicUrl}`,
  };
  const publicPath = pagePath(launch.slug, pageDef);
  const unlockDate = contentUnlockDate(launch.contentDripStartsAt, pageKey);

  // Version history is only kept for the sales page, which is the one edited
  // section by section and therefore the one worth rolling back.
  const versions =
    pageDef.kind === "venta"
      ? await db
          .select({
            id: assets.id,
            createdAt: assets.createdAt,
            generatedByAi: assets.generatedByAi,
            authorEmail: users.email,
            authorName: users.name,
          })
          .from(assets)
          .leftJoin(users, eq(assets.authorId, users.id))
          .where(
            and(
              eq(assets.launchId, launch.id),
              eq(assets.kind, "landing"),
              eq(assets.pageKey, pageKey),
            ),
          )
          .orderBy(desc(assets.createdAt))
      : [];

  const storedInstruction =
    (
      (launch.assetsCache as Record<string, unknown> | null)
        ?.pageInstructions as Record<string, string> | undefined
    )?.[pageKey] ?? "";

  // No page can be created before the visual identity is approved: it decides
  // the palette, the fonts and the whole design system the page is built from.
  const brandApproved =
    launch.brandKitStatus === "approved" &&
    Boolean(launch.brandPalette) &&
    Boolean(launch.brandFonts);
  const hasMarco = Boolean(launch.promise && launch.avatar);
  const canGenerate = brandApproved && hasMarco;

  const index = pages.findIndex((p) => p.pageKey === pageKey);
  const prev = pages[index - 1];
  const next = pages[index + 1];

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <Link
          href={`/admin/lanzamientos/${launch.slug}?seccion=paginas`}
          className="text-xs uppercase tracking-widest text-zinc-500 hover:text-zinc-300"
        >
          ← {launch.name}
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold md:text-3xl">
              {pageDef.label}
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              <code className="text-[var(--color-red-bright)]">
                {publicPath}
              </code>
              {" · "}
              {fromClaude
                ? "Diseñada en Claude"
                : hasContent
                  ? "Generada"
                  : "Sin generar"}
              {pageDef.kind === "legal" &&
                " · borrador de IA, revísalo con un asesor antes de publicar"}
              {unlockDate &&
                ` · se abre el ${unlockDate.toLocaleDateString("es")}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={publicPath}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition hover:border-[var(--color-red)]"
            >
              Ver esta página ↗
            </a>

            {/* Diseñar o rediseñar en Claude, sin tener que explicarle nada: el
                enlace abre un chat con la instrucción y las herramientas puestas. */}
            {pageDef.kind !== "legal" && (
              <ClaudeGoButton
                hasConnector={connector}
                label={fromClaude ? "Cambiar en Claude" : "Diseñar en Claude"}
                href={CLAUDE_DESIGN_URL}
                prompt={
                  fromClaude
                    ? claudeEditPagePrompt(claudeLinkArgs)
                    : claudeDesignPagePrompt({
                        ...claudeLinkArgs,
                        pageKind: pageDef.kind,
                      })
                }
              />
            )}
          </div>
        </div>

        {fromClaude ? (
          <div className="space-y-3 rounded-xl border border-emerald-400/25 bg-emerald-400/5 p-4">
            <div className="text-xs uppercase tracking-widest text-emerald-300">
              Esta página se lleva desde Claude
            </div>
            <p className="text-sm text-zinc-300">
              La diseñaste en Claude Design y la publicó el conector. Para
              cambiarla, pídeselo a Claude: tiene el HTML actual con{" "}
              <code>ver_pagina</code> y lo vuelve a publicar. Desde aquí no se
              toca a propósito — regenerarla la sustituiría por una página del
              sistema y perderías el diseño.
            </p>
            <p className="text-xs text-zinc-500">
              La medición, el formulario, el pago y los afiliados siguen
              funcionando: los cablea la plataforma al servirla.
            </p>
            <form
              action={retireCustomPageAction.bind(null, launch.id, pageKey)}
            >
              <SubmitButton variant="outline" pendingLabel="Retirando…">
                Retirar el diseño y volver a la página generada
              </SubmitButton>
            </form>
          </div>
        ) : (
          <>
            {/* Regenerating the whole page takes a brief: structure, global copy,
            design. It's remembered per page, so a second pass starts from what
            you asked the first time instead of from nothing. */}
            <form
              action={regenerateSinglePageAction.bind(null, launch.id, pageKey)}
              className="space-y-2 rounded-xl border border-[var(--color-red)]/25 bg-[var(--color-red)]/5 p-4"
            >
              <AiGeneratingOverlay
                messages={[
                  `Escribiendo ${pageDef.label.toLowerCase()}…`,
                  "Ajustando el tono…",
                  "Repasando la estructura…",
                ]}
              />
              <label className="block">
                <span className="block text-[10px] uppercase tracking-widest text-zinc-400">
                  Qué quieres de esta página (estructura, copy, diseño)
                </span>
                <textarea
                  name="instruction"
                  rows={3}
                  defaultValue={storedInstruction}
                  placeholder="Más corta y directa. Sube el formulario arriba, quita los testimonios y pon una banda oscura a pantalla completa en la promesa."
                  className="field-input mt-1.5 w-full px-3 py-2 text-sm text-white"
                />
                <span className="mt-1 block text-xs text-zinc-500">
                  Opcional. Se guarda para esta página y manda sobre las
                  instrucciones generales del lanzamiento.
                </span>
              </label>
              <div className="flex flex-wrap items-center justify-end gap-3">
                {!canGenerate && (
                  <p className="mr-auto text-xs text-amber-300">
                    {!brandApproved ? (
                      <>
                        Aprueba primero la{" "}
                        <Link
                          href={`/admin/lanzamientos/${launch.slug}?seccion=marca`}
                          className="underline underline-offset-2"
                        >
                          identidad visual
                        </Link>
                        : decide la paleta, las tipografías y el sistema de
                        diseño de esta página.
                      </>
                    ) : (
                      <>Genera antes el marco de copy (avatar y promesa).</>
                    )}
                  </p>
                )}
                <SubmitButton
                  variant={hasContent ? "outline" : "primary"}
                  pendingLabel="Generando…"
                  disabled={!canGenerate}
                >
                  {hasContent ? "Regenerar entera" : "Generar con Claude"}
                </SubmitButton>
              </div>
            </form>
          </>
        )}

        {/* Moving between the launch's pages without going back to the hub. */}
        <nav className="flex items-center justify-between gap-3 border-t border-white/5 pt-3 text-xs">
          {prev ? (
            <Link
              href={`/admin/lanzamientos/${launch.slug}/paginas/${prev.pageKey}`}
              className="text-zinc-500 hover:text-zinc-200"
            >
              ← {prev.label}
            </Link>
          ) : (
            <span />
          )}
          <span className="text-zinc-600">
            {index + 1} de {pages.length} ·{" "}
            {LAUNCH_TYPES[launch.type as LaunchType]?.label ?? launch.type}
          </span>
          {next ? (
            <Link
              href={`/admin/lanzamientos/${launch.slug}/paginas/${next.pageKey}`}
              className="text-zinc-500 hover:text-zinc-200"
            >
              {next.label} →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </header>

      {!hasContent && !fromClaude && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
          {brandApproved
            ? "Esta página aún no tiene contenido. Genérala con Claude, o escribe sus partes a mano y guarda: se crea igual."
            : "Esta página no se puede crear todavía: falta aprobar la identidad visual del lanzamiento."}
        </p>
      )}

      {/* Inspection applies to a Claude page too — it only looks and reports. What
          it must not offer there is the automatic fix, which rewrites the JSON. */}
      <DesignReviewPanel
        review={asset?.designReview}
        launchId={launch.id}
        pageKey={pageKey}
        hasContent={hasContent}
        reviewAction={reviewPageDesignAction}
        applySuggestionAction={applyReviewSuggestionAction}
        // Content-level auto-fix only rewrites the landing JSON, so it's offered
        // where it can actually do something.
        fixAction={
          pageDef.kind === "venta" && !fromClaude
            ? applyDesignFixesAction
            : undefined
        }
      />

      {fromClaude ? null : pageDef.kind === "venta" ? (
        <>
          <LandingEditor
            launchId={launch.id}
            launchSlug={launch.slug}
            body={(asset?.body ?? null) as LandingBody | null}
            versions={versions}
            refineAction={refineLandingSectionAction.bind(
              null,
              launch.id,
              pageKey,
            )}
            rawUpdateAction={updateSectionRawAction.bind(
              null,
              launch.id,
              pageKey,
            )}
            imageSaveAction={setSectionImageAction.bind(
              null,
              launch.id,
              pageKey,
            )}
            designAction={updateSectionDesignAction.bind(
              null,
              launch.id,
              pageKey,
            )}
          />
        </>
      ) : (
        <PagePartsEditor
          launchId={launch.id}
          pageKey={pageKey}
          fields={fieldsForKind(pageDef.kind)}
          body={body}
          saveAction={updatePageFieldsAction}
          refineAction={refinePageFieldAction}
        />
      )}
    </div>
  );
}
