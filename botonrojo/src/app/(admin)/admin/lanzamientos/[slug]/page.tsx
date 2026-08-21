import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, desc, and, count } from "drizzle-orm";

import { db } from "@/db";
import {
  launches,
  assets,
  products,
  trackingEvents,
  milestones,
  users,
} from "@/db/schema";
import { LAUNCH_TYPES, type LaunchType } from "@/lib/launch-types";
import { isActiveCampaignConfigured } from "@/integrations/activecampaign";
import {
  getMe as getTelegramBot,
  getTelegramToken,
} from "@/integrations/telegram";
import { requireOrgAdmin } from "@/lib/auth-helpers";

import {
  generateMarcoCopyAction,
  updateMarcoCopyAction,
  generateAllPagesAction,
  regenerateSinglePageAction,
  updateLandingInstructionsAction,
  updateBriefAction,
  updatePricingPlanAction,
  pushDesignedEmailToAcAction,
  generateEmailsAction,
  refineEmailAction,
  updateEmailAction,
  approveEmailAction,
  approveAllEmailsAction,
  generateAdsAction,
  createStripeProductAction,
  deleteStripeProductAction,
  updateReferenceUrlAction,
  updateCartScheduleAction,
  updateContentDripScheduleAction,
  provisionActiveCampaignAction,
  pushEmailsToActiveCampaignAction,
  scheduleAcCampaignsAction,
  updateEmailOffsetAction,
  fetchAcAutomationsAction,
  linkAcAutomationAction,
  unlinkAcAutomationAction,
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
  generateBrandKitAction,
  updateBrandKitAction,
  approveBrandKitAction,
  updateBrandLogoAction,
  archiveLaunchAction,
  deleteLaunchAction,
  launchCanBeDeleted,
} from "@/server/launches";
import { resolvePages, pagePath } from "@/lib/launch-pages";
import { ContentDripForm } from "@/components/admin/content-drip-form";
import { AdsPanel } from "@/components/admin/ads-panel";
import { AdStaticsGenerator } from "@/components/admin/ad-statics-generator";
import type { AdsBody } from "@/components/admin/ads-types";
import {
  generateAdStaticsAction,
  deleteAdImageAction,
  listAdImages,
  fixAdCopyLengthsAction,
} from "@/server/ads";
import {
  listMediaItems,
  generateMediaItemAction,
  deleteMediaItemAction,
  updateMediaLabelAction,
} from "@/server/media";
import { MediaLibraryPanel } from "@/components/admin/media-library-panel";
import { isImageGenConfigured } from "@/integrations/image-gen";

import { WizardStep } from "@/components/admin/wizard-step";
import { LaunchTabs, type LaunchTab } from "@/components/admin/launch-tabs";
import { PageIndex } from "@/components/admin/page-index";
import { GenerationProgress } from "@/components/admin/generation-progress";
import { SubmitButton } from "@/components/admin/submit-button";
import { AiGeneratingOverlay } from "@/components/admin/ai-generating-overlay";
import { MarcoCopyEditor } from "@/components/admin/marco-copy-editor";
import { EmailEditor } from "@/components/admin/email-editor";
import { StripeProductForm } from "@/components/admin/stripe-product-form";
import { PricingPlanForm } from "@/components/admin/pricing-plan-form";
import { ActiveCampaignPanel } from "@/components/admin/activecampaign-panel";
import { CampaignCalendar } from "@/components/admin/campaign-calendar";
import { AcAutomationsPanel } from "@/components/admin/ac-automations-panel";
import { TelegramPanel } from "@/components/admin/telegram-panel";
import { CalendarPanel } from "@/components/admin/calendar-panel";
import { DomainPanel } from "@/components/admin/domain-panel";
import { BrandKitPanel } from "@/components/admin/brand-kit-panel";
import { BriefForm } from "@/components/admin/brief-form";
import { LandingInstructionsForm } from "@/components/admin/landing-instructions-form";
import { ReferenceUrlForm } from "@/components/admin/reference-url-form";
import { CartScheduleForm } from "@/components/admin/cart-schedule-form";
import {
  listDomainsForLaunch,
  addDomainAction,
  verifyDomainAction,
  removeDomainAction,
} from "@/server/domains";
import { env } from "@/lib/env";
import { isCustomPageBody } from "@/lib/custom-page";
import { hasActiveConnector } from "@/mcp/auth";
import { ClaudeButton } from "@/components/admin/claude-button";
import { ClaudeGoButton } from "@/components/admin/claude-go-button";
import {
  CLAUDE_DESIGN_URL,
  claudeNewPageUrl,
  claudeQueuePrompt,
  claudeCampaignsPrompt,
  claudeAdsPrompt,
} from "@/lib/claude-link";
import { ClaudeQueue } from "@/components/admin/claude-queue";
import { ProximosPasos, type Paso } from "@/components/admin/proximos-pasos";
import { LaunchDangerZone } from "@/components/admin/launch-danger-zone";
import { DesignedCampaigns } from "@/components/admin/designed-campaigns";
import { isCustomEmailBody, type CustomEmailBody } from "@/lib/custom-email";
import { listLaunchTasks } from "@/server/launch-tasks";

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
const SECTIONS = ["todo", "marca", "paginas", "campana", "conexiones"] as const;
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
    .where(
      and(eq(launches.slug, slug), eq(launches.organizationId, organizationId)),
    )
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

  const [mediaItems, adImages] = await Promise.all([
    listMediaItems(launch.id),
    listAdImages(launch.id),
  ]);

  const orgBotToken = await getTelegramToken(organizationId);
  const telegramConfigured = Boolean(orgBotToken);

  const [telegramAsset] = await db
    .select()
    .from(assets)
    .where(
      and(eq(assets.launchId, launch.id), eq(assets.kind, "telegram_message")),
    )
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
    } catch {
      /* token might be invalid */
    }
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
  const connector = await hasActiveConnector(organizationId);
  /**
   * Una newsletter no vende ni tiene fecha: funciona en evergreen. Así que el
   * calendario, el producto de Stripe y las fechas de cierre no son pasos que estén
   * "pendientes" — es que no existen para este tipo, y dejarlos ahí en gris sería
   * prometer un trabajo que nadie tiene que hacer.
   */
  const esEvergreen = launch.type === "newsletter";
  // Las diseñadas en Claude son varios assets de tipo email; la secuencia generada
  // es uno solo con todos dentro. Se distinguen por la forma del cuerpo.
  const emailAssets = await db
    .select()
    .from(assets)
    .where(and(eq(assets.launchId, launch.id), eq(assets.kind, "email")))
    .orderBy(desc(assets.createdAt));

  const designedCampaigns = emailAssets
    .filter((row) => isCustomEmailBody(row.body))
    .map((row) => {
      const body = row.body as unknown as CustomEmailBody;
      return {
        id: row.id,
        name: body.name,
        subject: body.subject,
        preheader: body.preheader ?? null,
        publishedAt: body.publishedAt ?? null,
        acTemplateId: body.acTemplateId ?? null,
        designUrl: body.designUrl ?? null,
      };
    });

  const queue =
    launch.designMode === "claude"
      ? await listLaunchTasks(launch.id, organizationId)
      : [];
  // Everything downstream reads the brief, so its absence is worth naming once.
  const hasBrief = Boolean(launch.brief && launch.brief.trim().length >= 20);
  const brandKitApproved = launch.brandKitStatus === "approved";
  const hasLanding = Boolean(landingAsset);
  const hasEmails = Boolean(emailAsset);
  const hasProduct = Boolean(product);
  const hasAc = Boolean(launch.activeCampaignListId);
  const hasTelegram = Boolean(launch.telegramChatId);
  const hasMilestones = launchMilestones.length > 0;
  const launchDomains = await listDomainsForLaunch(launch.id);
  const hasActiveDomain = launchDomains.some((d) => d.status === "active");
  // Con uno conectado, las páginas se enseñan y se abren por él: es su dirección
  // de verdad. El primero por fecha si hubiera varios — el panel de dominios ya
  // deja ver y quitar los demás.
  const domainHostname =
    launchDomains.find((d) => d.status === "active")?.hostname ?? null;
  const acConfigured = await isActiveCampaignConfigured(organizationId);
  const acAutomations = acConfigured
    ? await fetchAcAutomationsAction(launch.id).catch(() => [])
    : [];
  const acLinkedAutomationIds =
    ((launch.assetsCache as Record<string, unknown>)
      ?.acLinkedAutomationIds as string[]) ?? [];

  // El proyecto de Claude Design de este lanzamiento, si Claude lo mandó al
  // guardar la identidad o al publicar. Con él, todos los botones que abren
  // Claude llevan al proyecto donde está el trabajo en vez de a una pantalla en
  // blanco donde hay que empezar otra vez.
  const claudeProjectUrl =
    ((launch.assetsCache as Record<string, unknown> | null)
      ?.claudeProjectUrl as string | undefined) ?? null;
  const claudeHref = claudeProjectUrl ?? CLAUDE_DESIGN_URL;

  const borrado = await launchCanBeDeleted(launch.id);

  const basePath = `/admin/lanzamientos/${launch.slug}`;
  // Groups have to follow the order the steps appear in the page, so the
  // calendar sits with brand and copy (all three are launch groundwork) and
  // Telegram with the other integrations.
  // Los pasos de cada grupo, no un número escrito a mano: en una newsletter no hay
  // calendario ni producto de pago, y esos dos pasos ni se enseñan. Contarlos de
  // todas formas dejaba la barra pidiendo para siempre dos cosas que no existen —
  // "2 de 3" sin un tercero al que ir.
  const pasosPorGrupo = {
    marca: esEvergreen
      ? [brandKitApproved, hasMarco]
      : [brandKitApproved, hasMarco, hasMilestones],
    paginas: [hasLanding],
    campana: [hasEmails, Boolean(adsAsset)],
    conexiones: esEvergreen
      ? [hasAc, hasActiveDomain, hasTelegram]
      : [hasProduct, hasAc, hasActiveDomain, hasTelegram],
  };
  const hechos = (grupo: boolean[]) => grupo.filter(Boolean).length;
  const todos = Object.values(pasosPorGrupo).flat();

  const tabs: LaunchTab[] = [
    {
      id: "todo",
      label: "Todo",
      done: hechos(todos),
      total: todos.length,
    },
    {
      id: "marca",
      label: esEvergreen ? "Marca y copy" : "Marca, copy y fechas",
      done: hechos(pasosPorGrupo.marca),
      total: pasosPorGrupo.marca.length,
    },
    {
      id: "paginas",
      label: "Páginas",
      done: hechos(pasosPorGrupo.paginas),
      total: pasosPorGrupo.paginas.length,
      blocked: !hasMarco || !brandKitApproved,
    },
    {
      id: "campana",
      label: "Campaña",
      done: hechos(pasosPorGrupo.campana),
      total: pasosPorGrupo.campana.length,
      blocked: !hasMarco,
    },
    {
      id: "conexiones",
      label: "Conexiones",
      done: hechos(pasosPorGrupo.conexiones),
      total: pasosPorGrupo.conexiones.length,
    },
  ];

  // Qué toca ahora, en un lanzamiento normal. Los de Claude ya lo tienen resuelto
  // por la cola de tareas, que dice lo mismo con más detalle.
  const pasos: Paso[] = [
    {
      titulo: "Contar qué vendes",
      queHacer:
        "Escribe el brief: qué es, a quién le sirve y qué lo hace distinto. Con eso se escribe todo lo demás, así que cuanto más concreto, menos tendrás que corregir después.",
      hecho: hasBrief,
      href: `${basePath}?seccion=marca`,
    },
    {
      titulo: "Aprobar la identidad visual",
      queHacer:
        "Genera colores y tipografías y aprueba la que te guste. Hasta que no hay una aprobada, las páginas no se pueden generar.",
      hecho: brandKitApproved,
      href: `${basePath}?seccion=marca`,
    },
    {
      titulo: "Definir la promesa y el avatar",
      queHacer:
        "El marco de copy: a quién le hablas y qué le prometes. Es lo que la IA usa para escribir los titulares de todas las páginas y los correos.",
      hecho: hasMarco,
      href: `${basePath}?seccion=marca`,
    },
    ...(esEvergreen
      ? []
      : [
          {
            titulo: "Poner las fechas",
            queHacer:
              "Marca en el calendario cuándo abre y cierra el carrito. De ahí salen las cuentas atrás de las páginas y el envío de los correos.",
            hecho: hasMilestones,
            href: `${basePath}?seccion=marca`,
          },
        ]),
    {
      titulo: `Generar las ${pages.length} páginas`,
      queHacer:
        "Dale a generar y revisa el resultado. Cada página se puede retocar luego desde la propia página con el modo edición.",
      hecho: hasLanding,
      href: `${basePath}?seccion=paginas`,
    },
    {
      titulo: "Escribir los correos",
      queHacer:
        "La secuencia de la campaña. Se genera entera y luego cambias lo que no te suene a ti.",
      hecho: hasEmails,
      href: `${basePath}?seccion=campana`,
    },
    ...(esEvergreen
      ? []
      : [
          {
            titulo: "Crear el producto de pago",
            queHacer:
              "El producto en Stripe con su precio y sus plazos, si los hay. Sin esto el botón de comprar no lleva a ninguna parte.",
            hecho: hasProduct,
            href: `${basePath}?seccion=conexiones`,
          },
        ]),
    {
      titulo: "Conectar ActiveCampaign",
      queHacer:
        "Elige la lista donde caen los registros. Sin lista, los correos no salen de aquí.",
      hecho: hasAc,
      href: `${basePath}?seccion=conexiones`,
    },
    {
      titulo: "Usar tu propio dominio",
      queHacer:
        "Si quieres que las páginas se vean en tu dominio en vez de en el nuestro, añádelo y verifícalo.",
      hecho: hasActiveDomain,
      href: `${basePath}?seccion=conexiones`,
      opcional: true,
    },
    {
      titulo: "Avisos por Telegram",
      queHacer:
        "Para que te llegue al móvil cada venta y cada registro. No hace falta para lanzar.",
      hecho: hasTelegram,
      href: `${basePath}?seccion=conexiones`,
      opcional: true,
    },
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
            <code className="text-[var(--color-red-bright)]">
              /{launch.slug}
            </code>{" "}
            ·{" "}
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-widest">
              {launch.status}
            </span>
          </p>
        </div>
        {/* No single "view public page" link: a launch has up to nine URLs, so
            each one is opened from the page index instead. */}
        <Link
          href={`/admin/lanzamientos/${launch.slug}?seccion=paginas`}
          className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-zinc-200 transition hover:border-[var(--color-red)]"
        >
          Ver sus {pages.length} páginas →
        </Link>
      </header>

      <LaunchTabs tabs={tabs} active={active} basePath={basePath} />

      {/* La cola de Claude, solo en "Todo" y en "Páginas". Antes salía en las cuatro
          secciones y era lo primero de la pantalla en todas, así que pulsar cualquier
          botón de arriba parecía llevar siempre al mismo sitio: lo que cambiaba
          quedaba debajo del pliegue. */}
      {launch.designMode === "claude" &&
        (active === "todo" || active === "paginas") && (
          <ClaudeQueue
            tasks={queue.map((task) => ({
              id: task.id,
              kind: task.kind,
              pageKey: task.pageKey,
              label: task.label,
              status: task.status,
              result: task.result,
            }))}
            hasConnector={connector}
            queueHref={claudeHref}
            queuePrompt={claudeQueuePrompt({
              launchSlug: launch.slug,
              launchName: launch.name,
            })}
            launchSlug={launch.slug}
            missing={{
              copy: !hasMarco,
              // Con una de las dos basta para que la cuenta atrás tenga a qué
              // contar. En una newsletter, ninguna: es evergreen, no hay cuenta
              // atrás y el campo donde se ponían ya no se enseña — pedirlas
              // mandaba a un sitio que no existe.
              dates:
                !esEvergreen &&
                !launch.cartClosesAt &&
                !launch.registrationClosesAt,
            }}
          />
        )}

      {launch.designMode !== "claude" && active === "todo" && (
        <ProximosPasos pasos={pasos} />
      )}

      {(active === "todo" || active === "marca") && (
        <>
          {active === "todo" && <GroupHeading>Marca y copy</GroupHeading>}

          {/* Step 0 — El brief. Antes solo se escribía al crear el lanzamiento, así
              que uno que llegara sin él no tenía salida: los botones de generar
              lanzaban brief_missing y eso llegaba al cliente como una página de
              error con un digest y nada que hacer. */}
          <WizardStep
            index={0}
            title="Brief"
            subtitle="Qué vendes, a quién y cómo es el lanzamiento. De aquí sale todo lo demás."
            status={hasBrief ? "ready" : "empty"}
          >
            <BriefForm
              launchId={launch.id}
              currentBrief={launch.brief}
              saveAction={updateBriefAction}
            />
          </WizardStep>

          {/* Step 1 — Identidad visual (brand kit) */}
          <WizardStep
            index={1}
            title="Identidad visual"
            subtitle="Paleta, tipografía, logo y mood — obligatorio antes de generar la landing."
            status={
              brandKitApproved
                ? "ready"
                : launch.brandKitStatus === "draft"
                  ? "pending"
                  : "empty"
            }
          >
            {launch.designMode === "claude" && !brandKitApproved ? (
              <p className="rounded-lg border border-emerald-400/25 bg-emerald-400/5 p-4 text-sm text-zinc-300">
                La identidad visual de este lanzamiento la propone Claude: es la
                primera tarea de la cola de arriba. Cuando la guarde, aparecerá
                aquí aprobada y podrás retocarla a mano si hace falta.
              </p>
            ) : (
              <BrandKitPanel
                launchId={launch.id}
                canGenerate={hasBrief}
                status={launch.brandKitStatus}
                palette={launch.brandPalette}
                fonts={launch.brandFonts}
                design={launch.brandDesign}
                moodNotes={launch.brandMoodNotes}
                moodImageUrl={launch.brandMoodImageUrl}
                logoUrl={launch.brandLogoUrl}
                generateAction={generateBrandKitAction}
                updateAction={updateBrandKitAction}
                approveAction={approveBrandKitAction}
                logoSaveAction={updateBrandLogoAction.bind(null, launch.id)}
              />
            )}
          </WizardStep>

          {/* Step 2 — Marco copy */}
          <WizardStep
            index={2}
            title="Marco de copy"
            subtitle="Avatar, promesa, dolores y beneficios desde el brief inicial."
            status={hasMarco ? "ready" : "empty"}
            action={
              <form
                action={generateMarcoCopyAction.bind(null, launch.id)}
                className="w-full max-w-md space-y-2"
              >
                <AiGeneratingOverlay
                  messages={[
                    "Leyendo el brief…",
                    "Perfilando al avatar…",
                    "Encontrando los dolores reales…",
                    "Escribiendo la promesa…",
                  ]}
                />
                <label className="block">
                  <span className="block text-[10px] uppercase tracking-widest text-zinc-400">
                    Qué quieres cambiar (opcional)
                  </span>
                  <textarea
                    name="instruction"
                    rows={2}
                    defaultValue={
                      ((launch.assetsCache as Record<string, unknown> | null)
                        ?.marcoInstruction as string) ?? ""
                    }
                    placeholder="El avatar es más senior de lo que has puesto, y la promesa demasiado genérica."
                    className="field-input mt-1.5 w-full px-3 py-2 text-sm text-white"
                  />
                </label>
                <div className="flex flex-wrap items-center justify-end gap-3">
                  {!hasBrief && (
                    <p className="mr-auto text-xs text-amber-300">
                      Escribe primero el brief: el marco de copy sale de ahí.
                    </p>
                  )}
                  <SubmitButton
                    variant={hasMarco ? "outline" : "primary"}
                    pendingLabel="Generando…"
                    disabled={!hasBrief}
                  >
                    {hasMarco ? "Regenerar con Claude" : "Generar con Claude"}
                  </SubmitButton>
                </div>
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

          {/* Step 2.5 — Calendario. No en evergreen: sin fecha ancla no hay fases. */}
          {!esEvergreen && (
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
                anchorDate={
                  launch.anchorDate
                    ? launch.anchorDate.toISOString().split("T")[0]!
                    : null
                }
                milestones={launchMilestones.map((m) => ({
                  id: m.id,
                  phase: m.phase,
                  label: m.label,
                  startsAt: m.startsAt.toISOString().split("T")[0]!,
                  endsAt: m.endsAt.toISOString().split("T")[0]!,
                  sortOrder: m.sortOrder,
                  aiWarnings: (m.aiWarnings ?? []) as Array<{
                    date: string;
                    severity: "info" | "warning" | "critical";
                    message: string;
                    country?: string;
                  }>,
                }))}
                updateCountryAction={updateLaunchCountryAction}
                generateMilestonesAction={generateMilestonesAction}
                updateMilestoneAction={updateMilestoneAction}
                analyzeCalendarAction={analyzeCalendarAction}
                savedAnalysis={
                  ((launch.assetsCache as Record<string, unknown>)
                    ?.calendarAnalysis as {
                    summary: string;
                    score: number;
                    warnings: Array<{
                      date: string;
                      severity: "info" | "warning" | "critical";
                      message: string;
                      country?: string;
                    }>;
                    suggestions: string[];
                  }) ?? null
                }
              />
            </WizardStep>
          )}
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
            status={
              !hasMarco || !brandKitApproved
                ? "needs-prev"
                : hasLanding
                  ? "ready"
                  : "empty"
            }
            action={
              <form action={generateAllPagesAction.bind(null, launch.id)}>
                <AiGeneratingOverlay
                  messages={[
                    "Construyendo cada página…",
                    "Encadenando dolor → solución…",
                    "Escribiendo legales y contenido…",
                    "Puliendo los CTA finales…",
                  ]}
                />
                <SubmitButton
                  variant={hasLanding ? "outline" : "primary"}
                  pendingLabel="Generando todas…"
                  disabled={!hasMarco || !brandKitApproved}
                >
                  {hasLanding
                    ? "Regenerar todas las páginas"
                    : "Generar todas las páginas"}
                </SubmitButton>
              </form>
            }
          >
            {!brandKitApproved && (
              <p className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
                Aprueba primero la identidad visual (paso 1) para poder generar
                las páginas.
              </p>
            )}

            {pages.some((p) => p.kind === "contenido") && (
              <ContentDripForm
                launchId={launch.id}
                currentStartsAt={launch.contentDripStartsAt}
                contentPageCount={
                  pages.filter((p) => p.kind === "contenido").length
                }
                saveAction={updateContentDripScheduleAction}
              />
            )}

            {/* Follows the run and refreshes on its own until it finishes. */}
            <GenerationProgress
              progress={
                ((launch.assetsCache as Record<string, unknown> | null)
                  ?.generation as
                  | Parameters<typeof GenerationProgress>[0]["progress"]
                  | undefined) ?? null
              }
            />

            <PageIndex
              pages={pages}
              launchSlug={launch.slug}
              launchName={launch.name}
              appUrl={env.APP_URL.replace(/\/$/, "")}
              domainHostname={domainHostname}
              claudeHref={claudeHref}
              hasConnector={connector}
              generatedKeys={new Set(latestByPageKey.keys())}
              claudeKeys={
                new Set(
                  [...latestByPageKey.entries()]
                    .filter(([, asset]) => isCustomPageBody(asset.body))
                    .map(([pageKey]) => pageKey),
                )
              }
              designUrls={Object.fromEntries(
                [...latestByPageKey.entries()].flatMap(([pageKey, asset]) =>
                  isCustomPageBody(asset.body) && asset.body.designUrl
                    ? [[pageKey, asset.body.designUrl]]
                    : [],
                ),
              )}
              dripStartsAt={launch.contentDripStartsAt}
            />

            {/* Una página que el tipo de lanzamiento no trae: la crea Claude, que es
            quien sabe para qué la quieres. */}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <ClaudeButton
                hasConnector={connector}
                label="Página nueva con Claude"
                href={claudeNewPageUrl({
                  launchSlug: launch.slug,
                  launchName: launch.name,
                })}
              />
              <span className="text-xs text-zinc-500">
                Abre un chat con el conector puesto: acordáis para qué es, la
                crea y la publica.
              </span>
            </div>

            {/* Generation inputs: they steer every page, so they belong with the
            index rather than inside one page's editor. */}
            <div className="mt-6 space-y-3 border-t border-white/5 pt-5">
              <div className="text-xs uppercase tracking-widest text-zinc-400">
                Cómo se generan las páginas
              </div>
              <ReferenceUrlForm
                launchId={launch.id}
                currentUrl={launch.referenceUrl}
                saveAction={updateReferenceUrlAction}
              />
              {/* Nada de fechas de cierre en una newsletter: es evergreen, no hay
                  carrito que cerrar ni registro que caduque, y un campo "Cierre del
                  carrito" en un lanzamiento sin carrito hace dudar de si falta algo
                  por configurar. */}
              {!esEvergreen && (
                <CartScheduleForm
                  launchId={launch.id}
                  currentCartClosesAt={launch.cartClosesAt}
                  currentRegistrationClosesAt={launch.registrationClosesAt}
                  saveAction={updateCartScheduleAction}
                />
              )}
              <LandingInstructionsForm
                launchId={launch.id}
                currentInstructions={launch.landingGeneralInstructions}
                saveAction={updateLandingInstructionsAction}
              />
            </div>
          </WizardStep>
        </>
      )}

      {(active === "todo" || active === "campana") && (
        <>
          {active === "todo" && <GroupHeading>Campaña</GroupHeading>}

          {/* Campañas diseñadas en Claude. Van antes de la secuencia generada porque
              en un lanzamiento de Claude son las de verdad; la secuencia se queda
              debajo y sigue disponible para quien la quiera. */}
          {launch.designMode === "claude" && (
            <WizardStep
              index={4}
              title="Campañas en Claude Design"
              subtitle="Emails diseñados con la identidad del lanzamiento. Tantos como quieras."
              status={
                !hasMarco
                  ? "needs-prev"
                  : designedCampaigns.length > 0
                    ? "ready"
                    : "empty"
              }
            >
              <DesignedCampaigns
                campaigns={designedCampaigns}
                launchSlug={launch.slug}
                hasConnector={connector}
                acConfigured={acConfigured}
                claudeUrl={claudeHref}
                claudePrompt={claudeCampaignsPrompt({
                  launchSlug: launch.slug,
                  launchName: launch.name,
                })}
                pushAction={pushDesignedEmailToAcAction.bind(null, launch.id)}
              />
            </WizardStep>
          )}

          {/* Step 4 — Emails */}
          <WizardStep
            index={launch.designMode === "claude" ? 4.5 : 4}
            title="Secuencia de emails"
            subtitle={`Plan específico para tipo ${meta?.label ?? launch.type}.`}
            status={!hasMarco ? "needs-prev" : hasEmails ? "ready" : "empty"}
            action={
              <form action={generateEmailsAction.bind(null, launch.id)}>
                <AiGeneratingOverlay
                  messages={[
                    "Planificando la secuencia…",
                    "Escribiendo asuntos…",
                    "Ajustando el ritmo de envío…",
                  ]}
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
            <EmailEditor
              launchId={launch.id}
              body={
                (emailAsset?.body ?? null) as Parameters<
                  typeof EmailEditor
                >[0]["body"]
              }
              brand={{
                logoUrl: launch.brandLogoUrl,
                palette: launch.brandPalette,
                fonts: launch.brandFonts,
              }}
              refineAction={refineEmailAction}
              updateAction={updateEmailAction}
              approveAction={approveEmailAction}
              approveAllAction={approveAllEmailsAction}
            />
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
                  messages={[
                    "Guionizando el UGC…",
                    "Escribiendo hooks…",
                    "Pensando los conceptos de estático…",
                  ]}
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

              {/* Las fotos de este lanzamiento, aquí mismo. Antes esto mandaba a
                  otra pantalla ("sube primero las fotos en Anuncios → Biblioteca")
                  con la biblioteca de toda la cuenta: había que salir del
                  lanzamiento, subir, volver y elegir entre las fotos de todos. */}
              <div>
                <div className="mb-2 text-xs uppercase tracking-widest text-zinc-400">
                  Fotos de este lanzamiento
                </div>
                <MediaLibraryPanel
                  items={mediaItems}
                  launchId={launch.id}
                  deleteAction={deleteMediaItemAction}
                  updateLabelAction={updateMediaLabelAction}
                  generateAction={
                    isImageGenConfigured() ? generateMediaItemAction : undefined
                  }
                />
              </div>

              {/* Los estáticos, a mano en Claude. La galería es la misma: quien
                  los sube a Meta no distingue de dónde salió cada uno, y tener
                  dos sitios distintos según quién lo diseñó sería inventarse una
                  diferencia que al usarlos no existe. */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3">
                <p className="max-w-2xl text-sm text-zinc-400">
                  ¿Los quieres diseñados a mano en vez de compuestos con una
                  plantilla? Claude los hace con la identidad del lanzamiento y
                  aparecen en esta misma galería.
                </p>
                <ClaudeGoButton
                  hasConnector={connector}
                  label="Diseñar anuncios en Claude"
                  href={claudeHref}
                  prompt={claudeAdsPrompt({
                    launchSlug: launch.slug,
                    launchName: launch.name,
                  })}
                />
              </div>

              {/* Con copy generado o sin él: sin esto, un anuncio diseñado en
                  Claude quedaba publicado y sin ningún sitio donde verse. */}
              {(adsAsset || adImages.length > 0) && (
                <div>
                  <div className="mb-2 text-xs uppercase tracking-widest text-zinc-400">
                    Componer estáticos con tus fotos
                  </div>
                  <AdStaticsGenerator
                    launchId={launch.id}
                    concepts={(adsAsset?.body as AdsBody | undefined)?.statics ?? []}
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
          {/* Step 6 — Producto Stripe. Una newsletter no cobra nada. */}
          {!esEvergreen && (
            <WizardStep
              index={6}
              title="Producto en Stripe"
              subtitle="Crea el producto y el price ID. La landing pública usará este checkout."
              status={hasProduct ? "ready" : "empty"}
            >
              {/* El precio y los plazos, antes del producto: son la decisión, y el
                producto de Stripe es su consecuencia. Editables aquí porque un
                campo que solo se escribe al crear el lanzamiento es un campo que
                nadie puede corregir. */}
              <div className="mb-4">
                <PricingPlanForm
                  launchId={launch.id}
                  currentPriceCents={launch.defaultPriceCents}
                  currentInstallmentCount={launch.installmentCount}
                  currentInstallmentPriceCents={launch.installmentPriceCents}
                  currency={launch.currency ?? "EUR"}
                  saveAction={updatePricingPlanAction}
                />
              </div>

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
          )}

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
              tagIds={
                (launch.activeCampaignTagIds ?? {}) as Record<string, number>
              }
              hasEmails={hasEmails}
              emailAssetId={emailAsset?.id ?? null}
              hasTemplates={Boolean(
                (launch.assetsCache as Record<string, unknown>)?.acTemplateIds,
              )}
              hasCampaigns={Boolean(
                (launch.assetsCache as Record<string, unknown>)?.acCampaignIds,
              )}
              hasMilestones={hasMilestones}
              provisionAction={provisionActiveCampaignAction}
              pushEmailsAction={pushEmailsToActiveCampaignAction}
              scheduleCampaignsAction={scheduleAcCampaignsAction}
            />

            {/* Campaign Calendar */}
            {hasEmails && hasMilestones && (
              <div className="mt-6 space-y-2">
                <h3 className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.25em] text-zinc-500">
                  Calendario de envios
                </h3>
                <CampaignCalendar
                  launchId={launch.id}
                  emails={
                    (
                      emailAsset?.body as {
                        emails: Array<{
                          subject: string;
                          phase?: string;
                          timing?: string;
                          sendOffsetDays?: number;
                          approved?: boolean;
                        }>;
                      }
                    )?.emails ?? []
                  }
                  milestones={launchMilestones.map((m) => ({
                    phase: m.phase,
                    label: m.label,
                    startsAt: m.startsAt.toISOString(),
                    endsAt: m.endsAt.toISOString(),
                  }))}
                  hasCampaigns={Boolean(
                    (launch.assetsCache as Record<string, unknown>)
                      ?.acCampaignIds,
                  )}
                  updateOffsetAction={updateEmailOffsetAction}
                />
              </div>
            )}

            {/* AC Automations */}
            {acConfigured && acAutomations.length > 0 && (
              <div className="mt-6 space-y-2">
                <h3 className="font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.25em] text-zinc-500">
                  Automatizaciones AC
                </h3>
                <AcAutomationsPanel
                  launchId={launch.id}
                  automations={acAutomations.map((a) => ({
                    id: a.id,
                    name: a.name,
                    status: a.status,
                    entered: a.entered,
                  }))}
                  linkedAutomationIds={acLinkedAutomationIds}
                  linkAction={linkAcAutomationAction}
                  unlinkAction={unlinkAcAutomationAction}
                />
              </div>
            )}
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
            status={
              !telegramConfigured
                ? "needs-prev"
                : hasTelegram
                  ? "ready"
                  : "empty"
            }
            action={
              hasTelegram && hasMarco ? (
                <form
                  action={generateTelegramMessagesAction.bind(null, launch.id)}
                >
                  <SubmitButton
                    variant={telegramAsset ? "outline" : "primary"}
                    pendingLabel="Generando…"
                  >
                    {telegramAsset
                      ? "Regenerar mensajes"
                      : "Generar mensajes con Claude"}
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
              messages={
                (
                  telegramAsset?.body as {
                    messages: Array<{
                      title: string;
                      body: string;
                      timing: string;
                      triggerEvent: string;
                    }>;
                  } | null
                )?.messages ?? null
              }
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

      {/* Al final de la página y en todas las secciones: es lo que se busca
          bajando, y esconderlo en una sección concreta obliga a adivinar cuál. */}
      <LaunchDangerZone
        launchName={launch.name}
        archiveAction={archiveLaunchAction.bind(null, launch.id)}
        deleteAction={deleteLaunchAction.bind(null, launch.id)}
        puedeBorrarse={borrado.puede}
        huella={borrado.huella}
      />
    </div>
  );
}
