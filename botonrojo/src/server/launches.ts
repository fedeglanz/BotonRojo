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
import { TELEGRAM_SYSTEM, telegramPrompt, TELEGRAM_REFINE_SYSTEM, telegramRefinePrompt } from "@/ai/prompts/telegram";
import type { LandingBody, LandingSectionKey } from "@/components/public/landing-types";

import {
  provisionLaunchInAc,
  createEmailTemplate,
  createCampaign,
  findCampaignsByPrefix,
  deleteCampaign,
  isActiveCampaignConfigured,
} from "@/integrations/activecampaign";

import {
  isTelegramConfigured,
  connectTelegramGroup,
  sendMessage as sendTelegramMessage,
  registerWebhook,
} from "@/integrations/telegram";

import { organizations } from "@/db/schema";
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

  // Fetch milestones to align emails with calendar phases
  const launchMilestones = await db
    .select()
    .from(milestones)
    .where(eq(milestones.launchId, launchId))
    .orderBy(milestones.sortOrder);

  const { text } = await complete({
    system: EMAILS_SYSTEM,
    prompt: emailsPrompt({
      launchName: launch.name,
      type: launch.type,
      promise: launch.promise,
      ctaUrl,
      primaryCountry: launch.primaryCountry,
      milestones: launchMilestones.map((m) => ({
        phase: m.phase,
        label: m.label,
        startsAt: m.startsAt.toISOString().slice(0, 10),
        endsAt: m.endsAt.toISOString().slice(0, 10),
      })),
    }),
    maxTokens: 8000,
    temperature: 0.75,
  });

  type EmailItem = {
    subject: string;
    preheader: string;
    body: string;
    ctaText: string;
    ctaUrl: string;
    phase?: string;
    timing?: string;
    sendOffsetDays?: number;
  };

  const body = extractJson(text) as { emails: EmailItem[] };

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

  const templateIds: string[] = [];
  for (let i = 0; i < sequence.emails.length; i++) {
    const email = sequence.emails[i];
    if (!email) continue;
    const tpl = await createEmailTemplate({
      name: `${launch.slug} · ${String(i + 1).padStart(2, "0")} · ${email.subject.slice(0, 60)}`,
      subject: email.subject,
      html: wrapEmailHtml(email.body, email.preheader ?? ""),
    });
    templateIds.push(tpl.id);
  }

  // Store template IDs in assetsCache for campaign creation
  const cache = (launch.assetsCache ?? {}) as Record<string, unknown>;
  cache.acTemplateIds = templateIds;
  await db
    .update(launches)
    .set({ assetsCache: cache, updatedAt: new Date() })
    .where(eq(launches.id, launchId));

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

/**
 * Create AC campaigns for each email in the sequence, scheduled based on milestones.
 * Requires: list provisioned + templates pushed + milestones generated.
 */
export async function scheduleAcCampaignsAction(launchId: string) {
  const { organizationId } = await requireOrgAdmin();
  if (!isActiveCampaignConfigured()) throw new Error("activecampaign_not_configured");

  const launch = await loadOrgLaunch(launchId, organizationId);
  if (!launch.activeCampaignListId) throw new Error("ac_list_not_provisioned");

  const cache = (launch.assetsCache ?? {}) as Record<string, unknown>;
  const templateIds = cache.acTemplateIds as string[] | undefined;
  if (!templateIds?.length) throw new Error("ac_templates_not_pushed");

  // Get email sequence
  const [emailAsset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.launchId, launchId), eq(assets.kind, "email")))
    .orderBy(desc(assets.createdAt))
    .limit(1);
  if (!emailAsset) throw new Error("email_asset_not_found");

  type EmailItem = {
    subject: string;
    preheader?: string;
    phase?: string;
    timing?: string;
    sendOffsetDays?: number;
  };
  const sequence = emailAsset.body as { emails: EmailItem[] };

  // Get milestones to compute send dates
  const launchMilestones = await db
    .select()
    .from(milestones)
    .where(eq(milestones.launchId, launchId))
    .orderBy(milestones.sortOrder);

  const milestoneByPhase = new Map<string, (typeof launchMilestones)[number]>(launchMilestones.map((m) => [m.phase, m]));

  // Delete existing campaigns for this launch (drafts only)
  const existing = await findCampaignsByPrefix(launch.slug);
  for (const c of existing) {
    if (c.status === 0) {
      await deleteCampaign(c.id).catch(() => {});
    }
  }

  const campaignIds: string[] = [];

  for (let i = 0; i < sequence.emails.length; i++) {
    const email = sequence.emails[i];
    const tplId = templateIds[i];
    if (!email || !tplId) continue;

    // Compute scheduled date from milestone + offset
    let scheduledDate: string | undefined;
    if (email.phase) {
      const milestone = milestoneByPhase.get(email.phase);
      if (milestone) {
        const base = new Date(milestone.startsAt);
        const offset = email.sendOffsetDays ?? 0;
        base.setDate(base.getDate() + offset);
        // Schedule at 10:00 AM (reasonable default)
        base.setHours(10, 0, 0, 0);
        scheduledDate = base.toISOString();
      }
    }

    const campaign = await createCampaign({
      name: `${launch.slug} · ${String(i + 1).padStart(2, "0")} · ${email.subject.slice(0, 40)}`,
      listId: launch.activeCampaignListId,
      templateId: tplId,
      subject: email.subject,
      preheaderText: email.preheader,
      scheduledDate,
    });

    campaignIds.push(campaign.id);
  }

  // Store campaign IDs
  cache.acCampaignIds = campaignIds;
  await db
    .update(launches)
    .set({ assetsCache: cache, updatedAt: new Date() })
    .where(eq(launches.id, launchId));

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

// ---- Telegram ----

async function getOrgBotToken(organizationId: string): Promise<string | null> {
  const [org] = await db.select({ token: organizations.telegramBotToken }).from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  return org?.token ?? null;
}

export async function connectTelegramGroupAction(launchId: string, formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const orgBotToken = await getOrgBotToken(organizationId);

  if (!isTelegramConfigured(orgBotToken)) {
    throw new Error("telegram_not_configured");
  }

  const launch = await loadOrgLaunch(launchId, organizationId);
  const chatId = String(formData.get("chatId") ?? "").trim();
  if (!chatId) throw new Error("chat_id_required");

  const result = await connectTelegramGroup(chatId, orgBotToken);

  await db
    .update(launches)
    .set({
      telegramChatId: result.chatId,
      telegramInviteLink: result.inviteLink,
      telegramBotAdded: true,
      updatedAt: new Date(),
    })
    .where(eq(launches.id, launchId));

  // Auto-register webhook so Telegram pushes updates
  if (env.TELEGRAM_WEBHOOK_SECRET) {
    registerWebhook(env.APP_URL, env.TELEGRAM_WEBHOOK_SECRET, orgBotToken).catch((err) =>
      console.error("Webhook registration failed", err),
    );
  }

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

export async function disconnectTelegramGroupAction(launchId: string) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await loadOrgLaunch(launchId, organizationId);

  await db
    .update(launches)
    .set({
      telegramChatId: null,
      telegramInviteLink: null,
      telegramBotAdded: false,
      updatedAt: new Date(),
    })
    .where(eq(launches.id, launchId));

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

export async function sendTelegramTestAction(launchId: string) {
  const { organizationId } = await requireOrgAdmin();
  const orgBotToken = await getOrgBotToken(organizationId);
  const launch = await loadOrgLaunch(launchId, organizationId);

  if (!launch.telegramChatId) throw new Error("telegram_not_connected");

  await sendTelegramMessage(
    launch.telegramChatId,
    `✅ <b>Conexión de prueba</b>\n\nEl bot está conectado al lanzamiento <b>${launch.name}</b>.`,
    { parseMode: "HTML" },
    orgBotToken,
  );

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

// ---- Telegram AI Messages (Ticket 3) ----

export type TelegramMessageItem = {
  title: string;
  body: string;
  timing: string;
  triggerEvent: "on_lead" | "on_sale" | "on_cart_open" | "on_cart_close" | "manual";
};

export async function generateTelegramMessagesAction(launchId: string) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await loadOrgLaunch(launchId, organizationId);
  if (!launch.promise) throw new Error("marco_copy_missing");

  const ctaUrl = `${env.APP_URL}/${launch.slug}`;

  const { text } = await complete({
    system: TELEGRAM_SYSTEM,
    prompt: telegramPrompt(launch.name, launch.type, launch.promise, ctaUrl),
    maxTokens: 6000,
    temperature: 0.75,
  });

  const body = extractJson(text) as { messages: TelegramMessageItem[] };

  // Delete previous telegram_message asset for this launch
  await db
    .delete(assets)
    .where(and(eq(assets.launchId, launchId), eq(assets.kind, "telegram_message")));

  await db.insert(assets).values({
    organizationId,
    launchId,
    kind: "telegram_message",
    title: `Telegram · ${launch.name}`,
    body: body as unknown as Record<string, unknown>,
    generatedByAi: env.ANTHROPIC_MODEL,
  });

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

export async function sendTelegramAssetMessageAction(launchId: string, messageIndex: number) {
  const { organizationId } = await requireOrgAdmin();
  const orgBotToken = await getOrgBotToken(organizationId);
  const launch = await loadOrgLaunch(launchId, organizationId);

  if (!launch.telegramChatId) throw new Error("telegram_not_connected");

  const [asset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.launchId, launchId), eq(assets.kind, "telegram_message")))
    .orderBy(desc(assets.createdAt))
    .limit(1);

  if (!asset) throw new Error("no_telegram_messages");

  const messages = (asset.body as { messages: TelegramMessageItem[] }).messages;
  const msg = messages[messageIndex];
  if (!msg) throw new Error("message_not_found");

  // Substitute variables
  const text = msg.body
    .replace(/\{\{launchName\}\}/g, launch.name)
    .replace(/\{\{ctaUrl\}\}/g, `${env.APP_URL}/${launch.slug}`)
    .replace(/\{\{name\}\}/g, "");

  await sendTelegramMessage(launch.telegramChatId, text, { parseMode: "HTML" }, orgBotToken);

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

// ---- Telegram Automation (Ticket 4) ----

export async function sendAutomatedTelegramMessage(opts: {
  chatId: string;
  launchId: string;
  organizationId: string;
  event: "on_lead" | "on_sale" | "on_cart_open" | "on_cart_close";
  leadName?: string;
  email?: string;
}) {
  const orgBotToken = await getOrgBotToken(opts.organizationId);

  const [asset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.launchId, opts.launchId), eq(assets.kind, "telegram_message")))
    .orderBy(desc(assets.createdAt))
    .limit(1);

  if (!asset) return;

  const messages = (asset.body as { messages: TelegramMessageItem[] }).messages;
  const matching = messages.filter((m) => m.triggerEvent === opts.event);

  const [launch] = await db
    .select({ name: launches.name, slug: launches.slug })
    .from(launches)
    .where(eq(launches.id, opts.launchId))
    .limit(1);

  for (const msg of matching) {
    const text = msg.body
      .replace(/\{\{launchName\}\}/g, launch?.name ?? "")
      .replace(/\{\{ctaUrl\}\}/g, `${env.APP_URL}/${launch?.slug ?? ""}`)
      .replace(/\{\{name\}\}/g, opts.leadName ?? "")
      .replace(/\{\{email\}\}/g, opts.email ?? "");

    await sendTelegramMessage(opts.chatId, text, { parseMode: "HTML" }, orgBotToken);
  }
}

export async function triggerTelegramCartAction(launchId: string, event: "on_cart_open" | "on_cart_close") {
  const { organizationId } = await requireOrgAdmin();
  const launch = await loadOrgLaunch(launchId, organizationId);

  if (!launch.telegramChatId) throw new Error("telegram_not_connected");

  await sendAutomatedTelegramMessage({
    chatId: launch.telegramChatId,
    launchId,
    organizationId,
    event,
  });

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

// ---- Telegram message editing ----

async function loadTelegramAsset(launchId: string) {
  const [asset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.launchId, launchId), eq(assets.kind, "telegram_message")))
    .orderBy(desc(assets.createdAt))
    .limit(1);
  return asset;
}

export async function editTelegramMessageAction(
  launchId: string,
  messageIndex: number,
  formData: FormData,
) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await loadOrgLaunch(launchId, organizationId);

  const asset = await loadTelegramAsset(launchId);
  if (!asset) throw new Error("no_telegram_messages");

  const body = asset.body as { messages: TelegramMessageItem[] };
  const msg = body.messages[messageIndex];
  if (!msg) throw new Error("message_not_found");

  const newBody = String(formData.get("body") ?? "").trim();
  const newTitle = String(formData.get("title") ?? "").trim();
  if (!newBody) throw new Error("body_required");

  body.messages[messageIndex] = {
    ...msg,
    body: newBody,
    title: newTitle || msg.title,
  };

  await db
    .update(assets)
    .set({ body: body as unknown as Record<string, unknown>, updatedAt: new Date() })
    .where(eq(assets.id, asset.id));

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

export async function refineTelegramMessageAction(
  launchId: string,
  messageIndex: number,
  formData: FormData,
) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await loadOrgLaunch(launchId, organizationId);

  const instruction = String(formData.get("instruction") ?? "").trim();
  if (!instruction) throw new Error("instruction_required");

  const asset = await loadTelegramAsset(launchId);
  if (!asset) throw new Error("no_telegram_messages");

  const body = asset.body as { messages: TelegramMessageItem[] };
  const msg = body.messages[messageIndex];
  if (!msg) throw new Error("message_not_found");

  const { text } = await complete({
    system: TELEGRAM_REFINE_SYSTEM,
    prompt: telegramRefinePrompt({
      currentMessage: msg,
      instruction,
      launchName: launch.name,
      promise: launch.promise ?? "",
    }),
    maxTokens: 2000,
    temperature: 0.6,
  });

  const refined = extractJson(text) as TelegramMessageItem;
  body.messages[messageIndex] = {
    ...refined,
    triggerEvent: msg.triggerEvent, // never change trigger
  };

  await db
    .update(assets)
    .set({ body: body as unknown as Record<string, unknown>, updatedAt: new Date() })
    .where(eq(assets.id, asset.id));

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

// ---- Calendar / Milestones ----

import { milestones } from "@/db/schema";
import { generateMilestones as buildMilestones } from "@/lib/milestone-templates";
import { CALENDAR_ANALYSIS_SYSTEM, calendarAnalysisPrompt } from "@/ai/prompts/calendar";
import { COUNTRIES } from "@/lib/milestone-templates";
import type { AiWarning } from "@/db/schema/milestones";

export async function updateLaunchCountryAction(launchId: string, formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await loadOrgLaunch(launchId, organizationId);

  const primaryCountry = String(formData.get("primaryCountry") ?? "").trim() || null;
  const regionsRaw = String(formData.get("targetRegions") ?? "").trim();
  const targetRegions = regionsRaw ? regionsRaw.split(",").map((s) => s.trim()).filter(Boolean) : [];

  await db
    .update(launches)
    .set({ primaryCountry, targetRegions, updatedAt: new Date() })
    .where(eq(launches.id, launchId));

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

export async function generateMilestonesAction(launchId: string, formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await loadOrgLaunch(launchId, organizationId);

  const anchorDateStr = String(formData.get("anchorDate") ?? "").trim();
  if (!anchorDateStr) throw new Error("anchor_date_required");
  const anchorDate = new Date(anchorDateStr);

  const rows = buildMilestones(anchorDate, launch.type as LaunchType);

  // Save anchor date on launch
  await db
    .update(launches)
    .set({ anchorDate, updatedAt: new Date() })
    .where(eq(launches.id, launchId));

  // Delete existing milestones
  await db.delete(milestones).where(eq(milestones.launchId, launchId));

  // Insert new milestones
  await db.insert(milestones).values(
    rows.map((r) => ({
      launchId,
      phase: r.phase as typeof milestones.$inferInsert.phase,
      label: r.label,
      startsAt: r.startsAt,
      endsAt: r.endsAt,
      sortOrder: r.sortOrder,
    })),
  );

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

export async function updateMilestoneAction(milestoneId: string, formData: FormData) {
  const { organizationId } = await requireOrgAdmin();

  const [milestone] = await db.select().from(milestones).where(eq(milestones.id, milestoneId)).limit(1);
  if (!milestone) throw new Error("milestone_not_found");

  const launch = await loadOrgLaunch(milestone.launchId, organizationId);

  const startsAt = formData.get("startsAt") ? new Date(String(formData.get("startsAt"))) : undefined;
  const endsAt = formData.get("endsAt") ? new Date(String(formData.get("endsAt"))) : undefined;
  const label = formData.get("label") ? String(formData.get("label")).trim() : undefined;

  await db
    .update(milestones)
    .set({
      ...(startsAt && { startsAt }),
      ...(endsAt && { endsAt }),
      ...(label && { label }),
      updatedAt: new Date(),
    })
    .where(eq(milestones.id, milestoneId));

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

export async function analyzeCalendarAction(launchId: string) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await loadOrgLaunch(launchId, organizationId);

  const launchMilestones = await db
    .select()
    .from(milestones)
    .where(eq(milestones.launchId, launchId))
    .orderBy(milestones.sortOrder);

  if (launchMilestones.length === 0) throw new Error("no_milestones");

  const primaryCountry = launch.primaryCountry ?? "AR";
  const secondaryCountries = ((launch.targetRegions as string[]) ?? []).filter((c) => c !== primaryCountry);

  const fmt = (d: Date) => d.toISOString().split("T")[0]!;
  const year = launchMilestones[0]!.startsAt.getFullYear();

  const { text } = await complete({
    system: CALENDAR_ANALYSIS_SYSTEM,
    prompt: calendarAnalysisPrompt({
      primaryCountry: `${primaryCountry} (${COUNTRIES[primaryCountry] ?? primaryCountry})`,
      secondaryCountries: secondaryCountries.map((c) => `${c} (${COUNTRIES[c] ?? c})`),
      milestones: launchMilestones.map((m) => ({
        phase: m.phase,
        label: m.label,
        startsAt: fmt(m.startsAt),
        endsAt: fmt(m.endsAt),
      })),
      year,
      launchType: launch.type,
      launchName: launch.name,
    }),
    maxTokens: 4000,
    temperature: 0.4,
  });

  const analysis = extractJson(text) as {
    summary: string;
    score: number;
    warnings: AiWarning[];
    suggestions: string[];
  };

  // Save warnings on each milestone
  for (const milestone of launchMilestones) {
    const phaseWarnings = analysis.warnings.filter((w) => w.phase === milestone.phase || w.phase === milestone.label);
    await db
      .update(milestones)
      .set({ aiWarnings: phaseWarnings, updatedAt: new Date() })
      .where(eq(milestones.id, milestone.id));
  }

  // Persist full analysis in assetsCache so it survives page refresh
  const existingCache = (launch.assetsCache ?? {}) as Record<string, unknown>;
  await db
    .update(launches)
    .set({
      assetsCache: { ...existingCache, calendarAnalysis: analysis },
      updatedAt: new Date(),
    })
    .where(eq(launches.id, launchId));

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);

  return analysis;
}

export async function discoverTelegramGroupsAction() {
  const { organizationId } = await requireOrgAdmin();
  const orgBotToken = await getOrgBotToken(organizationId);

  if (!isTelegramConfigured(orgBotToken)) {
    return [];
  }

  const { discoverGroups } = await import("@/integrations/telegram");
  return discoverGroups(orgBotToken);
}
