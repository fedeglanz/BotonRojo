import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, desc, and, count } from "drizzle-orm";

import { db } from "@/db";
import { launches, assets, products, trackingEvents } from "@/db/schema";
import { LAUNCH_TYPES, type LaunchType } from "@/lib/launch-types";
import { isActiveCampaignConfigured } from "@/integrations/activecampaign";
import { isTelegramConfigured, getMe as getTelegramBot } from "@/integrations/telegram";
import { organizations } from "@/db/schema/organizations";
import { requireOrgAdmin } from "@/lib/org";

import {
  generateMarcoCopyAction,
  updateMarcoCopyAction,
  generateLandingAction,
  generateEmailsAction,
  generateAdsAction,
  createStripeProductAction,
  provisionActiveCampaignAction,
  pushEmailsToActiveCampaignAction,
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
} from "@/server/launches";

import { WizardStep } from "@/components/admin/wizard-step";
import { SubmitButton } from "@/components/admin/submit-button";
import { MarcoCopyEditor } from "@/components/admin/marco-copy-editor";
import { LandingEditor } from "@/components/admin/landing-editor";
import { EmailSequence } from "@/components/admin/email-sequence";
import { StripeProductForm } from "@/components/admin/stripe-product-form";
import { ActiveCampaignPanel } from "@/components/admin/activecampaign-panel";
import { TelegramPanel } from "@/components/admin/telegram-panel";
import type { LandingBody } from "@/components/public/landing-types";

export const dynamic = "force-dynamic";

export default async function LaunchHubPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const { organizationId } = await requireOrgAdmin();
  const [launch] = await db.select().from(launches).where(and(eq(launches.slug, slug), eq(launches.organizationId, organizationId))).limit(1);
  if (!launch) notFound();

  const meta = LAUNCH_TYPES[launch.type as LaunchType];

  const [landingAsset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.launchId, launch.id), eq(assets.kind, "landing")))
    .orderBy(desc(assets.createdAt))
    .limit(1);

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

  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.launchId, launch.id))
    .limit(1);

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
  const hasLanding = Boolean(landingAsset);
  const hasEmails = Boolean(emailAsset);
  const hasProduct = Boolean(product);
  const hasAc = Boolean(launch.activeCampaignListId);
  const hasTelegram = Boolean(launch.telegramChatId);

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

      {/* Step 1 — Marco copy */}
      <WizardStep
        index={1}
        title="Marco de copy"
        subtitle="Avatar, promesa, dolores y beneficios desde el brief inicial."
        status={hasMarco ? "ready" : "empty"}
        action={
          <form action={generateMarcoCopyAction.bind(null, launch.id)}>
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
          updateAction={updateMarcoCopyAction}
        />
      </WizardStep>

      {/* Step 2 — Landing */}
      <WizardStep
        index={2}
        title="Landing"
        subtitle="Estructura completa: hero, dolor→solución, qué incluye, FAQ, garantía y CTA."
        status={!hasMarco ? "needs-prev" : hasLanding ? "ready" : "empty"}
        action={
          <form action={generateLandingAction.bind(null, launch.id)}>
            <SubmitButton
              variant={hasLanding ? "outline" : "primary"}
              pendingLabel="Generando landing…"
              disabled={!hasMarco}
            >
              {hasLanding ? "Regenerar landing" : "Generar landing"}
            </SubmitButton>
          </form>
        }
      >
        <LandingEditor
          launchId={launch.id}
          launchSlug={launch.slug}
          body={(landingAsset?.body ?? null) as LandingBody | null}
          refineAction={refineLandingSectionAction}
          rawUpdateAction={updateSectionRawAction}
          imageSaveAction={setSectionImageAction}
        />
      </WizardStep>

      {/* Step 3 — Emails */}
      <WizardStep
        index={3}
        title="Secuencia de emails"
        subtitle={`Plan específico para tipo ${meta?.label ?? launch.type}.`}
        status={!hasMarco ? "needs-prev" : hasEmails ? "ready" : "empty"}
        action={
          <form action={generateEmailsAction.bind(null, launch.id)}>
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

      {/* Step 4 — Anuncios */}
      <WizardStep
        index={4}
        title="Anuncios Meta + Google"
        subtitle="UGC, voz en off y clips de YouTube + CTA overlay. Copy listo para subir."
        status={!hasMarco ? "needs-prev" : adsAsset ? "ready" : "empty"}
        action={
          <form action={generateAdsAction.bind(null, launch.id)}>
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
        {adsAsset ? (
          <pre className="max-h-96 overflow-auto rounded-lg border border-white/5 bg-black/40 p-4 font-[family-name:var(--font-mono)] text-xs text-zinc-300">
{JSON.stringify(adsAsset.body, null, 2)}
          </pre>
        ) : (
          <p className="text-sm text-zinc-500">Aún no se han generado anuncios.</p>
        )}
      </WizardStep>

      {/* Step 5 — Producto Stripe */}
      <WizardStep
        index={5}
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
          existingProduct={product ?? null}
          action={createStripeProductAction}
        />
      </WizardStep>

      {/* Step 6 — ActiveCampaign */}
      <WizardStep
        index={6}
        title="ActiveCampaign"
        subtitle="Crea lista + tags para este lanzamiento y sube los emails como plantillas."
        status={!isActiveCampaignConfigured() ? "needs-prev" : hasAc ? "ready" : "empty"}
      >
        <ActiveCampaignPanel
          launchId={launch.id}
          launchSlug={launch.slug}
          configured={isActiveCampaignConfigured()}
          listId={launch.activeCampaignListId ?? null}
          tagIds={(launch.activeCampaignTagIds ?? {}) as Record<string, number>}
          hasEmails={hasEmails}
          emailAssetId={emailAsset?.id ?? null}
          provisionAction={provisionActiveCampaignAction}
          pushEmailsAction={pushEmailsToActiveCampaignAction}
        />
      </WizardStep>

      {/* Step 7 — Telegram */}
      <WizardStep
        index={7}
        title="Telegram"
        subtitle="Conectá un grupo o canal de Telegram para enviar comunicaciones del lanzamiento."
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

      {/* Step 8 — Registros */}
      <WizardStep
        index={8}
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
    </div>
  );
}
