import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, desc, and, count } from "drizzle-orm";

import { db } from "@/db";
import { launches, assets, products, trackingEvents, milestones, users } from "@/db/schema";
import { LAUNCH_TYPES, type LaunchType } from "@/lib/launch-types";
import { isActiveCampaignConfigured } from "@/integrations/activecampaign";
import { isTelegramConfigured, getMe as getTelegramBot } from "@/integrations/telegram";
import { organizations } from "@/db/schema/organizations";
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
  scheduleAcCampaignsAction,
  refineLandingSectionAction,
  updateSectionRawAction,
  setSectionImageAction,
  connectTelegramGroupAction,
  disconnectTelegramGroupAction,
  sendTelegramTestAction,
  discoverTelegramGroupsAction,
  generateTelegramMessagesAction,
  sendTelegramAssetMessageAction,
  triggerTelegramCartAction,
  editTelegramMessageAction,
  refineTelegramMessageAction,
  updateLaunchCountryAction,
  generateMilestonesAction,
  updateMilestoneAction,
  analyzeCalendarAction,
  updateSectionDesignAction,
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
import { LaunchTabs, type LaunchTab } from "@/components/admin/launch-tabs";
import { SubmitButton } from "@/components/admin/submit-button";
import { AiGeneratingOverlay } from "@/components/admin/ai-generating-overlay";
import { MarcoCopyEditor } from "@/components/admin/marco-copy-editor";
import { LandingEditor } from "@/components/admin/landing-editor";
import { EmailSequence } from "@/components/admin/email-sequence";
import { StripeProductForm } from "@/components/admin/stripe-product-form";
import { ActiveCampaignPanel } from "@/components/admin/activecampaign-panel";
import { TelegramPanel } from "@/components/admin/telegram-panel";
import { CalendarPanel } from "@/components/admin/calendar-panel";
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

/** Group separator, shown only in the "Todo" view — with every step on one page
 *  the group boundaries are what carry the order. */
function GroupHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-2">
      <h2 className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.25em] text-zinc-500">
        {children}
      </h2>
      <div className="h-px flex-1 bg-white/10" />
    </div>
  );
}

/** Section ids used in `?seccion=` — see LaunchTabs. "todo" shows every step
 *  at once and is the default: grouping gave the hub an order, but defaulting to
 *  a single group hid the other six steps behind a tab you had to know about. */
const SECTIONS = ["todo", "marca", "paginas", "campana", "conexiones", "registros"] as const;
type SectionId = (typeof SECTIONS)[number];

export default async function LaunchHubPage(props: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ seccion?: string }>;
}) {
  const { slug } = await props.params;
  const { seccion } = await props.searchParams;
  const { organizationId } = await requireOrgAdmin();
  if (!organizationId) throw new Error("no_organization");
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

  const [org] = await db
    .select({ telegramBotToken: organizations.telegramBotToken })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  const orgBotToken = org?.telegramBotToken ?? null;
  const telegramConfigured = isTelegramConfigured(orgBotToken);

  const [telegramAsset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.launchId, launch.id), eq(assets.kind, "telegram_message")))
    .orderBy(desc(assets.createdAt))
    .limit(1);

  // Milestones for calendar
  const launchMilestones = await db
    .select()
    .from(milestones)
    .where(eq(milestones.launchId, launch.id))
    .orderBy(milestones.sortOrder);

  let botUsername: string | null = null;
  if (telegramConfigured) {
    try {
      const bot = await getTelegramBot(orgBotToken);
      botUsername = bot.username;
    } catch { /* token might be invalid */ }
  }

  // Event stats + recent events
  const eventStats = await db
    .select({
      type: trackingEvents.type,
      total: count(),
    })
    .from(trackingEvents)
    .where(eq(trackingEvents.launchId, launch.id))
    .groupBy(trackingEvents.type);

  const statsMap: Record<string, number> = {};
  for (const s of eventStats) {
    statsMap[s.type] = s.total;
  }

  const recentEvents = await db
    .select({
      id: trackingEvents.id,
      type: trackingEvents.type,
      email: trackingEvents.email,
      name: trackingEvents.name,
      occurredAt: trackingEvents.occurredAt,
      utmSource: trackingEvents.utmSource,
      country: trackingEvents.country,
      amountCents: trackingEvents.amountCents,
      currency: trackingEvents.currency,
    })
    .from(trackingEvents)
    .where(eq(trackingEvents.launchId, launch.id))
    .orderBy(desc(trackingEvents.occurredAt))
    .limit(50);

  const hasMarco = Boolean(launch.promise);
  const brandKitApproved = launch.brandKitStatus === "approved";
  const hasLanding = Boolean(landingAsset);
  const hasEmails = Boolean(emailAsset);
  const hasProduct = Boolean(product);
  const hasAc = Boolean(launch.activeCampaignListId);
  const hasTelegram = Boolean(launch.telegramChatId);
  const hasMilestones = launchMilestones.length > 0;
  const launchDomains = await listDomainsForLaunch(launch.id);
  const hasActiveDomain = launchDomains.some((d) => d.status === "active");
  const acConfigured = await isActiveCampaignConfigured(organizationId);

  const basePath = `/admin/lanzamientos/${launch.slug}`;
  // Groups have to follow the order the steps appear in the page, so the
  // calendar sits with brand and copy (all three are launch groundwork) and
  // Telegram with the other integrations.
  const done = {
    marca: [brandKitApproved, hasMarco, hasMilestones].filter(Boolean).length,
    paginas: hasLanding ? 1 : 0,
    campana: [hasEmails, Boolean(adsAsset)].filter(Boolean).length,
    conexiones: [hasProduct, hasAc, hasActiveDomain, hasTelegram].filter(Boolean).length,
  };
  const tabs: LaunchTab[] = [
    {
      id: "todo",
      label: "Todo",
      done: done.marca + done.paginas + done.campana + done.conexiones,
      total: 10,
    },
    { id: "marca", label: "Marca, copy y fechas", done: done.marca, total: 3 },
    {
      id: "paginas",
      label: "Páginas",
      done: done.paginas,
      total: 1,
      blocked: !hasMarco || !brandKitApproved,
    },
    { id: "campana", label: "Campaña", done: done.campana, total: 2, blocked: !hasMarco },
    { id: "conexiones", label: "Conexiones", done: done.conexiones, total: 4 },
    // Read-only: there is nothing to complete, so it shows no counter.
    { id: "registros", label: "Registros", done: 0, total: 0 },
  ];


  const requested = SECTIONS.find((s) => s === seccion);
  const active: SectionId = requested ?? "todo";

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

      <LaunchTabs tabs={tabs} active={active} basePath={basePath} />

      {(active === "todo" || active === "marca") && (
      <>
      {active === "todo" && <GroupHeading>Marca y copy</GroupHeading>}
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
          avatar={launch.avatar}
          promise={launch.promise}
          painPoints={launch.painPoints ?? []}
          benefits={launch.benefits ?? []}
          updateAction={updateMarcoCopyAction.bind(null, launch.id)}
        />
      </WizardStep>

      {/* Step 2.5 — Calendario */}
      <WizardStep
        index={2.5}
        title="Calendario"
        subtitle="Define fechas del lanzamiento, pais objetivo y analiza conflictos con IA."
        status={hasMilestones ? "ready" : "empty"}
      >
        <CalendarPanel
          launchId={launch.id}
          launchSlug={launch.slug}
          launchType={launch.type}
          primaryCountry={launch.primaryCountry ?? null}
          targetRegions={(launch.targetRegions as string[]) ?? []}
          anchorDate={launch.anchorDate ? launch.anchorDate.toISOString().split("T")[0]! : null}
          milestones={launchMilestones.map((m) => ({
            id: m.id,
            phase: m.phase,
            label: m.label,
            startsAt: m.startsAt.toISOString().split("T")[0]!,
            endsAt: m.endsAt.toISOString().split("T")[0]!,
            sortOrder: m.sortOrder,
            aiWarnings: (m.aiWarnings ?? []) as Array<{ date: string; severity: "info" | "warning" | "critical"; message: string; country?: string }>,
          }))}
          updateCountryAction={updateLaunchCountryAction}
          generateMilestonesAction={generateMilestonesAction}
          updateMilestoneAction={updateMilestoneAction}
          analyzeCalendarAction={analyzeCalendarAction}
          savedAnalysis={((launch.assetsCache as Record<string, unknown>)?.calendarAnalysis as { summary: string; score: number; warnings: Array<{ date: string; severity: "info" | "warning" | "critical"; message: string; country?: string }>; suggestions: string[] }) ?? null}
        />
      </WizardStep>

      </>
      )}

      {(active === "todo" || active === "paginas") && (
      <>
      {active === "todo" && <GroupHeading>Páginas</GroupHeading>}
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
          designAction={updateSectionDesignAction}
        />
      </WizardStep>

      </>
      )}

      {(active === "todo" || active === "campana") && (
      <>
      {active === "todo" && <GroupHeading>Campaña</GroupHeading>}
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

      </>
      )}

      {(active === "todo" || active === "conexiones") && (
      <>
      {active === "todo" && <GroupHeading>Conexiones</GroupHeading>}
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
        subtitle="Crea lista + tags, sube plantillas y programa campanas automaticamente."
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
          hasTemplates={Boolean((launch.assetsCache as Record<string, unknown>)?.acTemplateIds)}
          hasCampaigns={Boolean((launch.assetsCache as Record<string, unknown>)?.acCampaignIds)}
          hasMilestones={hasMilestones}
          provisionAction={provisionActiveCampaignAction}
          pushEmailsAction={pushEmailsToActiveCampaignAction}
          scheduleCampaignsAction={scheduleAcCampaignsAction}
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

      {/* Step 9 — Telegram */}
      <WizardStep
        index={9}
        title="Telegram"
        subtitle="Conecta un grupo o canal de Telegram para enviar comunicaciones del lanzamiento."
        status={!telegramConfigured ? "needs-prev" : hasTelegram ? "ready" : "empty"}
        action={
          hasTelegram && hasMarco ? (
            <form action={generateTelegramMessagesAction.bind(null, launch.id)}>
              <SubmitButton
                variant={telegramAsset ? "outline" : "primary"}
                pendingLabel="Generando…"
              >
                {telegramAsset ? "Regenerar mensajes" : "Generar mensajes con Claude"}
              </SubmitButton>
            </form>
          ) : undefined
        }
      >
        <TelegramPanel
          launchId={launch.id}
          launchSlug={launch.slug}
          configured={telegramConfigured}
          chatId={launch.telegramChatId ?? null}
          inviteLink={launch.telegramInviteLink ?? null}
          botAdded={launch.telegramBotAdded}
          botUsername={botUsername}
          launchName={launch.name}
          messages={(telegramAsset?.body as { messages: Array<{ title: string; body: string; timing: string; triggerEvent: string }> } | null)?.messages ?? null}
          connectAction={connectTelegramGroupAction}
          disconnectAction={disconnectTelegramGroupAction}
          testAction={sendTelegramTestAction}
          discoverAction={discoverTelegramGroupsAction}
          sendMessageAction={sendTelegramAssetMessageAction}
          triggerCartAction={triggerTelegramCartAction}
          editMessageAction={editTelegramMessageAction}
          refineMessageAction={refineTelegramMessageAction}
        />
      </WizardStep>

      </>
      )}

      {(active === "todo" || active === "registros") && (
      <>
      {active === "todo" && <GroupHeading>Registros</GroupHeading>}
      {/* Step 10 — Registros */}
      <WizardStep
        index={10}
        title="Registros"
        subtitle="Leads, ventas y eventos registrados en este lanzamiento."
        status={recentEvents.length > 0 ? "ready" : "empty"}
      >
        {/* Counters */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { label: "Visitas", key: "visit", color: "text-zinc-300" },
            { label: "Leads", key: "lead", color: "text-blue-300" },
            { label: "Ventas", key: "sale", color: "text-emerald-300" },
            { label: "Seminarios", key: "seminar", color: "text-amber-300" },
          ].map(({ label, key, color }) => (
            <div key={key} className="rounded-lg border border-white/5 bg-black/30 p-4 text-center">
              <div className={`text-2xl font-bold ${color}`}>{statsMap[key] ?? 0}</div>
              <div className="mt-1 text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
            </div>
          ))}
        </div>

        {/* Recent events table */}
        {recentEvents.length > 0 ? (
          <div className="mt-4 overflow-x-auto rounded-lg border border-white/5">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/5 bg-black/40 text-[10px] uppercase tracking-widest text-zinc-500">
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Nombre</th>
                  <th className="px-3 py-2">Fuente</th>
                  <th className="px-3 py-2">Pais</th>
                  <th className="px-3 py-2">Monto</th>
                  <th className="px-3 py-2">Fecha</th>
                </tr>
              </thead>
              <tbody>
                {recentEvents.map((ev) => (
                  <tr key={ev.id} className="border-b border-white/[0.03] hover:bg-white/[0.02]">
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                        ev.type === "lead" ? "bg-blue-500/10 text-blue-300" :
                        ev.type === "sale" ? "bg-emerald-500/10 text-emerald-300" :
                        ev.type === "visit" ? "bg-zinc-800 text-zinc-400" :
                        "bg-amber-500/10 text-amber-300"
                      }`}>
                        {ev.type}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-zinc-300">{ev.email ?? "—"}</td>
                    <td className="px-3 py-2 text-zinc-400">{ev.name ?? "—"}</td>
                    <td className="px-3 py-2 text-zinc-500">{ev.utmSource ?? "directo"}</td>
                    <td className="px-3 py-2 text-zinc-500">{ev.country ?? "—"}</td>
                    <td className="px-3 py-2 text-zinc-300">
                      {ev.amountCents ? `${(ev.amountCents / 100).toFixed(2)} ${ev.currency ?? ""}` : "—"}
                    </td>
                    <td className="px-3 py-2 text-zinc-500">
                      {ev.occurredAt.toLocaleDateString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-zinc-500">Aun no hay eventos registrados para este lanzamiento.</p>
        )}
      </WizardStep>
      </>
      )}
    </div>
  );
}
