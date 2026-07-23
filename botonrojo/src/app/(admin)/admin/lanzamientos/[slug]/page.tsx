import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, desc, and } from "drizzle-orm";

import { db } from "@/db";
import { launches, assets, products, users } from "@/db/schema";
import { LAUNCH_TYPES, type LaunchType } from "@/lib/launch-types";
import { isActiveCampaignConfigured } from "@/integrations/activecampaign";

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
} from "@/server/launches";

import { WizardStep } from "@/components/admin/wizard-step";
import { SubmitButton } from "@/components/admin/submit-button";
import { MarcoCopyEditor } from "@/components/admin/marco-copy-editor";
import { LandingEditor } from "@/components/admin/landing-editor";
import { EmailSequence } from "@/components/admin/email-sequence";
import { StripeProductForm } from "@/components/admin/stripe-product-form";
import { ActiveCampaignPanel } from "@/components/admin/activecampaign-panel";
import { DomainPanel } from "@/components/admin/domain-panel";
import type { LandingBody } from "@/components/public/landing-types";
import { listDomainsForLaunch, addDomainAction, verifyDomainAction, removeDomainAction } from "@/server/domains";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function LaunchHubPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const [launch] = await db.select().from(launches).where(eq(launches.slug, slug)).limit(1);
  if (!launch) notFound();

  const meta = LAUNCH_TYPES[launch.type as LaunchType];

  // Load all landing versions with author info (no body to keep it light)
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
    .where(and(eq(assets.launchId, launch.id), eq(assets.kind, "landing")))
    .orderBy(desc(assets.createdAt));

  // Load the latest landing body for editing
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

  const hasMarco = Boolean(launch.promise);
  const hasLanding = Boolean(landingAsset);
  const hasEmails = Boolean(emailAsset);
  const hasProduct = Boolean(product);
  const hasAc = Boolean(launch.activeCampaignListId);
  const launchDomains = await listDomainsForLaunch(launch.id);
  const hasActiveDomain = launchDomains.some((d) => d.status === "active");

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
          updateAction={updateMarcoCopyAction.bind(null, launch.id)}
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
          versions={landingVersions}
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

      {/* Step 7 — Dominio propio */}
      <WizardStep
        index={7}
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
