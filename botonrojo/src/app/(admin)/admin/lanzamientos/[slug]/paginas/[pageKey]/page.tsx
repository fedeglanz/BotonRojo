import Link from "next/link";
import { notFound } from "next/navigation";
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
    .where(and(eq(launches.slug, slug), eq(launches.organizationId, organizationId)))
    .limit(1);
  if (!launch) notFound();

  const pages = resolvePages(launch.type as LaunchType, launch.pageConfig);
  const pageDef = pages.find((p) => p.pageKey === pageKey);
  if (!pageDef) notFound();

  const [asset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.launchId, launch.id), eq(assets.kind, "landing"), eq(assets.pageKey, pageKey)))
    .orderBy(desc(assets.createdAt))
    .limit(1);

  const body = (asset?.body ?? null) as Record<string, unknown> | null;
  const hasContent = Boolean(asset);
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
          .where(and(eq(assets.launchId, launch.id), eq(assets.kind, "landing"), eq(assets.pageKey, pageKey)))
          .orderBy(desc(assets.createdAt))
      : [];

  const storedInstruction =
    ((launch.assetsCache as Record<string, unknown> | null)?.pageInstructions as
      | Record<string, string>
      | undefined)?.[pageKey] ?? "";

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
              <code className="text-[--color-red-bright]">{publicPath}</code>
              {" · "}
              {hasContent ? "Generada" : "Sin generar"}
              {pageDef.kind === "legal" &&
                " · borrador de IA, revísalo con un asesor antes de publicar"}
              {unlockDate && ` · se abre el ${unlockDate.toLocaleDateString("es")}`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <a
              href={publicPath}
              target="_blank"
              rel="noreferrer"
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition hover:border-[--color-red]"
            >
              Ver esta página ↗
            </a>
          </div>
        </div>

        {/* Regenerating the whole page takes a brief: structure, global copy,
            design. It's remembered per page, so a second pass starts from what
            you asked the first time instead of from nothing. */}
        <form
          action={regenerateSinglePageAction.bind(null, launch.id, pageKey)}
          className="space-y-2 rounded-xl border border-[--color-red]/25 bg-[--color-red]/5 p-4"
        >
          <AiGeneratingOverlay
            messages={[`Escribiendo ${pageDef.label.toLowerCase()}…`, "Ajustando el tono…", "Repasando la estructura…"]}
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
              Opcional. Se guarda para esta página y manda sobre las instrucciones generales
              del lanzamiento.
            </span>
          </label>
          <div className="flex justify-end">
            <SubmitButton variant={hasContent ? "outline" : "primary"} pendingLabel="Generando…">
              {hasContent ? "Regenerar entera" : "Generar con Claude"}
            </SubmitButton>
          </div>
        </form>

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
            {index + 1} de {pages.length} · {LAUNCH_TYPES[launch.type as LaunchType]?.label ?? launch.type}
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

      {!hasContent && (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
          Esta página aún no tiene contenido. Genérala con Claude, o escribe sus partes a mano
          y guarda: se crea igual.
        </p>
      )}

      {pageDef.kind === "venta" ? (
        <>
          <DesignReviewPanel
            review={asset?.designReview}
            launchId={launch.id}
            pageKey={pageKey}
            fixAction={applyDesignFixesAction}
          />
          <LandingEditor
            launchId={launch.id}
            launchSlug={launch.slug}
            body={(asset?.body ?? null) as LandingBody | null}
            versions={versions}
            refineAction={refineLandingSectionAction}
            rawUpdateAction={updateSectionRawAction}
            imageSaveAction={setSectionImageAction}
            designAction={updateSectionDesignAction}
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
