"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { launches, assets, products, organizations } from "@/db/schema";
import { requireOrgAdmin } from "@/lib/auth-helpers";
import { createSlug } from "@/lib/ids";
import { env } from "@/lib/env";
import { complete, completeWithImages } from "@/lib/ai";
import { getStripeClientForOrg } from "@/lib/stripe";

import { MARCO_COPY_SYSTEM, marcoCopyPrompt } from "@/ai/prompts/marco-copy";
import { LANDING_SYSTEM, landingPrompt } from "@/ai/prompts/landing";
import { REFINE_SYSTEM, refineSectionPrompt } from "@/ai/prompts/landing-refine";
import { EMAILS_SYSTEM, emailsPrompt } from "@/ai/prompts/emails";
import { ADS_SYSTEM, adsPrompt } from "@/ai/prompts/ads";
import { TELEGRAM_SYSTEM, telegramPrompt, TELEGRAM_REFINE_SYSTEM, telegramRefinePrompt } from "@/ai/prompts/telegram";
import { BRAND_KIT_SYSTEM, brandKitPrompt } from "@/ai/prompts/brand-kit";
import { DESIGN_REVIEW_SYSTEM, designReviewPrompt, DESIGN_FIX_SYSTEM, designFixPrompt } from "@/ai/prompts/design-review";
import { REFERENCE_SITE_SYSTEM, referenceSitePrompt } from "@/ai/prompts/reference-site";
import { normalizeSectionValue, normalizeSectionDesign } from "@/components/public/landing-types";
import type { LandingBody, LandingSectionKey, LandingCardStyle } from "@/components/public/landing-types";

import { generateImage, isImageGenConfigured } from "@/integrations/image-gen";
import { isUnsplashConfigured, searchUnsplashPhotos } from "@/integrations/unsplash";
import { captureScreenshot, captureExternalScreenshot, isDesignReviewConfigured } from "@/integrations/screenshot";

import type { LaunchType, AvatarBrief, BrandPalette, BrandFonts, Launch } from "@/db/schema/launches";
import type { DesignReviewIssue } from "@/db/schema/assets";
import { resolvePages, pagePath, type PageConfig, type PageDef, type LegalPageKey } from "@/lib/launch-pages";
import {
  getActiveCampaignClientForOrg,
} from "@/integrations/activecampaign";

import {
  isTelegramConfigured,
  connectTelegramGroup,
  sendMessage as sendTelegramMessage,
  registerWebhook,
} from "@/integrations/telegram";

import {
  REGISTRO_SYSTEM,
  registroPrompt,
  CONTENIDO_SYSTEM,
  contenidoPrompt,
  LEGAL_SYSTEM,
  legalPrompt,
  AFILIADOS_SYSTEM,
  afiliadosPrompt,
} from "@/ai/prompts/page-kinds";

import { milestones } from "@/db/schema";
import { generateMilestones as buildMilestones } from "@/lib/milestone-templates";
import { CALENDAR_ANALYSIS_SYSTEM, calendarAnalysisPrompt } from "@/ai/prompts/calendar";
import { COUNTRIES } from "@/lib/milestone-templates";
import type { AiWarning } from "@/db/schema/milestones";

/** Loads a launch, scoped to the acting admin's organization. */
async function getOrgLaunch(launchId: string, organizationId: string) {
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

/**
 * Resolves an imagePrompt into a real image URL: tries Magnific (on-brand AI
 * generation) first, then falls back to an Unsplash search on the same prompt
 * if Magnific isn't configured or fails — so a landing always gets real
 * images without the admin having to fill each slot by hand.
 */
async function autoResolveImage(prompt: string | undefined | null): Promise<string | undefined> {
  const q = prompt?.trim();
  if (!q) return undefined;

  if (isImageGenConfigured()) {
    try {
      return await generateImage(q);
    } catch (err) {
      console.error("auto image generation failed, falling back to Unsplash", err);
    }
  }

  if (isUnsplashConfigured()) {
    const [photo] = await searchUnsplashPhotos(q, 1);
    if (photo) return photo.regularUrl;
  }

  return undefined;
}

const VALID_CARD_STYLES: LandingCardStyle[] = ["glass", "flat", "outline", "soft"];

/**
 * Post-generation visual QA: screenshots the page that was just written to
 * the DB (mobile + desktop) and asks Claude to look at it like a picky
 * client. The only thing it's allowed to fix itself is the box style — a
 * mechanical, always-safe lever; everything else comes back as a warning for
 * the admin to read and decide on. Never throws — a failure here must never
 * block the landing itself, which already exists by the time this runs.
 */
async function runDesignReview(path: string, assetId: string, body: LandingBody): Promise<void> {
  if (!isDesignReviewConfigured()) return;

  try {
    const [mobile, desktop] = await Promise.all([
      captureScreenshot(path, { width: 390, height: 844 }),
      captureScreenshot(path, { width: 1440, height: 900 }),
    ]);

    const currentCardStyle: LandingCardStyle = body.style?.cardStyle ?? "glass";

    const { text } = await completeWithImages({
      system: DESIGN_REVIEW_SYSTEM,
      prompt: designReviewPrompt(currentCardStyle),
      images: [mobile, desktop],
      maxTokens: 1200,
    });

    const parsed = extractJson(text) as {
      issues?: Array<{ description: string }>;
      autoFixCardStyle?: LandingCardStyle | null;
    };

    const issues: DesignReviewIssue[] = (parsed.issues ?? []).map((i) => ({
      severity: "warning" as const,
      description: i.description,
    }));

    let updatedBody = body;
    const autoFix = parsed.autoFixCardStyle;
    if (autoFix && VALID_CARD_STYLES.includes(autoFix) && autoFix !== currentCardStyle) {
      updatedBody = { ...body, style: { ...body.style, cardStyle: autoFix } };
      issues.unshift({
        severity: "auto_fixed",
        description: `Estilo de caja cambiado de "${currentCardStyle}" a "${autoFix}" — no encajaba bien con esta paleta.`,
      });
    }

    await db
      .update(assets)
      .set({
        body: updatedBody as Record<string, unknown>,
        designReview: { issues, reviewedAt: new Date().toISOString() },
        updatedAt: new Date(),
      })
      .where(eq(assets.id, assetId));
  } catch (err) {
    console.error("design review failed", err);
  }
}

/**
 * Best-effort: screenshots a reference URL the client likes and has Claude
 * describe its structure/tone (never colors — the Brand Kit always wins on
 * that) to steer `landingPrompt()`. Returns null on any failure so it never
 * blocks generation.
 */
async function analyzeReferenceUrl(url: string): Promise<string | null> {
  if (!isDesignReviewConfigured()) return null;

  try {
    const screenshot = await captureExternalScreenshot(url, { width: 1440, height: 2400, fullPage: true });
    const { text } = await completeWithImages({
      system: REFERENCE_SITE_SYSTEM,
      prompt: referenceSitePrompt(),
      images: [screenshot],
      maxTokens: 600,
    });
    return text.trim() || null;
  } catch (err) {
    console.error("reference site analysis failed", err);
    return null;
  }
}

const createSchema = z.object({
  name: z.string().min(2),
  type: z.enum(["venta_directa", "semilla", "plf"]),
  brief: z.string().min(20),
  priceCents: z.coerce.number().int().min(0).optional(),
  referenceUrl: z.string().url().optional().or(z.literal("")),
});

export async function createLaunchAction(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();

  const parsed = createSchema.parse({
    name: formData.get("name"),
    type: formData.get("type"),
    brief: formData.get("brief"),
    priceCents: formData.get("priceCents") || undefined,
    referenceUrl: formData.get("referenceUrl") || undefined,
  });

  let slug = createSlug(parsed.name);
  if (!slug) slug = `lanzamiento-${Date.now().toString(36)}`;

  // Avoid slug collisions
  const [existing] = await db.select().from(launches).where(eq(launches.slug, slug)).limit(1);
  if (existing) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const legalPages: LegalPageKey[] = [];
  if (formData.get("legalPrivacidad")) legalPages.push("privacidad");
  if (formData.get("legalTerminos")) legalPages.push("terminos");
  if (formData.get("legalCookies")) legalPages.push("cookies");

  const registroChannels = String(formData.get("registroChannels") ?? "")
    .split("\n")
    .map((c) => c.trim())
    .filter(Boolean);

  const pageConfig: PageConfig = {
    registroChannels: registroChannels.length > 0 ? registroChannels : undefined,
    contentPageCount: Number(formData.get("contentPageCount") ?? 4) === 3 ? 3 : 4,
    includeAffiliateRegistro: formData.get("includeAffiliateRegistro") === "on",
    legalPages,
  };

  const contentDripRaw = String(formData.get("contentDripStartsAt") ?? "").trim();

  await db.insert(launches).values({
    organizationId,
    slug,
    contentDripStartsAt: contentDripRaw ? new Date(contentDripRaw) : null,
    name: parsed.name,
    type: parsed.type as LaunchType,
    status: "draft",
    brief: parsed.brief,
    defaultPriceCents: parsed.priceCents ?? null,
    referenceUrl: parsed.referenceUrl || null,
    pageConfig,
  });

  revalidatePath("/admin");
  redirect(`/admin/lanzamientos/${slug}`);
}

export async function updateReferenceUrlAction(launchId: string, formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await getOrgLaunch(launchId, organizationId);

  const raw = String(formData.get("referenceUrl") ?? "").trim();
  if (raw) z.string().url().parse(raw);

  await db
    .update(launches)
    .set({ referenceUrl: raw || null, updatedAt: new Date() })
    .where(eq(launches.id, launchId));

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

export async function updateCartScheduleAction(launchId: string, formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await getOrgLaunch(launchId, organizationId);

  const raw = String(formData.get("cartClosesAt") ?? "").trim();
  const cartClosesAt = raw ? new Date(raw) : null;

  await db
    .update(launches)
    .set({ cartClosesAt, updatedAt: new Date() })
    .where(eq(launches.id, launchId));

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

export async function updateContentDripScheduleAction(launchId: string, formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await getOrgLaunch(launchId, organizationId);

  const raw = String(formData.get("contentDripStartsAt") ?? "").trim();
  const contentDripStartsAt = raw ? new Date(raw) : null;

  await db
    .update(launches)
    .set({ contentDripStartsAt, updatedAt: new Date() })
    .where(eq(launches.id, launchId));

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

export async function generateBrandKitAction(launchId: string) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await getOrgLaunch(launchId, organizationId);
  if (!launch.brief) throw new Error("brief_missing");

  const { text } = await complete({
    system: BRAND_KIT_SYSTEM,
    prompt: brandKitPrompt({
      name: launch.name,
      type: launch.type,
      brief: launch.brief,
      promise: launch.promise,
    }),
    temperature: 0.8,
  });

  const json = extractJson(text) as {
    palette: BrandPalette;
    fonts: BrandFonts;
    moodNotes: string;
    imageMoodPrompt: string;
  };

  let moodImageUrl: string | null = null;
  if (isImageGenConfigured()) {
    try {
      moodImageUrl = await generateImage(json.imageMoodPrompt);
    } catch (err) {
      console.error("brand kit mood image generation failed", err);
    }
  }

  await db
    .update(launches)
    .set({
      brandPalette: json.palette,
      brandFonts: json.fonts,
      brandMoodNotes: json.moodNotes,
      brandMoodImageUrl: moodImageUrl,
      brandKitStatus: "draft",
      updatedAt: new Date(),
    })
    .where(eq(launches.id, launchId));

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

const updateBrandKitSchema = z.object({
  primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  foreground: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  displayFont: z.string().min(1),
  bodyFont: z.string().min(1),
  moodNotes: z.string().optional(),
});

export async function updateBrandKitAction(launchId: string, formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await getOrgLaunch(launchId, organizationId);

  const parsed = updateBrandKitSchema.parse({
    primary: formData.get("primary"),
    accent: formData.get("accent"),
    background: formData.get("background"),
    foreground: formData.get("foreground"),
    displayFont: formData.get("displayFont"),
    bodyFont: formData.get("bodyFont"),
    moodNotes: formData.get("moodNotes") || undefined,
  });

  await db
    .update(launches)
    .set({
      brandPalette: {
        primary: parsed.primary,
        accent: parsed.accent,
        background: parsed.background,
        foreground: parsed.foreground,
      },
      brandFonts: { display: parsed.displayFont, body: parsed.bodyFont },
      brandMoodNotes: parsed.moodNotes ?? launch.brandMoodNotes,
      // Editing a draft doesn't un-approve it silently — but any manual edit
      // after approval means it needs a fresh look before it counts as approved again.
      brandKitStatus: launch.brandKitStatus === "approved" ? "draft" : launch.brandKitStatus,
      updatedAt: new Date(),
    })
    .where(eq(launches.id, launchId));

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

export async function approveBrandKitAction(launchId: string) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await getOrgLaunch(launchId, organizationId);
  if (!launch.brandPalette || !launch.brandFonts) throw new Error("brand_kit_incomplete");

  await db
    .update(launches)
    .set({ brandKitStatus: "approved", updatedAt: new Date() })
    .where(eq(launches.id, launchId));

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

export async function updateBrandLogoAction(launchId: string, formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await getOrgLaunch(launchId, organizationId);

  const imageUrl = String(formData.get("imageUrl") ?? "").trim() || null;

  await db
    .update(launches)
    .set({ brandLogoUrl: imageUrl, updatedAt: new Date() })
    .where(eq(launches.id, launchId));

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

export async function generateMarcoCopyAction(launchId: string) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await getOrgLaunch(launchId, organizationId);
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
  const launch = await getOrgLaunch(launchId, organizationId);

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

type PageGenCtx = {
  organizationId: string;
  userId: string;
  launchProducts: Array<{ slug: string; name: string; priceCents: number; currency: string }>;
  referenceSummary: string | null;
};

async function insertPageAsset(
  launch: Launch,
  pageDef: PageDef,
  ctx: PageGenCtx,
  body: Record<string, unknown>,
): Promise<{ id: string }> {
  const [inserted] = await db
    .insert(assets)
    .values({
      organizationId: ctx.organizationId,
      launchId: launch.id,
      kind: "landing",
      pageKey: pageDef.pageKey,
      title: `${pageDef.label} · ${launch.name}`,
      body,
      generatedByAi: env.ANTHROPIC_MODEL,
      authorId: ctx.userId,
    })
    .returning();
  return inserted;
}

async function generateVentaPage(launch: Launch, pageDef: PageDef, ctx: PageGenCtx) {
  const { text } = await complete({
    system: LANDING_SYSTEM,
    prompt: landingPrompt(
      launch.name,
      launch.avatar as AvatarBrief,
      launch.promise!,
      launch.painPoints ?? [],
      launch.benefits ?? [],
      { palette: launch.brandPalette!, fonts: launch.brandFonts! },
      launch.landingGeneralInstructions,
      ctx.launchProducts,
      ctx.referenceSummary,
    ),
    maxTokens: 8000,
    temperature: 0.7,
  });

  const body = extractJson(text) as LandingBody;

  if (isImageGenConfigured() || isUnsplashConfigured()) {
    const [heroImageUrl, creatorImageUrl, includeImageUrls, speakerImageUrls] = await Promise.all([
      autoResolveImage(body.hero?.imagePrompt),
      typeof body.about === "object" ? autoResolveImage(body.about.creatorImagePrompt) : Promise.resolve(undefined),
      Promise.all((body.includes ?? []).map((it) => autoResolveImage(it.imagePrompt))),
      Promise.all((body.speakers ?? []).map((s) => autoResolveImage(s.imagePrompt))),
    ]);

    if (heroImageUrl && body.hero) body.hero.imageUrl = heroImageUrl;
    if (creatorImageUrl && typeof body.about === "object") body.about.creatorImageUrl = creatorImageUrl;
    body.includes?.forEach((it, i) => {
      if (includeImageUrls[i]) it.imageUrl = includeImageUrls[i];
    });
    body.speakers?.forEach((s, i) => {
      if (speakerImageUrls[i]) s.imageUrl = speakerImageUrls[i];
    });
  }

  const inserted = await insertPageAsset(launch, pageDef, ctx, body as Record<string, unknown>);
  await runDesignReview(pagePath(launch.slug, pageDef), inserted.id, body);
}

async function generateRegistroPage(launch: Launch, pageDef: PageDef, ctx: PageGenCtx) {
  const channel = pageDef.label.startsWith("Registro — ") ? pageDef.label.replace("Registro — ", "") : "General";

  const { text } = await complete({
    system: REGISTRO_SYSTEM,
    prompt: registroPrompt(launch.name, launch.avatar as AvatarBrief, launch.promise!, channel),
    maxTokens: 2000,
    temperature: 0.7,
  });

  const body = extractJson(text) as { headline?: string; subheadline?: string; bullets?: string[]; cta?: string; imagePrompt?: string; imageUrl?: string };

  if (isImageGenConfigured() || isUnsplashConfigured()) {
    const imageUrl = await autoResolveImage(body.imagePrompt);
    if (imageUrl) body.imageUrl = imageUrl;
  }

  const inserted = await insertPageAsset(launch, pageDef, ctx, body as Record<string, unknown>);
  await runDesignReview(pagePath(launch.slug, pageDef), inserted.id, body as LandingBody);
}

async function generateContenidoPage(launch: Launch, pageDef: PageDef, ctx: PageGenCtx) {
  const match = /^contenido-(\d+)$/.exec(pageDef.pageKey);
  const index = match ? Number(match[1]) : 1;
  const total = launch.pageConfig?.contentPageCount ?? 1;

  const { text } = await complete({
    system: CONTENIDO_SYSTEM,
    prompt: contenidoPrompt(launch.name, launch.avatar as AvatarBrief, launch.promise!, launch.benefits ?? [], index, total),
    maxTokens: 3000,
    temperature: 0.7,
  });

  const body = extractJson(text) as { headline?: string; body?: string; ctaLabel?: string; imagePrompt?: string; imageUrl?: string };

  if (isImageGenConfigured() || isUnsplashConfigured()) {
    const imageUrl = await autoResolveImage(body.imagePrompt);
    if (imageUrl) body.imageUrl = imageUrl;
  }

  await insertPageAsset(launch, pageDef, ctx, body as Record<string, unknown>);
}

async function generateLegalPage(launch: Launch, pageDef: PageDef, ctx: PageGenCtx, orgName: string) {
  const legalKey = pageDef.pageKey.replace("legal-", "") as LegalPageKey;

  const { text } = await complete({
    system: LEGAL_SYSTEM,
    prompt: legalPrompt(orgName, legalKey, launch.name),
    maxTokens: 3000,
    temperature: 0.4,
  });

  const body = extractJson(text) as { title?: string; content?: string };
  await insertPageAsset(launch, pageDef, ctx, body as Record<string, unknown>);
}

async function generateAfiliadosPage(launch: Launch, pageDef: PageDef, ctx: PageGenCtx) {
  const { text } = await complete({
    system: AFILIADOS_SYSTEM,
    prompt: afiliadosPrompt(launch.name, launch.promise!, launch.affiliateCommissionRate ?? 3000),
    maxTokens: 1500,
    temperature: 0.7,
  });

  const body = extractJson(text) as { headline?: string; pitch?: string; commissionNote?: string };
  await insertPageAsset(launch, pageDef, ctx, body as Record<string, unknown>);
}

async function generateSinglePage(launch: Launch, pageDef: PageDef, ctx: PageGenCtx, orgName: string) {
  if (pageDef.kind === "venta") return generateVentaPage(launch, pageDef, ctx);
  if (pageDef.kind === "registro") return generateRegistroPage(launch, pageDef, ctx);
  if (pageDef.kind === "contenido") return generateContenidoPage(launch, pageDef, ctx);
  if (pageDef.kind === "legal") return generateLegalPage(launch, pageDef, ctx, orgName);
  if (pageDef.kind === "afiliados") return generateAfiliadosPage(launch, pageDef, ctx);
}

/** Runs a handful of async jobs at a time instead of all at once (Claude/
 * Magnific/screenshot-service would choke on 10-14 concurrent calls) or
 * fully sequentially (too slow for a PLF's worth of pages). */
async function runInBatches<T>(items: T[], batchSize: number, fn: (item: T) => Promise<unknown>) {
  const results: PromiseSettledResult<unknown>[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    results.push(...(await Promise.allSettled(batch.map(fn))));
  }
  return results;
}

async function sharedPageGenContext(launch: Launch, organizationId: string, userId: string): Promise<PageGenCtx> {
  const [launchProducts, referenceSummary] = await Promise.all([
    db.select().from(products).where(and(eq(products.launchId, launch.id), eq(products.active, true))),
    launch.referenceUrl ? analyzeReferenceUrl(launch.referenceUrl) : Promise.resolve(null),
  ]);
  return {
    organizationId,
    userId,
    launchProducts: launchProducts.map((p) => ({ slug: p.slug, name: p.name, priceCents: p.priceCents, currency: p.currency })),
    referenceSummary,
  };
}

/** Generates every page this launch's type/config calls for, in one pass. */
export async function generateAllPagesAction(launchId: string) {
  const { user, organizationId } = await requireOrgAdmin();
  const launch = await getOrgLaunch(launchId, organizationId);
  if (!launch.promise || !launch.avatar) throw new Error("marco_copy_missing");
  if (launch.brandKitStatus !== "approved" || !launch.brandPalette || !launch.brandFonts) {
    throw new Error("brand_kit_not_approved");
  }

  const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  const ctx = await sharedPageGenContext(launch, organizationId, user.id);
  const pages = resolvePages(launch.type as LaunchType, launch.pageConfig);

  const results = await runInBatches(pages, 3, (pageDef) => generateSinglePage(launch, pageDef, ctx, org?.name ?? launch.name));
  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length > 0) console.error(`generateAllPagesAction: ${failed.length}/${pages.length} pages failed`, failed);

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

/** Regenerates a single already-existing (or not-yet-existing) page. */
export async function regenerateSinglePageAction(launchId: string, pageKey: string) {
  const { user, organizationId } = await requireOrgAdmin();
  const launch = await getOrgLaunch(launchId, organizationId);
  if (!launch.promise || !launch.avatar) throw new Error("marco_copy_missing");
  if (launch.brandKitStatus !== "approved" || !launch.brandPalette || !launch.brandFonts) {
    throw new Error("brand_kit_not_approved");
  }

  const pageDef = resolvePages(launch.type as LaunchType, launch.pageConfig).find((p) => p.pageKey === pageKey);
  if (!pageDef) throw new Error("page_not_found");

  const [org] = await db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  const ctx = await sharedPageGenContext(launch, organizationId, user.id);
  await generateSinglePage(launch, pageDef, ctx, org?.name ?? launch.name);

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

export async function updatePageBodyAction(launchId: string, pageKey: string, formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await getOrgLaunch(launchId, organizationId);

  const raw = String(formData.get("json") ?? "{}");
  const body = JSON.parse(raw) as Record<string, unknown>;

  await db
    .update(assets)
    .set({ body, updatedAt: new Date() })
    .where(and(eq(assets.launchId, launchId), eq(assets.kind, "landing"), eq(assets.pageKey, pageKey)));

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

/**
 * Applies the design-review warnings that CAN be fixed from the page's own
 * JSON (long copy, box style, section order/removal) and re-runs the review
 * on the result. Anything CSS-level stays as a warning — see DESIGN_FIX_SYSTEM.
 */
export async function applyDesignFixesAction(launchId: string, pageKey: string) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await getOrgLaunch(launchId, organizationId);

  const [asset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.launchId, launchId), eq(assets.kind, "landing"), eq(assets.pageKey, pageKey)))
    .orderBy(desc(assets.createdAt))
    .limit(1);
  if (!asset) throw new Error("page_not_found");

  const issues = (asset.designReview?.issues ?? [])
    .filter((i) => i.severity === "warning")
    .map((i) => i.description);
  if (issues.length === 0) return;

  const { text } = await complete({
    system: DESIGN_FIX_SYSTEM,
    prompt: designFixPrompt(JSON.stringify(asset.body, null, 2), issues),
    maxTokens: 8000,
    temperature: 0.3,
  });

  const fixedBody = extractJson(text) as LandingBody;

  await db
    .update(assets)
    .set({ body: fixedBody as Record<string, unknown>, updatedAt: new Date() })
    .where(eq(assets.id, asset.id));

  const pageDef = resolvePages(launch.type as LaunchType, launch.pageConfig).find((p) => p.pageKey === pageKey);
  if (pageDef) await runDesignReview(pagePath(launch.slug, pageDef), asset.id, fixedBody);

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

export async function updateLandingInstructionsAction(launchId: string, formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await getOrgLaunch(launchId, organizationId);

  const instructions = String(formData.get("instructions") ?? "").trim() || null;

  await db
    .update(launches)
    .set({ landingGeneralInstructions: instructions, updatedAt: new Date() })
    .where(eq(launches.id, launchId));

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

export async function generateEmailsAction(launchId: string) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await getOrgLaunch(launchId, organizationId);
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
  const launch = await getOrgLaunch(launchId, organizationId);
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
  const launch = await getOrgLaunch(launchId, organizationId);

  const priceCents = Number(formData.get("priceCents"));
  const currency = String(formData.get("currency") ?? "EUR").toLowerCase();
  const name = String(formData.get("name") ?? launch.name);
  const description = String(formData.get("description") ?? launch.promise ?? "");
  // Only needed once there's more than one tier — keeps single-price launches
  // (the common case) exactly as before, with slug === launch.slug.
  const tierKey = String(formData.get("tierKey") ?? "").trim();

  if (!Number.isFinite(priceCents) || priceCents <= 0) {
    throw new Error("invalid_price");
  }

  const existingCount = await db.select().from(products).where(eq(products.launchId, launchId));
  const slug = tierKey ? `${launch.slug}--${createSlug(tierKey)}` : launch.slug;

  const stripe = await getStripeClientForOrg(organizationId);

  const stripeProduct = await stripe.products.create({
    name,
    description: description || undefined,
    metadata: { launch_id: launchId, launch_slug: launch.slug, tier_key: tierKey || "" },
  });

  const stripePrice = await stripe.prices.create({
    product: stripeProduct.id,
    unit_amount: priceCents,
    currency,
  });

  await db.insert(products).values({
    organizationId,
    slug,
    name,
    description: description || null,
    launchId,
    priceCents,
    currency: currency.toUpperCase(),
    stripePriceId: stripePrice.id,
    stripeProductId: stripeProduct.id,
    active: true,
  });

  // The launch's own defaultPriceCents represents "the" price shown before
  // any product exists — only meaningful for the first tier.
  if (existingCount.length === 0) {
    await db
      .update(launches)
      .set({ defaultPriceCents: priceCents, currency: currency.toUpperCase(), updatedAt: new Date() })
      .where(eq(launches.id, launchId));
  }

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

export async function deleteStripeProductAction(launchId: string, formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await getOrgLaunch(launchId, organizationId);
  const productId = String(formData.get("productId") ?? "");

  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.launchId, launchId)))
    .limit(1);
  if (!product) throw new Error("product_not_found");

  // Archive in Stripe rather than delete — existing orders still reference
  // this price/product and must keep resolving correctly.
  const stripe = await getStripeClientForOrg(organizationId);
  await stripe.prices.update(product.stripePriceId!, { active: false }).catch(() => {});
  if (product.stripeProductId) {
    await stripe.products.update(product.stripeProductId, { active: false }).catch(() => {});
  }

  await db.update(products).set({ active: false, updatedAt: new Date() }).where(eq(products.id, productId));

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

export async function provisionActiveCampaignAction(launchId: string) {
  const { organizationId } = await requireOrgAdmin();
  const ac = await getActiveCampaignClientForOrg(organizationId);
  if (!ac) throw new Error("activecampaign_not_configured");

  const launch = await getOrgLaunch(launchId, organizationId);

  const publicUrl = `${env.APP_URL}/${launch.slug}`;
  const { listId, tagIds } = await ac.provisionLaunchInAc({
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
  const ac = await getActiveCampaignClientForOrg(organizationId);
  if (!ac) throw new Error("activecampaign_not_configured");

  const launch = await getOrgLaunch(launchId, organizationId);

  const [asset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.id, assetId), eq(assets.organizationId, organizationId)))
    .limit(1);
  if (!asset || asset.kind !== "email") throw new Error("asset_not_found");

  const sequence = asset.body as { emails: Array<{ subject: string; preheader?: string; body: string }> };

  const templateIds: string[] = [];
  for (let i = 0; i < sequence.emails.length; i++) {
    const email = sequence.emails[i];
    if (!email) continue;
    const tpl = await ac.createEmailTemplate({
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
  const ac = await getActiveCampaignClientForOrg(organizationId);
  if (!ac) throw new Error("activecampaign_not_configured");

  const launch = await getOrgLaunch(launchId, organizationId);
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
  const existing = await ac.findCampaignsByPrefix(launch.slug);
  for (const c of existing) {
    if (c.status === 0) {
      await ac.deleteCampaign(c.id).catch(() => {});
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

    const campaign = await ac.createCampaign({
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
  const launch = await getOrgLaunch(launchId, organizationId);

  const [asset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.launchId, launchId), eq(assets.kind, "landing")))
    .orderBy(desc(assets.createdAt))
    .limit(1);

  return { launch, asset };
}

async function saveLandingBody(
  launchId: string,
  organizationId: string,
  slug: string,
  body: LandingBody,
  authorId: string | null,
) {
  await db.insert(assets).values({
    organizationId,
    launchId,
    kind: "landing",
    title: `Landing`,
    body: body as unknown as Record<string, unknown>,
    authorId: authorId ?? undefined,
  });
  revalidatePath(`/admin/lanzamientos/${slug}`);
  revalidatePath(`/${slug}`);
}

export async function refineLandingSectionAction(
  launchId: string,
  section: LandingSectionKey,
  formData: FormData,
) {
  const { user, organizationId } = await requireOrgAdmin();
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

  const parsed = extractJson(text) as Record<string, unknown>;

  // The model may answer either as `{ content, design }` (the current contract)
  // or as the bare section value (older behaviour, and what it still does when
  // the instruction is purely textual). Accept both.
  const hasEnvelope =
    parsed && typeof parsed === "object" && !Array.isArray(parsed) && "content" in parsed;
  const rawContent = hasEnvelope ? parsed.content : parsed;
  const rawDesign = hasEnvelope ? parsed.design : undefined;

  // Validate before storing: a wrapped or invented shape here is what breaks
  // the public page later, far from its cause.
  const updated = normalizeSectionValue(section, rawContent);
  const newBody: LandingBody = { ...body, [section]: updated };

  // Anything outside the closed design vocabulary is dropped here, not stored.
  const design = normalizeSectionDesign(rawDesign);
  if (design) {
    // A photo background is useless without an actual image, so resolve it now
    // with the same Magnific → Unsplash path the rest of the generator uses.
    if (design.background === "photo" && !design.imageUrl && design.imagePrompt) {
      const imageUrl = await autoResolveImage(design.imagePrompt);
      if (imageUrl) design.imageUrl = imageUrl;
      else design.background = "tint"; // don't leave an empty photo band
    }
    newBody.sectionDesign = { ...(body.sectionDesign ?? {}), [section]: design };
  }

  await saveLandingBody(launchId, organizationId, launch.slug, newBody, user.id);
}

/** Deterministic counterpart to the refine box: the dropdowns in the section
 * editor, for when you know exactly what you want and don't want to rely on
 * the model interpreting it. */
export async function updateSectionDesignAction(
  launchId: string,
  section: LandingSectionKey,
  formData: FormData,
) {
  const { user, organizationId } = await requireOrgAdmin();
  const { launch, asset } = await loadLandingAsset(launchId, organizationId);
  const body = (asset?.body ?? {}) as LandingBody;

  const design = normalizeSectionDesign({
    background: formData.get("background"),
    effect: formData.get("effect"),
    height: formData.get("height"),
    width: formData.get("width"),
    // Keep whatever image/orbit data the section already had.
    imageUrl: body.sectionDesign?.[section]?.imageUrl,
    imagePrompt: body.sectionDesign?.[section]?.imagePrompt,
    orbitItems: body.sectionDesign?.[section]?.orbitItems,
  });

  const nextDesign = { ...(body.sectionDesign ?? {}) };
  if (design) {
    if (design.background === "photo" && !design.imageUrl) {
      const prompt = design.imagePrompt ?? `Fotografía de fondo para "${launch.name}"`;
      const imageUrl = await autoResolveImage(prompt);
      if (imageUrl) design.imageUrl = imageUrl;
      else design.background = "tint";
    }
    // Orbit with no items would render an empty ring — seed it from the launch.
    if (design.effect === "orbit" && !design.orbitItems?.length) {
      const seeds = (launch.benefits ?? []).slice(0, 6).map((b) => ({ label: b.split(" ").slice(0, 3).join(" ") }));
      if (seeds.length >= 3) design.orbitItems = seeds;
      else design.effect = "aurora";
    }
    nextDesign[section] = design;
  } else {
    delete nextDesign[section];
  }

  await saveLandingBody(
    launchId,
    organizationId,
    launch.slug,
    { ...body, sectionDesign: nextDesign },
    user.id,
  );
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
  const { user, organizationId } = await requireOrgAdmin();
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

  await saveLandingBody(launchId, organizationId, launch.slug, newBody, user.id);
}

export async function updateSectionRawAction(
  launchId: string,
  section: LandingSectionKey,
  formData: FormData,
) {
  const { user, organizationId } = await requireOrgAdmin();
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

  await saveLandingBody(launchId, organizationId, launch.slug, newBody, user.id);
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

  const launch = await getOrgLaunch(launchId, organizationId);
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
  const launch = await getOrgLaunch(launchId, organizationId);

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
  const launch = await getOrgLaunch(launchId, organizationId);

  if (!launch.telegramChatId) throw new Error("telegram_not_connected");

  await sendTelegramMessage(
    launch.telegramChatId,
    `✅ <b>Conexion de prueba</b>\n\nEl bot esta conectado al lanzamiento <b>${launch.name}</b>.`,
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
  const launch = await getOrgLaunch(launchId, organizationId);
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
  const launch = await getOrgLaunch(launchId, organizationId);

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
  const launch = await getOrgLaunch(launchId, organizationId);

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
  const launch = await getOrgLaunch(launchId, organizationId);

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
  const launch = await getOrgLaunch(launchId, organizationId);

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

export async function updateLaunchCountryAction(launchId: string, formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await getOrgLaunch(launchId, organizationId);

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
  const launch = await getOrgLaunch(launchId, organizationId);

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

  const launch = await getOrgLaunch(milestone.launchId, organizationId);

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
  const launch = await getOrgLaunch(launchId, organizationId);

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
