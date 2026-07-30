import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, desc, and } from "drizzle-orm";

import { db } from "@/db";
import { launches, assets, products, users } from "@/db/schema";
import { LAUNCH_TYPES, type LaunchType } from "@/lib/launch-types";
import { isActiveCampaignConfigured } from "@/integrations/activecampaign";
import { requireOrgAdmin } from "@/lib/auth-helpers";

import {
  generateMarcoCopyAction,
  updateMarcoCopyAction,
  generateAllPagesAction,
  regenerateSinglePageAction,
  updatePageBodyAction,
  updateLandingInstructionsAction,
  generateEmailsAction,
  generateAdsAction,
  createStripeProductAction,
  deleteStripeProductAction,
  updateReferenceUrlAction,
  updateCartScheduleAction,
  updateContentDripScheduleAction,
  applyDesignFixesAction,
  provisionActiveCampaignAction,
  pushEmailsToActiveCampaignAction,
  refineLandingSectionAction,
  updateSectionRawAction,
  setSectionImageAction,
  generateBrandKitAction,
  updateBrandKitAction,
  approveBrandKitAction,
  updateBrandLogoAction,
} from "@/server/launches";
import { resolvePages, pagePath } from "@/lib/launch-pages";
import { SimplePageEditor } from "@/components/admin/simple-page-editor";
import { ContentDripForm } from "@/components/admin/content-drip-form";
import { AdsPanel } from "@/components/admin/ads-panel";
import { AdStaticsGenerator } from "@/components/admin/ad-statics-generator";
import type { AdsBody } from "@/components/admin/ads-types";
import { generateAdStaticsAction, deleteAdImageAction, listAdImages, fixAdCopyLengthsAction } from "@/server/ads";
import { listMediaItems } from "@/server/media";

import { WizardStep } from "@/components/admin/wizard-step";
import { SubmitButton } from "@/components/admin/submit-button";
import { AiGeneratingOverlay } from "@/components/admin/ai-generating-overlay";
import { MarcoCopyEditor } from "@/components/admin/marco-copy-editor";
import { LandingEditor } from "@/components/admin/landing-editor";
import { EmailSequence } from "@/components/admin/email-sequence";
import { StripeProductForm } from "@/components/admin/stripe-product-form";
import { ActiveCampaignPanel } from "@/components/admin/activecampaign-panel";
import { DomainPanel } from "@/components/admin/domain-panel";
import { BrandKitPanel } from "@/components/admin/brand-kit-panel";
import { LandingInstructionsForm } from "@/components/admin/landing-instructions-form";
import { ReferenceUrlForm } from "@/components/admin/reference-url-form";
import { CartScheduleForm } from "@/components/admin/cart-schedule-form";
import { DesignReviewPanel } from "@/components/admin/design-review-panel";
import type { LandingBody } from "@/components/public/landing-types";
import { listDomainsForLaunch, addDomainAction, verifyDomainAction, removeDomainAction } from "@/server/domains";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function LaunchHubPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const { organizationId } = await requireOrgAdmin();
  const [launch] = await db
    .select()
    .from(launches)
    .where(and(eq(launches.slug, slug), eq(launches.organizationId, organizationId)))
    .limit(1);
  if (!launch) notFound();

  const meta = LAUNCH_TYPES[launch.type as LaunchType];
  const pages = resolvePages(launch.type as LaunchType, launch.pageConfig);
  const ventaPage = pages.find((p) => p.kind === "venta") ?? pages[0];

  // Every "landing"-kind asset for this launch, across all its pages — used
  // both for the venta page's version history and to know which other pages
  // already have content.
  const allLandingAssets = await db
    .select()
    .from(assets)
    .where(and(eq(assets.launchId, launch.id), eq(assets.kind, "landing")))
    .orderBy(desc(assets.createdAt));

  const latestByPageKey = new Map<string, (typeof allLandingAssets)[number]>();
  for (const a of allLandingAssets) {
    if (!latestByPageKey.has(a.pageKey)) latestByPageKey.set(a.pageKey, a);
  }

  // Load all landing versions with author info (no body to keep it light) —
  // scoped to the venta page specifically.
  const landingVersions = await db
    .select({
      id: assets.id,
      createdAt: assets.createdAt,
      generatedByAi: assets.generatedByAi,
      authorEmail: users.email,
      authorName: users.name,
    })
    .from(assets)
    .leftJoin(users, eq(assets.authorId, users.id))
    .where(and(eq(assets.launchId, launch.id), eq(assets.kind, "landing"), eq(assets.pageKey, ventaPage.pageKey)))
    .orderBy(desc(assets.createdAt));

  const landingAsset = latestByPageKey.get(ventaPage.pageKey) ?? null;

  const [emailAsset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.launchId, launch.id), eq(assets.kind, "email")))
    .orderBy(desc(assets.createdAt))
    .limit(1);

  const [adsAsset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.launchId, launch.id), eq(assets.kind, "ad_copy")))
    .orderBy(desc(assets.createdAt))
    .limit(1);

  const launchProducts = await db
    .select()
    .from(products)
    .where(and(eq(products.launchId, launch.id), eq(products.active, true)))
    .orderBy(products.createdAt);
  const [product] = launchProducts;

  const [mediaItems, adImages] = await Promise.all([listMediaItems(), listAdImages(launch.id)]);

  const hasMarco = Boolean(launch.promise);
  const brandKitApproved = launch.brandKitStatus === "approved";
  const hasLanding = Boolean(landingAsset);
  const hasEmails = Boolean(emailAsset);
  const hasProduct = Boolean(product);
  const hasAc = Boolean(launch.activeCampaignListId);
  const launchDomains = await listDomainsForLaunch(launch.id);
  const hasActiveDomain = launchDomains.some((d) => d.status === "active");
  const acConfigured = await isActiveCampaignConfigured(organizationId);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin"
            className="text-xs uppercase tracking-widest text-zinc-500 hover:text-zinc-300"
          >
            ← Panel
          </Link>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-3xl font-bold md:text-4xl">
            {launch.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {meta?.label ?? launch.type} · slug{" "}
            <code className="text-[--color-red-bright]">/{launch.slug}</code> ·{" "}
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-widest">
              {launch.status}
            </span>
          </p>
        </div>
        <Link
          href={`/${launch.slug}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition hover:border-[--color-red]"
        >
          Ver landing pública ↗
        </Link>
      </header>

      {/* Step 1 — Identidad visual (brand kit) */}
      <WizardStep
        index={1}
        title="Identidad visual"
        subtitle="Paleta, tipografía, logo y mood — obligatorio antes de generar la landing."
        status={brandKitApproved ? "ready" : launch.brandKitStatus === "draft" ? "pending" : "empty"}
      >
        <BrandKitPanel
          launchId={launch.id}
          status={launch.brandKitStatus}
          palette={launch.brandPalette}
          fonts={launch.brandFonts}
          moodNotes={launch.brandMoodNotes}
          moodImageUrl={launch.brandMoodImageUrl}
          logoUrl={launch.brandLogoUrl}
          generateAction={generateBrandKitAction}
          updateAction={updateBrandKitAction}
          approveAction={approveBrandKitAction}
          logoSaveAction={updateBrandLogoAction.bind(null, launch.id)}
        />
      </WizardStep>

      {/* Step 2 — Marco copy */}
      <WizardStep
        index={2}
        title="Marco de copy"
        subtitle="Avatar, promesa, dolores y beneficios desde el brief inicial."
        status={hasMarco ? "ready" : "empty"}
        action={
          <form action={generateMarcoCopyAction.bind(null, launch.id)}>
            <AiGeneratingOverlay
              messages={["Leyendo el brief…", "Perfilando al avatar…", "Encontrando los dolores reales…", "Escribiendo la promesa…"]}
            />
            <SubmitButton variant={hasMarco ? "outline" : "primary"} pendingLabel="Generando…">
              {hasMarco ? "Regenerar con Claude" : "Generar con Claude"}
            </SubmitButton>
          </form>
        }
      >
        <MarcoCopyEditor
          launchId={launch.id}
          avatar={launch.avatar}
          promise={launch.promise}
          painPoints={launch.painPoints ?? []}
          benefits={launch.benefits ?? []}
          updateAction={updateMarcoCopyAction.bind(null, launch.id)}
        />
      </WizardStep>

      {/* Step 3 — Páginas */}
      <WizardStep
        index={3}
        title="Páginas"
        subtitle={`${pages.length} página${pages.length === 1 ? "" : "s"} para este lanzamiento (${meta?.label ?? launch.type}).`}
        status={!hasMarco || !brandKitApproved ? "needs-prev" : hasLanding ? "ready" : "empty"}
        action={
          <form action={generateAllPagesAction.bind(null, launch.id)}>
            <AiGeneratingOverlay
              messages={["Construyendo cada página…", "Encadenando dolor → solución…", "Escribiendo legales y contenido…", "Puliendo los CTA finales…"]}
            />
            <SubmitButton
              variant={hasLanding ? "outline" : "primary"}
              pendingLabel="Generando todas…"
              disabled={!hasMarco || !brandKitApproved}
            >
              {hasLanding ? "Regenerar todas las páginas" : "Generar todas las páginas"}
            </SubmitButton>
          </form>
        }
      >
        {!brandKitApproved && (
          <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
            Aprueba primero la identidad visual (paso 1) para poder generar las páginas.
          </p>
        )}

        {pages.some((p) => p.kind === "contenido") && (
          <ContentDripForm
            launchId={launch.id}
            currentStartsAt={launch.contentDripStartsAt}
            contentPageCount={pages.filter((p) => p.kind === "contenido").length}
            saveAction={updateContentDripScheduleAction}
          />
        )}

        {pages.length > 1 && (
          <div className="mb-6 space-y-2">
            <div className="text-xs uppercase tracking-widest text-zinc-400">Otras páginas</div>
            {pages
              .filter((p) => p.pageKey !== ventaPage.pageKey)
              .map((p) => (
                <SimplePageEditor
                  key={p.pageKey}
                  launchId={launch.id}
                  pageKey={p.pageKey}
                  label={p.label}
                  kind={p.kind}
                  href={pagePath(launch.slug, p)}
                  hasContent={latestByPageKey.has(p.pageKey)}
                  body={(latestByPageKey.get(p.pageKey)?.body as Record<string, unknown>) ?? null}
                  regenerateAction={regenerateSinglePageAction}
                  updateAction={updatePageBodyAction}
                />
              ))}
          </div>
        )}

        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs uppercase tracking-widest text-zinc-400">
            {ventaPage.label} — edición detallada
          </div>
          <Link
            href={pagePath(launch.slug, ventaPage)}
            target="_blank"
            rel="noreferrer"
            className="rounded-md border border-white/20 bg-white/[0.08] px-3 py-1.5 text-xs uppercase tracking-widest text-zinc-100 transition hover:border-[--color-red] hover:bg-white/15"
          >
            Ver {ventaPage.label.toLowerCase()} ↗
          </Link>
        </div>
        <DesignReviewPanel
          review={landingAsset?.designReview}
          launchId={launch.id}
          pageKey={ventaPage.pageKey}
          fixAction={applyDesignFixesAction}
        />
        <ReferenceUrlForm
          launchId={launch.id}
          currentUrl={launch.referenceUrl}
          saveAction={updateReferenceUrlAction}
        />
        <CartScheduleForm
          launchId={launch.id}
          currentCartClosesAt={launch.cartClosesAt}
          saveAction={updateCartScheduleAction}
        />
        <LandingInstructionsForm
          launchId={launch.id}
          currentInstructions={launch.landingGeneralInstructions}
          saveAction={updateLandingInstructionsAction}
        />
        <LandingEditor
          launchId={launch.id}
          launchSlug={launch.slug}
          body={(landingAsset?.body ?? null) as LandingBody | null}
          versions={landingVersions}
          refineAction={refineLandingSectionAction}
          rawUpdateAction={updateSectionRawAction}
          imageSaveAction={setSectionImageAction}
        />
      </WizardStep>

      {/* Step 4 — Emails */}
      <WizardStep
        index={4}
        title="Secuencia de emails"
        subtitle={`Plan específico para tipo ${meta?.label ?? launch.type}.`}
        status={!hasMarco ? "needs-prev" : hasEmails ? "ready" : "empty"}
        action={
          <form action={generateEmailsAction.bind(null, launch.id)}>
            <AiGeneratingOverlay
              messages={["Planificando la secuencia…", "Escribiendo asuntos…", "Ajustando el ritmo de envío…"]}
            />
            <SubmitButton
              variant={hasEmails ? "outline" : "primary"}
              pendingLabel="Generando emails…"
              disabled={!hasMarco}
            >
              {hasEmails ? "Regenerar emails" : "Generar emails"}
            </SubmitButton>
          </form>
        }
      >
        <EmailSequence body={(emailAsset?.body ?? null) as Parameters<typeof EmailSequence>[0]["body"]} />
      </WizardStep>

      {/* Step 5 — Anuncios */}
      <WizardStep
        index={5}
        title="Anuncios Meta + Google"
        subtitle="Copy con los límites de cada plataforma + estáticos compuestos sobre tus fotos."
        status={!hasMarco ? "needs-prev" : adsAsset ? "ready" : "empty"}
        action={
          <form action={generateAdsAction.bind(null, launch.id)}>
            <AiGeneratingOverlay
              messages={["Guionizando el UGC…", "Escribiendo hooks…", "Pensando los conceptos de estático…"]}
            />
            <SubmitButton
              variant={adsAsset ? "outline" : "primary"}
              pendingLabel="Generando anuncios…"
              disabled={!hasMarco}
            >
              {adsAsset ? "Regenerar anuncios" : "Generar anuncios"}
            </SubmitButton>
          </form>
        }
      >
        <div className="space-y-6">
          <AdsPanel
            body={(adsAsset?.body ?? null) as AdsBody | null}
            launchId={launch.id}
            fixLengthsAction={fixAdCopyLengthsAction}
          />

          {adsAsset && (
            <div>
              <div className="mb-2 text-xs uppercase tracking-widest text-zinc-400">
                Componer estáticos con tus fotos
              </div>
              <AdStaticsGenerator
                launchId={launch.id}
                concepts={((adsAsset.body as AdsBody).statics ?? [])}
                mediaItems={mediaItems}
                adImages={adImages}
                generateAction={generateAdStaticsAction}
                deleteAction={deleteAdImageAction}
              />
            </div>
          )}
        </div>
      </WizardStep>

      {/* Step 6 — Producto Stripe */}
      <WizardStep
        index={6}
        title="Producto en Stripe"
        subtitle="Crea el producto y el price ID. La landing pública usará este checkout."
        status={hasProduct ? "ready" : "empty"}
      >
        <StripeProductForm
          launchId={launch.id}
          defaultName={launch.name}
          defaultDescription={launch.promise ?? ""}
          defaultPriceCents={launch.defaultPriceCents}
          defaultCurrency={launch.currency ?? "EUR"}
          existingProducts={launchProducts}
          action={createStripeProductAction}
          deleteAction={deleteStripeProductAction}
        />
      </WizardStep>

      {/* Step 7 — ActiveCampaign */}
      <WizardStep
        index={7}
        title="ActiveCampaign"
        subtitle="Crea lista + tags para este lanzamiento y sube los emails como plantillas."
        status={!acConfigured ? "needs-prev" : hasAc ? "ready" : "empty"}
      >
        <ActiveCampaignPanel
          launchId={launch.id}
          launchSlug={launch.slug}
          configured={acConfigured}
          listId={launch.activeCampaignListId ?? null}
          tagIds={(launch.activeCampaignTagIds ?? {}) as Record<string, number>}
          hasEmails={hasEmails}
          emailAssetId={emailAsset?.id ?? null}
          provisionAction={provisionActiveCampaignAction}
          pushEmailsAction={pushEmailsToActiveCampaignAction}
        />
      </WizardStep>

      {/* Step 8 — Dominio propio */}
      <WizardStep
        index={8}
        title="Dominio propio"
        subtitle="Conecta el dominio o subdominio del cliente para servir esta landing directamente."
        status={hasActiveDomain ? "ready" : "empty"}
      >
        <DomainPanel
          launchId={launch.id}
          launchSlug={launch.slug}
          domains={launchDomains}
          appHostname={new URL(env.APP_URL).hostname}
          serverIpv4={env.SERVER_IPV4}
          addAction={addDomainAction}
          verifyAction={verifyDomainAction}
          removeAction={removeDomainAction}
        />
      </WizardStep>
    </div>
  );
}
