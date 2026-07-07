"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { launches, assets, products } from "@/db/schema";
import { createSlug } from "@/lib/ids";
import { requireOrgAdmin } from "@/lib/org";
import { env } from "@/lib/env";
import { complete } from "@/lib/ai";
import { stripe } from "@/lib/stripe";

import { MARCO_COPY_SYSTEM, marcoCopyPrompt } from "@/ai/prompts/marco-copy";
import { LANDING_SYSTEM, landingPrompt } from "@/ai/prompts/landing";
import { REFINE_SYSTEM, refineSectionPrompt } from "@/ai/prompts/landing-refine";
import { EMAILS_SYSTEM, emailsPrompt } from "@/ai/prompts/emails";
import { ADS_SYSTEM, adsPrompt } from "@/ai/prompts/ads";
import type { LandingBody, LandingSectionKey } from "@/components/public/landing-types";

import {
  provisionLaunchInAc,
  createEmailTemplate,
  isActiveCampaignConfigured,
} from "@/integrations/activecampaign";

import type { AvatarBrief } from "@/db/schema/launches";
import type { LaunchType } from "@/lib/launch-types";

/** Load a launch scoped to the current org. Throws if not found or wrong org. */
async function loadOrgLaunch(launchId: string, organizationId: string) {
  const [launch] = await db
    .select()
    .from(launches)
    .where(and(eq(launches.id, launchId), eq(launches.organizationId, organizationId)))
    .limit(1);
  if (!launch) throw new Error("launch_not_found");
  return launch;
}

function extractJson(text: string): unknown {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fence ? fence[1] : text).trim();
  return JSON.parse(raw);
}

const createSchema = z.object({
  name: z.string().min(2),
  type: z.enum(["venta_directa", "semilla", "plf"]),
  brief: z.string().min(20),
  priceCents: z.coerce.number().int().min(0).optional(),
});

export async function createLaunchAction(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();

  const parsed = createSchema.parse({
    name: formData.get("name"),
    type: formData.get("type"),
    brief: formData.get("brief"),
    priceCents: formData.get("priceCents") || undefined,
  });

  let slug = createSlug(parsed.name);
  if (!slug) slug = `lanzamiento-${Date.now().toString(36)}`;

  // Avoid slug collisions
  const [existing] = await db.select().from(launches).where(eq(launches.slug, slug)).limit(1);
  if (existing) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  await db.insert(launches).values({
    organizationId,
    slug,
    name: parsed.name,
    type: parsed.type as LaunchType,
    status: "draft",
    brief: parsed.brief,
    defaultPriceCents: parsed.priceCents ?? null,
  });

  revalidatePath("/admin");
  redirect(`/admin/lanzamientos/${slug}`);
}

export async function generateMarcoCopyAction(launchId: string) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await loadOrgLaunch(launchId, organizationId);
  if (!launch.brief) throw new Error("brief_missing");

  const { text } = await complete({
    system: MARCO_COPY_SYSTEM,
    prompt: marcoCopyPrompt(launch.brief),
    temperature: 0.6,
  });

  const json = extractJson(text) as {
    avatar: AvatarBrief;
    promise: string;
    painPoints: string[];
    benefits: string[];
  };

  await db
    .update(launches)
    .set({
      avatar: json.avatar,
      promise: json.promise,
      painPoints: json.painPoints,
      benefits: json.benefits,
      updatedAt: new Date(),
    })
    .where(eq(launches.id, launchId));

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

export async function updateMarcoCopyAction(launchId: string, formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await loadOrgLaunch(launchId, organizationId);

  const promise = String(formData.get("promise") ?? "");
  const painPoints = String(formData.get("painPoints") ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const benefits = String(formData.get("benefits") ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
  const avatarWho = String(formData.get("avatarWho") ?? "");
  const avatarContext = String(formData.get("avatarContext") ?? "");

  await db
    .update(launches)
    .set({
      promise,
      painPoints,
      benefits,
      avatar: { who: avatarWho, context: avatarContext },
      updatedAt: new Date(),
    })
    .where(eq(launches.id, launchId));

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

export async function generateLandingAction(launchId: string) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await loadOrgLaunch(launchId, organizationId);
  if (!launch.promise || !launch.avatar) throw new Error("marco_copy_missing");

  const { text } = await complete({
    system: LANDING_SYSTEM,
    prompt: landingPrompt(
      launch.name,
      launch.avatar as AvatarBrief,
      launch.promise,
      launch.painPoints ?? [],
      launch.benefits ?? [],
    ),
    maxTokens: 8000,
    temperature: 0.7,
  });

  const body = extractJson(text) as Record<string, unknown>;

  await db
    .insert(assets)
    .values({
      launchId,
      organizationId,
      kind: "landing",
      title: `Landing · ${launch.name}`,
      body,
      generatedByAi: env.ANTHROPIC_MODEL,
    });

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

export async function generateEmailsAction(launchId: string) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await loadOrgLaunch(launchId, organizationId);
  if (!launch.promise) throw new Error("marco_copy_missing");

  const ctaUrl = `${env.APP_URL}/${launch.slug}`;

  const { text } = await complete({
    system: EMAILS_SYSTEM,
    prompt: emailsPrompt(launch.name, launch.type, launch.promise, ctaUrl),
    maxTokens: 8000,
    temperature: 0.75,
  });

  const body = extractJson(text) as { emails: Array<{ subject: string; preheader: string; body: string; ctaText: string; ctaUrl: string }> };

  await db.insert(assets).values({
    organizationId,
    launchId,
    kind: "email",
    title: `Secuencia · ${launch.name}`,
    body,
    generatedByAi: env.ANTHROPIC_MODEL,
  });

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

export async function generateAdsAction(launchId: string) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await loadOrgLaunch(launchId, organizationId);
  if (!launch.promise) throw new Error("marco_copy_missing");

  const ctaUrl = `${env.APP_URL}/${launch.slug}`;
  const { text } = await complete({
    system: ADS_SYSTEM,
    prompt: adsPrompt(launch.name, launch.promise, launch.painPoints ?? [], launch.benefits ?? [], ctaUrl),
    maxTokens: 6000,
    temperature: 0.8,
  });

  const body = extractJson(text) as Record<string, unknown>;

  await db.insert(assets).values({
    organizationId,
    launchId,
    kind: "ad_copy",
    title: `Anuncios · ${launch.name}`,
    body,
    generatedByAi: env.ANTHROPIC_MODEL,
  });

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

export async function createStripeProductAction(launchId: string, formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await loadOrgLaunch(launchId, organizationId);

  const priceCents = Number(formData.get("priceCents"));
  const currency = String(formData.get("currency") ?? "EUR").toLowerCase();
  const name = String(formData.get("name") ?? launch.name);
  const description = String(formData.get("description") ?? launch.promise ?? "");

  if (!Number.isFinite(priceCents) || priceCents <= 0) {
    throw new Error("invalid_price");
  }
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error("stripe_not_configured");
  }

  const stripeProduct = await stripe.products.create({
    name,
    description: description || undefined,
    metadata: { launch_id: launchId, launch_slug: launch.slug },
  });

  const stripePrice = await stripe.prices.create({
    product: stripeProduct.id,
    unit_amount: priceCents,
    currency,
  });

  await db.insert(products).values({
    organizationId,
    slug: launch.slug,
    name,
    description: description || null,
    launchId,
    priceCents,
    currency: currency.toUpperCase(),
    stripePriceId: stripePrice.id,
    stripeProductId: stripeProduct.id,
    active: true,
  });

  await db
    .update(launches)
    .set({ defaultPriceCents: priceCents, currency: currency.toUpperCase(), updatedAt: new Date() })
    .where(eq(launches.id, launchId));

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

export async function provisionActiveCampaignAction(launchId: string) {
  const { organizationId } = await requireOrgAdmin();
  if (!isActiveCampaignConfigured()) {
    throw new Error("activecampaign_not_configured");
  }

  const launch = await loadOrgLaunch(launchId, organizationId);

  const publicUrl = `${env.APP_URL}/${launch.slug}`;
  const { listId, tagIds } = await provisionLaunchInAc({
    launchSlug: launch.slug,
    launchName: launch.name,
    publicUrl,
  });

  await db
    .update(launches)
    .set({
      activeCampaignListId: listId,
      activeCampaignTagIds: tagIds,
      updatedAt: new Date(),
    })
    .where(eq(launches.id, launchId));

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

export async function pushEmailsToActiveCampaignAction(launchId: string, assetId: string) {
  const { organizationId } = await requireOrgAdmin();
  if (!isActiveCampaignConfigured()) throw new Error("activecampaign_not_configured");

  const launch = await loadOrgLaunch(launchId, organizationId);

  const [asset] = await db.select().from(assets).where(eq(assets.id, assetId)).limit(1);
  if (!asset || asset.kind !== "email") throw new Error("asset_not_found");

  const sequence = asset.body as { emails: Array<{ subject: string; preheader?: string; body: string }> };

  for (let i = 0; i < sequence.emails.length; i++) {
    const email = sequence.emails[i];
    if (!email) continue;
    await createEmailTemplate({
      name: `${launch.slug} · ${String(i + 1).padStart(2, "0")} · ${email.subject.slice(0, 60)}`,
      subject: email.subject,
      html: wrapEmailHtml(email.body, email.preheader ?? ""),
    });
  }

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

// ---- Landing per-section edits ----

async function loadLandingAsset(launchId: string, organizationId: string) {
  const launch = await loadOrgLaunch(launchId, organizationId);

  const [asset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.launchId, launchId), eq(assets.kind, "landing")))
    .orderBy(desc(assets.createdAt))
    .limit(1);

  return { launch, asset };
}

async function saveLandingBody(launchId: string, slug: string, assetId: string | undefined, body: LandingBody) {
  if (assetId) {
    await db
      .update(assets)
      .set({ body: body as unknown as Record<string, unknown>, updatedAt: new Date() })
      .where(eq(assets.id, assetId));
  } else {
    await db.insert(assets).values({
      launchId,
      kind: "landing",
      title: `Landing`,
      body: body as unknown as Record<string, unknown>,
    });
  }
  revalidatePath(`/admin/lanzamientos/${slug}`);
  revalidatePath(`/${slug}`);
}

export async function refineLandingSectionAction(
  launchId: string,
  section: LandingSectionKey,
  formData: FormData,
) {
  const { organizationId } = await requireOrgAdmin();
  const instruction = String(formData.get("instruction") ?? "").trim();
  if (!instruction) throw new Error("instruction_required");

  const { launch, asset } = await loadLandingAsset(launchId, organizationId);
  const body = (asset?.body ?? {}) as LandingBody;
  const currentSection = (body as Record<string, unknown>)[section] ?? null;

  const { text } = await complete({
    system: REFINE_SYSTEM,
    prompt: refineSectionPrompt({
      section,
      currentJson: currentSection,
      instruction,
      launchContext: {
        name: launch.name,
        promise: launch.promise,
        painPoints: launch.painPoints ?? [],
        benefits: launch.benefits ?? [],
      },
    }),
    maxTokens: 3000,
    temperature: 0.6,
  });

  const updated = extractJson(text);
  const newBody: LandingBody = { ...body, [section]: updated };

  await saveLandingBody(launchId, launch.slug, asset?.id, newBody);
}

const ALLOWED_IMAGE_SLOTS = new Set([
  "hero.imageUrl",
  "about.creatorImageUrl",
]);

export async function setSectionImageAction(
  launchId: string,
  slotPath: string,
  formData: FormData,
) {
  const { organizationId } = await requireOrgAdmin();
  if (!ALLOWED_IMAGE_SLOTS.has(slotPath) && !slotPath.startsWith("includes.")) {
    throw new Error("invalid_slot");
  }
  const imageUrl = String(formData.get("imageUrl") ?? "").trim() || null;

  const { launch, asset } = await loadLandingAsset(launchId, organizationId);
  const body = (asset?.body ?? {}) as LandingBody;

  const newBody: LandingBody = JSON.parse(JSON.stringify(body));

  if (slotPath === "hero.imageUrl") {
    newBody.hero = { ...(newBody.hero ?? {}), imageUrl: imageUrl ?? undefined };
  } else if (slotPath === "about.creatorImageUrl") {
    const cur = newBody.about;
    if (typeof cur === "string") {
      newBody.about = { text: cur, creatorImageUrl: imageUrl ?? undefined };
    } else {
      newBody.about = { ...(cur ?? { text: "" }), creatorImageUrl: imageUrl ?? undefined };
    }
  } else if (slotPath.startsWith("includes.")) {
    const idx = Number(slotPath.split(".")[1]);
    if (Number.isFinite(idx) && newBody.includes && newBody.includes[idx]) {
      newBody.includes[idx] = { ...newBody.includes[idx], imageUrl: imageUrl ?? undefined };
    }
  }

  await saveLandingBody(launchId, launch.slug, asset?.id, newBody);
}

export async function updateSectionRawAction(
  launchId: string,
  section: LandingSectionKey,
  formData: FormData,
) {
  const { organizationId } = await requireOrgAdmin();
  const raw = String(formData.get("json") ?? "").trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("invalid_json");
  }

  const { launch, asset } = await loadLandingAsset(launchId, organizationId);
  const body = (asset?.body ?? {}) as LandingBody;
  const newBody: LandingBody = { ...body, [section]: parsed };

  await saveLandingBody(launchId, launch.slug, asset?.id, newBody);
}

function wrapEmailHtml(body: string, preheader: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title></title></head><body>
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
${body}
</body></html>`;
}
