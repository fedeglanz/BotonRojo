"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, and, desc, count as sqlCount } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import {
  launches,
  assets,
  products,
  organizations,
  trackingEvents,
  orders,
} from "@/db/schema";
import { requireOrgAdmin } from "@/lib/auth-helpers";
import { createSlug } from "@/lib/ids";
import { env } from "@/lib/env";
import { complete, completeWithImages } from "@/lib/ai";
import { getStripeClientForOrg } from "@/lib/stripe";

import { MARCO_COPY_SYSTEM, marcoCopyPrompt } from "@/ai/prompts/marco-copy";
import { LANDING_SYSTEM, landingPrompt } from "@/ai/prompts/landing";
import {
  REFINE_SYSTEM,
  refineSectionPrompt,
} from "@/ai/prompts/landing-refine";
import { EMAILS_SYSTEM, emailsPrompt } from "@/ai/prompts/emails";
import {
  EMAIL_REFINE_SYSTEM,
  emailRefinePrompt,
} from "@/ai/prompts/email-refine";
import { ADS_SYSTEM, adsPrompt } from "@/ai/prompts/ads";
import {
  TELEGRAM_SYSTEM,
  telegramPrompt,
  TELEGRAM_REFINE_SYSTEM,
  telegramRefinePrompt,
} from "@/ai/prompts/telegram";
import { BRAND_KIT_SYSTEM, brandKitPrompt } from "@/ai/prompts/brand-kit";
import {
  DESIGN_REVIEW_SYSTEM,
  designReviewPrompt,
  DESIGN_FIX_SYSTEM,
  designFixPrompt,
} from "@/ai/prompts/design-review";
import {
  REFERENCE_SITE_SYSTEM,
  referenceSitePrompt,
} from "@/ai/prompts/reference-site";
import {
  PAGE_FIELD_REFINE_SYSTEM,
  pageFieldRefinePrompt,
} from "@/ai/prompts/page-field-refine";
import {
  auditPageContrast,
  describeContrastFailures,
} from "@/lib/design/contrast-audit";
import {
  describeBrandDesign,
  normalizeBrandDesign,
} from "@/lib/design/brand-design";
import {
  normalizeSectionValue,
  LAYOUT_PRESETS,
} from "@/components/public/landing-types";
import {
  applyBrandRhythm,
  normalizeSectionDesign,
  resolveSectionDesign,
  SECTION_KIND_BY_KEY,
} from "@/components/public/section-design";
import type {
  AfiliadosPageBody,
  ContenidoPageBody,
  PageBlock,
  RegistroPageBody,
} from "@/components/public/page-bodies";
import type { SectionDesign } from "@/components/public/landing-types";
import type {
  LandingBody,
  LandingSectionKey,
  LandingCardStyle,
  SectionDesignKey,
} from "@/components/public/landing-types";

import {
  asStyleReference,
  generateImage,
  isImageGenConfigured,
  type ImageSlot,
} from "@/integrations/image-gen";
import {
  isUnsplashConfigured,
  searchUnsplashPhotos,
} from "@/integrations/unsplash";
import { trimLogo } from "@/integrations/logo";
import {
  captureScreenshot,
  captureExternalScreenshot,
  isDesignReviewConfigured,
} from "@/integrations/screenshot";

import { LAUNCH_TYPE_KEYS } from "@/lib/launch-types";
import { isCustomEmailBody } from "@/lib/custom-email";
import type {
  LaunchType,
  AvatarBrief,
  BrandPalette,
  BrandFonts,
  Launch,
} from "@/db/schema/launches";
import type { DesignReviewIssue } from "@/db/schema/assets";
import type { PageSeo } from "@/db/schema/launches";
import {
  resolvePages,
  pagePath,
  pageConfigFromFormData,
  type PageConfig,
  type PageDef,
  type LegalPageKey,
} from "@/lib/launch-pages";
import { seedLaunchQueue } from "@/server/launch-tasks";
import { bodyFromFields, fieldsForKind } from "@/lib/page-fields";
import { getActiveCampaignClientForOrg } from "@/integrations/activecampaign";

import {
  getTelegramToken,
  connectTelegramGroup,
  sendMessage as sendTelegramMessage,
  registerWebhook,
} from "@/integrations/telegram";

import {
  GRACIAS_SYSTEM,
  BAJA_SYSTEM,
  graciasPrompt,
  bajaPrompt,
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
import {
  CALENDAR_ANALYSIS_SYSTEM,
  calendarAnalysisPrompt,
} from "@/ai/prompts/calendar";
import { COUNTRIES } from "@/lib/milestone-templates";
import type { AiWarning } from "@/db/schema/milestones";

/** Loads a launch, scoped to the acting admin's organization. */
async function getOrgLaunch(launchId: string, organizationId: string) {
  const [launch] = await db
    .select()
    .from(launches)
    .where(
      and(
        eq(launches.id, launchId),
        eq(launches.organizationId, organizationId),
      ),
    )
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
/**
 * Everything an image needs to belong to this launch rather than merely sit in
 * it: where it's going (shape, model, resolution), the approved palette as colour
 * guidance, the art direction, and the mood image as a style reference so the
 * whole set looks like one shoot.
 */
type ImageContext = {
  slot: ImageSlot;
  palette?: BrandPalette | null;
  moodNotes?: string | null;
  styleReference?: string | null;
};

async function autoResolveImage(
  prompt: string | undefined | null,
  context: ImageContext = { slot: "hero" },
): Promise<string | undefined> {
  const q = prompt?.trim();
  if (!q) return undefined;

  if (isImageGenConfigured()) {
    try {
      return await generateImage(q, {
        slot: context.slot,
        palette: context.palette,
        moodNotes: context.moodNotes,
        styleReference: context.styleReference,
      });
    } catch (err) {
      console.error(
        "auto image generation failed, falling back to Unsplash",
        err,
      );
    }
  }

  if (isUnsplashConfigured()) {
    const [photo] = await searchUnsplashPhotos(q, 1);
    if (photo) return photo.regularUrl;
  }

  return undefined;
}

/**
 * The launch's own art direction, resolved once per generation. The mood image is
 * fetched as base64 here rather than per image: it's the same reference for all
 * of them, and downloading it a dozen times would be wasteful.
 */
async function imageContextFor(
  launch: Launch,
  slot: ImageSlot,
): Promise<ImageContext> {
  return {
    slot,
    palette: launch.brandPalette,
    moodNotes: launch.brandMoodNotes,
    styleReference: await asStyleReference(launch.brandMoodImageUrl),
  };
}

const VALID_CARD_STYLES: LandingCardStyle[] = [
  "glass",
  "liquid",
  "flat",
  "outline",
  "soft",
  "brutal",
  "editorial",
];

/**
 * Post-generation visual QA: screenshots the page that was just written to
 * the DB (mobile + desktop) and asks Claude to look at it like a picky
 * client. The only thing it's allowed to fix itself is the box style — a
 * mechanical, always-safe lever; everything else comes back as a warning for
 * the admin to read and decide on. Never throws — a failure here must never
 * block the landing itself, which already exists by the time this runs.
 */
async function runDesignReview(
  launch: Launch,
  pageDef: PageDef,
  assetId: string,
  body: Record<string, unknown>,
  /** Measured before any screenshot, so they're stored even with no service. */
  extraIssues: DesignReviewIssue[] = [],
): Promise<void> {
  const path = pagePath(launch.slug, pageDef);

  const audit = auditPageContrast({
    palette: launch.brandPalette,
    cardStyle:
      (body.style as { cardStyle?: string } | undefined)?.cardStyle ??
      launch.brandDesign?.cardStyle,
    ctaStyle:
      (body.style as { ctaStyle?: string } | undefined)?.ctaStyle ??
      launch.brandDesign?.ctaStyle,
    sectionDesign: (body.sectionDesign ??
      (body.design as { blocks?: unknown })?.blocks) as never,
  });
  const measured = describeContrastFailures(audit);

  const measuredIssues: DesignReviewIssue[] = measured.map((description) => ({
    severity: "warning" as const,
    description,
  }));

  if (!isDesignReviewConfigured()) {
    await db
      .update(assets)
      .set({
        designReview: {
          issues: [...extraIssues, ...measuredIssues],
          reviewedAt: new Date().toISOString(),
          worstContrast: audit.worst,
        },
        updatedAt: new Date(),
      })
      .where(eq(assets.id, assetId));
    return;
  }

  try {
    const [mobile, desktop] = await Promise.all([
      captureScreenshot(path, { width: 390, height: 844 }),
      captureScreenshot(path, { width: 1440, height: 900 }),
    ]);

    const currentCardStyle: LandingCardStyle =
      ((body.style as { cardStyle?: LandingCardStyle } | undefined)
        ?.cardStyle ??
        launch.brandDesign?.cardStyle) ||
      "glass";

    const { text } = await completeWithImages({
      system: DESIGN_REVIEW_SYSTEM,
      prompt: designReviewPrompt({
        pageLabel: pageDef.label,
        cardStyle: currentCardStyle,
        ctaStyle:
          (body.style as { ctaStyle?: string } | undefined)?.ctaStyle ??
          launch.brandDesign?.ctaStyle,
        design: body.sectionDesign ?? body.design,
        measuredContrast: measured,
      }),
      images: [mobile, desktop],
      maxTokens: 2000,
    });

    const parsed = extractJson(text) as {
      issues?: Array<{
        severity?: string;
        description: string;
        where?: string;
      }>;
      suggestedInstruction?: string;
      autoFixCardStyle?: LandingCardStyle | null;
    };

    const issues: DesignReviewIssue[] = [
      ...extraIssues,
      ...measuredIssues,
      ...(parsed.issues ?? []).map((i) => ({
        severity:
          i.severity === "critical"
            ? ("critical" as const)
            : ("warning" as const),
        description: i.description,
        where: i.where,
      })),
    ];

    let updatedBody = body;
    const autoFix = parsed.autoFixCardStyle;
    if (
      autoFix &&
      VALID_CARD_STYLES.includes(autoFix) &&
      autoFix !== currentCardStyle
    ) {
      updatedBody = {
        ...body,
        style: { ...(body.style as object), cardStyle: autoFix },
      };
      issues.unshift({
        severity: "auto_fixed",
        description: `Estilo de caja cambiado de "${currentCardStyle}" a "${autoFix}" — no encajaba bien con esta paleta.`,
      });
    }

    await db
      .update(assets)
      .set({
        body: updatedBody,
        designReview: {
          issues,
          reviewedAt: new Date().toISOString(),
          suggestedInstruction:
            parsed.suggestedInstruction?.trim() || undefined,
          worstContrast: audit.worst,
        },
        updatedAt: new Date(),
      })
      .where(eq(assets.id, assetId));
  } catch (err) {
    console.error("design review failed", err);
    // A failed review still records what arithmetic found, and says it failed
    // rather than leaving the previous result looking current.
    await db
      .update(assets)
      .set({
        designReview: {
          issues: [
            ...extraIssues,
            ...measuredIssues,
            {
              severity: "warning" as const,
              description:
                "La inspección visual falló (no se pudieron tomar las capturas). Lo medido sí es válido.",
            },
          ],
          reviewedAt: new Date().toISOString(),
          worstContrast: audit.worst,
        },
        updatedAt: new Date(),
      })
      .where(eq(assets.id, assetId));
  }
}

/**
 * Inspects one page on demand: takes fresh screenshots, measures its contrast and
 * reports what to fix. Available on every page, and re-runnable — the old review
 * only happened at generation, so it went stale as soon as anything was edited.
 */
export async function reviewPageDesignAction(
  launchId: string,
  pageKey: string,
) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await getOrgLaunch(launchId, organizationId);

  const pageDef = resolvePages(
    launch.type as LaunchType,
    launch.pageConfig,
  ).find((p) => p.pageKey === pageKey);
  if (!pageDef) throw new Error("page_not_found");

  const [asset] = await db
    .select()
    .from(assets)
    .where(
      and(
        eq(assets.launchId, launchId),
        eq(assets.kind, "landing"),
        eq(assets.pageKey, pageKey),
      ),
    )
    .orderBy(desc(assets.createdAt))
    .limit(1);
  if (!asset) throw new Error("Genera la página antes de revisarla.");

  await runDesignReview(
    launch,
    pageDef,
    asset.id,
    (asset.body ?? {}) as Record<string, unknown>,
  );

  revalidatePath(`/admin/lanzamientos/${launch.slug}/paginas/${pageKey}`);
}

/**
 * Takes the reviewer's own suggested brief and regenerates the page with it —
 * turning a list of complaints into one click.
 */
export async function applyReviewSuggestionAction(
  launchId: string,
  pageKey: string,
) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await getOrgLaunch(launchId, organizationId);

  const [asset] = await db
    .select()
    .from(assets)
    .where(
      and(
        eq(assets.launchId, launchId),
        eq(assets.kind, "landing"),
        eq(assets.pageKey, pageKey),
      ),
    )
    .orderBy(desc(assets.createdAt))
    .limit(1);

  const suggestion = (
    asset?.designReview as { suggestedInstruction?: string } | null
  )?.suggestedInstruction;
  if (!suggestion)
    throw new Error("La revisión no propuso ningún cambio que aplicar.");

  const form = new FormData();
  form.set("instruction", suggestion);
  await regenerateSinglePageAction(launchId, pageKey, form);
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
    const screenshot = await captureExternalScreenshot(url, {
      width: 1440,
      height: 2400,
      fullPage: true,
    });
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

/**
 * Prices arrive as euros with decimals, because that's how anybody thinks about a
 * price — the form used to ask for cents in steps of 100, so "97,50 €" was not
 * expressible and "9700" was what you had to type.
 *
 * The multiplication is rounded on purpose: `39.99 * 100` is 3998.9999999999995 in
 * floating point, and truncating that undercharges by a cent.
 */
const euroAmount = z
  .string()
  .trim()
  .transform((raw) => raw.replace(",", "."))
  .pipe(z.coerce.number().min(0).max(1_000_000))
  .transform((euros) => Math.round(euros * 100));

const createSchema = z.object({
  name: z.string().min(2),
  // De LAUNCH_TYPE_KEYS, no a mano: esta lista escrita dos veces es lo que hizo
  // que crear una newsletter fallara con un error de validación.
  type: z.enum(LAUNCH_TYPE_KEYS),
  brief: z.string().min(20),
  priceCents: euroAmount.optional(),
  installmentCount: z.coerce.number().int().min(2).max(24).optional(),
  installmentPriceCents: euroAmount.optional(),
  referenceUrl: z.string().url().optional().or(z.literal("")),
  // La casilla del formulario: quién diseña este lanzamiento.
  designMode: z.enum(["boton_rojo", "claude"]).default("boton_rojo"),
});

export async function createLaunchAction(formData: FormData) {
  const { organizationId } = await requireOrgAdmin();

  const parsed = createSchema.parse({
    name: formData.get("name"),
    type: formData.get("type"),
    brief: formData.get("brief"),
    priceCents: formData.get("price") || undefined,
    installmentCount: formData.get("installmentCount") || undefined,
    installmentPriceCents: formData.get("installmentPrice") || undefined,
    referenceUrl: formData.get("referenceUrl") || undefined,
    designMode:
      formData.get("designMode") === "claude" ? "claude" : "boton_rojo",
  });

  // Half a payment plan is worse than none: the copy would promise instalments
  // whose amount nobody set, or an amount with no number of payments.
  const hasPlan =
    parsed.installmentCount !== undefined &&
    parsed.installmentPriceCents !== undefined;

  let slug = createSlug(parsed.name);
  if (!slug) slug = `lanzamiento-${Date.now().toString(36)}`;

  // Avoid slug collisions
  const [existing] = await db
    .select()
    .from(launches)
    .where(eq(launches.slug, slug))
    .limit(1);
  if (existing) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const pageConfig: PageConfig = pageConfigFromFormData(formData);

  const contentDripRaw = String(
    formData.get("contentDripStartsAt") ?? "",
  ).trim();

  const [created] = await db
    .insert(launches)
    .values({
      organizationId,
      slug,
      contentDripStartsAt: contentDripRaw ? new Date(contentDripRaw) : null,
      name: parsed.name,
      type: parsed.type as LaunchType,
      status: "draft",
      brief: parsed.brief,
      defaultPriceCents: parsed.priceCents ?? null,
      installmentCount: hasPlan ? parsed.installmentCount! : null,
      installmentPriceCents: hasPlan ? parsed.installmentPriceCents! : null,
      designMode: parsed.designMode,
      referenceUrl: parsed.referenceUrl || null,
      pageConfig,
    })
    .returning({ id: launches.id });

  if (created && parsed.designMode === "claude") {
    // Diseña Claude: en vez de proponer nosotros una identidad que iba a sustituir,
    // se deja escrito el trabajo. Un mensaje en Claude recorre la cola entera.
    const [launch] = await db
      .select()
      .from(launches)
      .where(eq(launches.id, created.id))
      .limit(1);
    if (launch) {
      await seedLaunchQueue(launch).catch((err: unknown) => {
        console.error("no se pudo escribir la cola de trabajo", err);
      });

      // El marco de copy sí lo generamos nosotros, aunque diseñe Claude: la
      // promesa, el avatar, los dolores y los beneficios salen del brief y no son
      // una decisión de diseño. Sin ellos, Claude tiene que parar a mitad a
      // preguntar de qué va el lanzamiento — que es exactamente lo que pasó la
      // primera vez que se usó esto.
      //
      // En segundo plano, como la identidad: ver el comentario de abajo.
      void generateMarcoCopyAction(created.id).catch((err: unknown) => {
        console.error("marco de copy inicial (modo claude) falló", err);
      });
    }
  } else if (created) {
    // Propose the visual identity straight away: it's the mandatory first step, so
    // landing on an empty one just means an extra click before anything can happen.
    //
    // Pero NO se espera. Esta es una llamada a un modelo y tarda lo que tarda —
    // medido en producción, 46 segundos—, y mientras no vuelva el formulario sigue
    // en pantalla: pasó lo previsible, alguien volvió a pulsar el botón y se creó
    // el lanzamiento dos veces. Creado el lanzamiento, la pantalla cambia ya; la
    // propuesta aterriza sola en el panel unos segundos después.
    //
    // Sin await pero con catch: un fallo aquí no puede tumbar la creación de un
    // lanzamiento que ya existe, y sin catch sería una promesa rechazada suelta.
    void generateBrandKitAction(created.id).catch((err: unknown) => {
      console.error("initial brand kit proposal failed", err);
    });
  }

  revalidatePath("/admin");
  redirect(`/admin/lanzamientos/${slug}`);
}

export async function updateReferenceUrlAction(
  launchId: string,
  formData: FormData,
) {
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

export async function updateCartScheduleAction(
  launchId: string,
  formData: FormData,
) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await getOrgLaunch(launchId, organizationId);

  const raw = String(formData.get("cartClosesAt") ?? "").trim();
  const cartClosesAt = raw ? new Date(raw) : null;
  const rawRegistration = String(
    formData.get("registrationClosesAt") ?? "",
  ).trim();
  const registrationClosesAt = rawRegistration
    ? new Date(rawRegistration)
    : null;

  await db
    .update(launches)
    .set({ cartClosesAt, registrationClosesAt, updatedAt: new Date() })
    .where(eq(launches.id, launchId));

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
  // The public pages read these dates for their countdown bar, so they have to be
  // revalidated too: saving a date and seeing nothing change on the live page reads
  // as the date not having been saved.
  for (const pageDef of resolvePages(
    launch.type as LaunchType,
    launch.pageConfig,
  )) {
    revalidatePath(pagePath(launch.slug, pageDef));
  }
}

export async function updateContentDripScheduleAction(
  launchId: string,
  formData: FormData,
) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await getOrgLaunch(launchId, organizationId);

  const raw = String(formData.get("contentDripStartsAt") ?? "").trim();
  const contentDripStartsAt = raw ? new Date(raw) : null;

  await db
    .update(launches)
    .set({ contentDripStartsAt, updatedAt: new Date() })
    .where(eq(launches.id, launchId));

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
  // Same reason as the cart date: this one decides which content pages are still
  // locked, so a stale public page would keep gating content that has opened.
  for (const pageDef of resolvePages(
    launch.type as LaunchType,
    launch.pageConfig,
  )) {
    revalidatePath(pagePath(launch.slug, pageDef));
  }
}

/**
 * Saves the brief.
 *
 * It was only ever written on the creation form, and everything downstream reads
 * it: the brand kit, the copy frame, every page. A launch that arrived without one
 * had no way back — the generate buttons threw `brief_missing`, which reached the
 * client as a blank error page with a digest and no way to act on it.
 */
export async function updateBriefAction(launchId: string, formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await getOrgLaunch(launchId, organizationId);

  const brief = String(formData.get("brief") ?? "").trim();
  // Same floor as the creation form: below that there is nothing to generate from.
  if (brief.length < 20) throw new Error("brief_demasiado_corto");

  await db
    .update(launches)
    .set({ brief, updatedAt: new Date() })
    .where(eq(launches.id, launch.id));

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

/**
 * Price and payment plan, editable after creation.
 *
 * Same lesson as the brief: a field only writable on the creation form is a field
 * nobody can fix. Prices change, and the instalment plan is usually decided later
 * than the launch itself.
 */
export async function updatePricingPlanAction(
  launchId: string,
  formData: FormData,
) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await getOrgLaunch(launchId, organizationId);

  const parsed = z
    .object({
      price: euroAmount.optional(),
      installmentCount: z.coerce.number().int().min(2).max(24).optional(),
      installmentPrice: euroAmount.optional(),
    })
    .parse({
      price: formData.get("price") || undefined,
      installmentCount: formData.get("installmentCount") || undefined,
      installmentPrice: formData.get("installmentPrice") || undefined,
    });

  // Both halves or neither: a count with no amount would have the copy promise
  // instalments nobody priced.
  const hasPlan =
    parsed.installmentCount !== undefined &&
    parsed.installmentPrice !== undefined;

  await db
    .update(launches)
    .set({
      defaultPriceCents: parsed.price ?? launch.defaultPriceCents,
      installmentCount: hasPlan ? parsed.installmentCount! : null,
      installmentPriceCents: hasPlan ? parsed.installmentPrice! : null,
      updatedAt: new Date(),
    })
    .where(eq(launches.id, launch.id));

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
    design?: unknown;
    moodNotes: string;
    imageMoodPrompt: string;
  };

  let moodImageUrl: string | null = null;
  if (isImageGenConfigured()) {
    try {
      moodImageUrl = await generateImage(json.imageMoodPrompt, {
        slot: "hero",
        palette: json.palette,
        moodNotes: json.moodNotes,
      });
    } catch (err) {
      console.error("brand kit mood image generation failed", err);
    }
  }

  await db
    .update(launches)
    .set({
      brandPalette: json.palette,
      brandFonts: json.fonts,
      // Validated against the closed catalogues, and corrected for the palette:
      // the proposal decides the design of every page, so an invented value here
      // would spread to all of them.
      brandDesign: normalizeBrandDesign(json.design, json.palette),
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

export async function updateBrandKitAction(
  launchId: string,
  formData: FormData,
) {
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

  const palette: BrandPalette = {
    primary: parsed.primary,
    accent: parsed.accent,
    background: parsed.background,
    foreground: parsed.foreground,
  };

  // The design decisions come from the same form, validated against the closed
  // catalogues — the selects can only offer valid values, but the action is what
  // has to guarantee it.
  const design = normalizeBrandDesign(
    {
      cardStyle: formData.get("cardStyle"),
      ctaStyle: formData.get("ctaStyle"),
      density: formData.get("density"),
      titleFx: formData.get("titleFx"),
      divider: formData.get("divider"),
      intensity: formData.get("intensity"),
      effects: formData.getAll("effects").map(String),
    },
    palette,
  );

  await db
    .update(launches)
    .set({
      brandPalette: palette,
      brandFonts: { display: parsed.displayFont, body: parsed.bodyFont },
      brandDesign: design,
      brandMoodNotes: parsed.moodNotes ?? launch.brandMoodNotes,
      // Editing a draft doesn't un-approve it silently — but any manual edit
      // after approval means it needs a fresh look before it counts as approved again.
      brandKitStatus:
        launch.brandKitStatus === "approved" ? "draft" : launch.brandKitStatus,
      updatedAt: new Date(),
    })
    .where(eq(launches.id, launchId));

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

export async function approveBrandKitAction(launchId: string) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await getOrgLaunch(launchId, organizationId);
  if (!launch.brandPalette || !launch.brandFonts)
    throw new Error("brand_kit_incomplete");

  await db
    .update(launches)
    .set({ brandKitStatus: "approved", updatedAt: new Date() })
    .where(eq(launches.id, launchId));

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

export async function updateBrandLogoAction(
  launchId: string,
  formData: FormData,
) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await getOrgLaunch(launchId, organizationId);

  const imageUrl = String(formData.get("imageUrl") ?? "").trim() || null;

  // Trim the transparent padding now, once, rather than fighting it with CSS on
  // every page that shows the logo. See integrations/logo.ts for why.
  let stored = imageUrl;
  let logoMeta: {
    logoAspect: number;
    logoInk: { dark: number; mid: number; light: number };
  } | null = null;
  if (imageUrl) {
    const trimmed = await trimLogo(imageUrl);
    if (trimmed) {
      stored = trimmed.url;
      logoMeta = { logoAspect: trimmed.aspect, logoInk: trimmed.ink };
    }
  }

  const cache = (launch.assetsCache ?? {}) as Record<string, unknown>;
  await db
    .update(launches)
    .set({
      brandLogoUrl: stored,
      // Remembered so the layout can give a stacked logo more room than a
      // horizontal lockup, and put a plate behind it when its ink is too close in
      // value to the page's own surface to be readable.
      assetsCache: logoMeta ? { ...cache, ...logoMeta } : cache,
      updatedAt: new Date(),
    })
    .where(eq(launches.id, launchId));

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

export async function generateMarcoCopyAction(
  launchId: string,
  formData?: FormData,
) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await getOrgLaunch(launchId, organizationId);
  if (!launch.brief) throw new Error("brief_missing");

  // Regenerating without being able to say what to change means rolling the dice
  // and hoping for something better. Remembered per launch, like the per-page
  // briefs, so a second pass builds on the first instead of starting over.
  const cache = (launch.assetsCache ?? {}) as Record<string, unknown>;
  const typed = formData
    ? String(formData.get("instruction") ?? "").trim()
    : "";
  const instruction =
    typed ||
    (typeof cache.marcoInstruction === "string"
      ? cache.marcoInstruction
      : null);

  if (typed !== (cache.marcoInstruction ?? "")) {
    const next = { ...cache };
    if (typed) next.marcoInstruction = typed;
    else delete next.marcoInstruction;
    await db
      .update(launches)
      .set({ assetsCache: next, updatedAt: new Date() })
      .where(eq(launches.id, launchId));
  }

  const { text } = await complete({
    system: MARCO_COPY_SYSTEM,
    prompt: marcoCopyPrompt(launch.brief, instruction),
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

export async function updateMarcoCopyAction(
  launchId: string,
  formData: FormData,
) {
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
  launchProducts: Array<{
    slug: string;
    name: string;
    priceCents: number;
    currency: string;
  }>;
  referenceSummary: string | null;
  /** What the admin typed next to the regenerate button for this page. Beats the
   *  launch-wide instructions, because it's the more specific of the two. */
  pageInstruction?: string | null;
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

async function generateVentaPage(
  launch: Launch,
  pageDef: PageDef,
  ctx: PageGenCtx,
) {
  const { text } = await complete({
    system: LANDING_SYSTEM,
    prompt: landingPrompt(
      launch.name,
      launch.avatar as AvatarBrief,
      launch.promise!,
      launch.painPoints ?? [],
      launch.benefits ?? [],
      {
        palette: launch.brandPalette!,
        fonts: launch.brandFonts!,
        moodNotes: launch.brandMoodNotes,
        design: launch.brandDesign,
      },
      [launch.landingGeneralInstructions, ctx.pageInstruction]
        .filter(Boolean)
        .join("\n\n") || null,
      ctx.launchProducts,
      ctx.referenceSummary,
      launch.installmentCount && launch.installmentPriceCents
        ? {
            count: launch.installmentCount,
            priceCents: launch.installmentPriceCents,
            currency: launch.currency ?? "EUR",
          }
        : null,
    ),
    maxTokens: 8000,
    temperature: 0.7,
  });

  const body = extractJson(text) as LandingBody;

  // ---- Design of the bands -------------------------------------------------
  //
  // Two things had to change here. The model was the only source of section
  // design, and it returned `background: "none", effect: "none"` for everything —
  // a flat page — because whoever writes the copy has no view of the page as a
  // whole. And whatever it left unset was filled with generic defaults, which
  // silently threw away the design system the brand kit had just approved.
  //
  // So: the approved system is the baseline, the rhythm is composed
  // deterministically, and the model's own choices still win over both.
  const brand = launch.brandDesign;
  const sectionOrder = (
    body.sectionOrder?.length
      ? body.sectionOrder
      : (LAYOUT_PRESETS[launch.type as LaunchType] ?? LAYOUT_PRESETS.plf)
  ) as SectionDesignKey[];
  const orderWithEnds: SectionDesignKey[] = [
    "hero",
    ...sectionOrder,
    "finalCta",
  ];

  const contentLength: Partial<Record<SectionDesignKey, number>> = {};
  for (const key of orderWithEnds) {
    contentLength[key] = JSON.stringify(
      body[key as keyof LandingBody] ?? "",
    ).length;
  }

  const composed = applyBrandRhythm(
    orderWithEnds,
    brand,
    body.sectionDesign ?? {},
    contentLength,
  );

  const clean: NonNullable<LandingBody["sectionDesign"]> = {};
  for (const [key, raw] of Object.entries(composed)) {
    const sectionKey = key as SectionDesignKey;
    const kind = SECTION_KIND_BY_KEY[sectionKey];
    if (!kind) continue;

    // Validated against the closed vocabulary before storing: the same path that
    // once let an invented `background: {type:"parallax"}` reach the DB and take
    // the public page down.
    const { design } = normalizeSectionDesign(raw, {
      kind,
      contentLength: contentLength[sectionKey],
      brand: brand
        ? {
            cardStyle: brand.cardStyle,
            titleFx: brand.titleFx,
            density: brand.density,
            divider: brand.divider,
          }
        : null,
    });
    if (!design) continue;

    if (
      design.background === "photo" &&
      !design.imageUrl &&
      design.imagePrompt
    ) {
      const imageUrl = await autoResolveImage(
        design.imagePrompt,
        await imageContextFor(launch, "band"),
      );
      if (imageUrl) design.imageUrl = imageUrl;
      else design.background = "tint";
    }
    clean[sectionKey] = design;
  }
  body.sectionDesign = Object.keys(clean).length > 0 ? clean : undefined;

  // The box and CTA treatments come from the approved system unless the model
  // deliberately chose otherwise.
  if (brand) {
    body.style = {
      cardStyle: body.style?.cardStyle ?? brand.cardStyle,
      ctaStyle: body.style?.ctaStyle ?? brand.ctaStyle,
    };
  }

  if (isImageGenConfigured() || isUnsplashConfigured()) {
    // The model sometimes omits imagePrompt entirely — it reads the design
    // rules' "nothing decorative" line as "no photos". A landing with no hero
    // image looks unfinished, so derive one instead of shipping without it.
    if (body.hero && !body.hero.imagePrompt && !body.hero.imageUrl) {
      body.hero.imagePrompt =
        `Fotografía editorial para "${launch.name}": ${launch.promise ?? ""}`.trim();
    }

    // Resolved once and shared: same palette, same art direction, same style
    // reference for every image on the page.
    const [heroCtx, portraitCtx, cardCtx] = await Promise.all([
      imageContextFor(launch, "hero"),
      imageContextFor(launch, "portrait"),
      imageContextFor(launch, "card"),
    ]);

    const [heroImageUrl, creatorImageUrl, includeImageUrls, speakerImageUrls] =
      await Promise.all([
        autoResolveImage(body.hero?.imagePrompt, heroCtx),
        // A face, in portrait: asking for a person at 16:9 is what produced the
        // cropped headshots.
        typeof body.about === "object"
          ? autoResolveImage(body.about.creatorImagePrompt, portraitCtx)
          : Promise.resolve(undefined),
        Promise.all(
          (body.includes ?? []).map((it) =>
            autoResolveImage(it.imagePrompt, cardCtx),
          ),
        ),
        Promise.all(
          (body.speakers ?? []).map((sp) =>
            autoResolveImage(sp.imagePrompt, portraitCtx),
          ),
        ),
      ]);

    if (heroImageUrl && body.hero) body.hero.imageUrl = heroImageUrl;
    if (creatorImageUrl && typeof body.about === "object")
      body.about.creatorImageUrl = creatorImageUrl;
    body.includes?.forEach((it, i) => {
      if (includeImageUrls[i]) it.imageUrl = includeImageUrls[i];
    });
    body.speakers?.forEach((s, i) => {
      if (speakerImageUrls[i]) s.imageUrl = speakerImageUrls[i];
    });
  }

  // Contrast is checked by arithmetic, not by eye: every box, button and band the
  // page will paint, against the text that goes on it. A page that fails AA says
  // so in the panel instead of shipping quietly.
  const audit = auditPageContrast({
    palette: launch.brandPalette,
    cardStyle: body.style?.cardStyle,
    ctaStyle: body.style?.ctaStyle,
    sectionDesign: body.sectionDesign,
  });
  const contrastIssues: DesignReviewIssue[] = describeContrastFailures(
    audit,
  ).map((description) => ({
    severity: "warning" as const,
    description,
  }));

  const inserted = await insertPageAsset(
    launch,
    pageDef,
    ctx,
    body as Record<string, unknown>,
  );
  await runDesignReview(
    launch,
    pageDef,
    inserted.id,
    body as Record<string, unknown>,
    contrastIssues,
  );
}

/**
 * Validates the composable blocks and band design of a non-landing page, and
 * resolves the images the blocks ask for.
 *
 * Same principle as the landing sections: the vocabulary is closed, so a block
 * type or a design value the renderer can't paint is dropped here rather than
 * stored and discovered later on the public page.
 */
async function normalizePageComposition(
  launch: Launch,
  body: {
    blocks?: unknown;
    design?: { hero?: unknown; blocks?: unknown[] } | unknown;
  },
  /**
   * What the hero band actually is. A capture page's hero is a FORM band: its job
   * is the form, and `form` capabilities rule out the orbit and a photo backdrop
   * for exactly that reason. Normalising it as a generic hero let the orbit
   * through, and the orbit forces a narrow column — which squeezed the two-column
   * hero into a strip one word wide.
   */
  heroKind: "form" | "hero" = "hero",
): Promise<void> {
  const brand = launch.brandDesign;
  const brandDefaults = brand
    ? {
        cardStyle: brand.cardStyle,
        titleFx: brand.titleFx,
        density: brand.density,
        divider: brand.divider,
      }
    : null;

  // ---- blocks
  const raw = Array.isArray(body.blocks) ? body.blocks : [];
  const blocks: PageBlock[] = [];

  for (const item of raw.slice(0, 5)) {
    if (!item || typeof item !== "object") continue;
    const b = item as Record<string, unknown>;

    if (b.type === "benefits" && Array.isArray(b.items)) {
      const items = b.items
        .filter(
          (i): i is Record<string, unknown> =>
            Boolean(i) && typeof i === "object",
        )
        .map((i) => ({
          icon: typeof i.icon === "string" ? i.icon : undefined,
          title: String(i.title ?? "").trim(),
          text: typeof i.text === "string" ? i.text.trim() : undefined,
        }))
        .filter((i) => i.title.length > 0)
        .slice(0, 6);
      if (items.length >= 2)
        blocks.push({
          type: "benefits",
          title: typeof b.title === "string" ? b.title : undefined,
          items,
        });
      continue;
    }

    if (b.type === "steps" && Array.isArray(b.items)) {
      const items = b.items
        .filter(
          (i): i is Record<string, unknown> =>
            Boolean(i) && typeof i === "object",
        )
        .map((i) => ({
          title: String(i.title ?? "").trim(),
          text: typeof i.text === "string" ? i.text.trim() : undefined,
        }))
        .filter((i) => i.title.length > 0)
        .slice(0, 6);
      if (items.length >= 2)
        blocks.push({
          type: "steps",
          title: typeof b.title === "string" ? b.title : undefined,
          items,
        });
      continue;
    }

    if (b.type === "imageText") {
      const block: Extract<PageBlock, { type: "imageText" }> = {
        type: "imageText",
        title: typeof b.title === "string" ? b.title : undefined,
        text: typeof b.text === "string" ? b.text : undefined,
        ctaLabel: typeof b.ctaLabel === "string" ? b.ctaLabel : undefined,
        imagePrompt:
          typeof b.imagePrompt === "string" ? b.imagePrompt : undefined,
        imageSide: b.imageSide === "right" ? "right" : "left",
      };
      // A card-shaped image beside text, not a hero: 4:5 rather than 16:9.
      if (block.imagePrompt) {
        const url = await autoResolveImage(
          block.imagePrompt,
          await imageContextFor(launch, "card"),
        );
        if (url) block.imageUrl = url;
      }
      if (block.title || block.text) blocks.push(block);
    }
  }

  (body as { blocks?: PageBlock[] }).blocks =
    blocks.length > 0 ? blocks : undefined;

  // ---- band design, hero + one per block
  const rawDesign = (body.design ?? {}) as {
    hero?: unknown;
    blocks?: unknown[];
  };
  const design: { hero?: SectionDesign; blocks?: SectionDesign[] } = {};

  const heroResult = normalizeSectionDesign(rawDesign.hero, {
    kind: heroKind,
    brand: brandDefaults,
  });
  if (heroResult.design) {
    if (
      heroResult.design.background === "photo" &&
      !heroResult.design.imageUrl &&
      heroResult.design.imagePrompt
    ) {
      const url = await autoResolveImage(
        heroResult.design.imagePrompt,
        await imageContextFor(launch, "band"),
      );
      if (url) heroResult.design.imageUrl = url;
      else heroResult.design.background = "tint";
    }
    // Always the page's first band, so it can't carry a divider.
    heroResult.design.divider = "none";
    design.hero = heroResult.design;

    // A photo floating beside the form on top of an already-decorated band is
    // noise competing with the one thing that has to stand out.
    //
    // This overrides the model rather than deferring to it: asked for a dark hero
    // with an effect, it still set hideHeroImage to false and put the photo back.
    // On a form band the form is the subject — that's a property of the band, not
    // a preference to negotiate.
    const decorated =
      heroResult.design.background !== "none" ||
      heroResult.design.effect !== "none";
    if (decorated) (body as { hideHeroImage?: boolean }).hideHeroImage = true;
  }

  if (blocks.length > 0) {
    const perBlock: SectionDesign[] = [];
    for (let i = 0; i < blocks.length; i++) {
      const kind =
        blocks[i]!.type === "benefits"
          ? "cards"
          : blocks[i]!.type === "steps"
            ? "list"
            : "media";
      const { design: d } = normalizeSectionDesign(
        Array.isArray(rawDesign.blocks) ? rawDesign.blocks[i] : undefined,
        {
          kind,
          brand: brandDefaults,
        },
      );
      if (!d) continue;
      if (d.background === "photo" && !d.imageUrl && d.imagePrompt) {
        const url = await autoResolveImage(
          d.imagePrompt,
          await imageContextFor(launch, "band"),
        );
        if (url) d.imageUrl = url;
        else d.background = "tint";
      }
      perBlock[i] = d;
    }
    if (perBlock.length > 0) design.blocks = perBlock;
  }

  (body as { design?: typeof design }).design =
    design.hero || design.blocks ? design : undefined;
}

async function generateRegistroPage(
  launch: Launch,
  pageDef: PageDef,
  ctx: PageGenCtx,
) {
  const channel = pageDef.label.startsWith("Registro — ")
    ? pageDef.label.replace("Registro — ", "")
    : "General";

  const { text } = await complete({
    system: REGISTRO_SYSTEM,
    prompt: registroPrompt(
      launch.name,
      launch.avatar as AvatarBrief,
      launch.promise!,
      channel,
      ctx.pageInstruction,
    ),
    maxTokens: 2000,
    temperature: 0.7,
  });

  const body = extractJson(text) as RegistroPageBody;

  if (isImageGenConfigured() || isUnsplashConfigured()) {
    const imageUrl = await autoResolveImage(
      body.imagePrompt,
      await imageContextFor(launch, "hero"),
    );
    if (imageUrl) body.imageUrl = imageUrl;
  }

  // Blocks and band design, validated and with their images resolved.
  await normalizePageComposition(launch, body, "form");

  const inserted = await insertPageAsset(
    launch,
    pageDef,
    ctx,
    body as Record<string, unknown>,
  );
  await runDesignReview(
    launch,
    pageDef,
    inserted.id,
    body as Record<string, unknown>,
  );
}

/**
 * Gracias y baja: las dos páginas de servicio de una newsletter.
 *
 * Comparten generador porque comparten forma —un titular, un subtítulo, unas viñetas
 * y un botón— y se diferencian en el prompt y en si llevan foto. La de baja no la
 * lleva: es una página de servicio, y una foto de archivo ahí solo estorba a quien
 * quiere irse.
 */
async function generateServicePage(
  launch: Launch,
  pageDef: PageDef,
  ctx: PageGenCtx,
) {
  const esBaja = pageDef.kind === "baja";

  const { text } = await complete({
    system: esBaja ? BAJA_SYSTEM : GRACIAS_SYSTEM,
    prompt: esBaja
      ? bajaPrompt(launch.name, launch.promise!, ctx.pageInstruction)
      : graciasPrompt(
          launch.name,
          launch.avatar as AvatarBrief,
          launch.promise!,
          ctx.pageInstruction,
        ),
    maxTokens: 1500,
    temperature: 0.6,
  });

  const body = extractJson(text) as RegistroPageBody;

  if (!esBaja && (isImageGenConfigured() || isUnsplashConfigured())) {
    const imageUrl = await autoResolveImage(
      body.imagePrompt,
      await imageContextFor(launch, "hero"),
    );
    if (imageUrl) body.imageUrl = imageUrl;
  }

  // La de gracias es una banda de formulario como la de registro —el botón de
  // descarga es su protagonista—; la de baja, una banda normal.
  await normalizePageComposition(launch, body, esBaja ? "hero" : "form");

  const inserted = await insertPageAsset(
    launch,
    pageDef,
    ctx,
    body as Record<string, unknown>,
  );
  await runDesignReview(
    launch,
    pageDef,
    inserted.id,
    body as Record<string, unknown>,
  );
}

async function generateContenidoPage(
  launch: Launch,
  pageDef: PageDef,
  ctx: PageGenCtx,
) {
  const match = /^contenido-(\d+)$/.exec(pageDef.pageKey);
  const index = match ? Number(match[1]) : 1;
  const total = launch.pageConfig?.contentPageCount ?? 1;

  const { text } = await complete({
    system: CONTENIDO_SYSTEM,
    prompt: contenidoPrompt(
      launch.name,
      launch.avatar as AvatarBrief,
      launch.promise!,
      launch.benefits ?? [],
      index,
      total,
      ctx.pageInstruction,
    ),
    maxTokens: 3000,
    temperature: 0.7,
  });

  const body = extractJson(text) as ContenidoPageBody;

  if (isImageGenConfigured() || isUnsplashConfigured()) {
    const imageUrl = await autoResolveImage(
      body.imagePrompt,
      await imageContextFor(launch, "hero"),
    );
    if (imageUrl) body.imageUrl = imageUrl;
  }

  await normalizePageComposition(launch, body);

  await insertPageAsset(launch, pageDef, ctx, body as Record<string, unknown>);
}

async function generateLegalPage(
  launch: Launch,
  pageDef: PageDef,
  ctx: PageGenCtx,
  orgName: string,
) {
  const legalKey = pageDef.pageKey.replace("legal-", "") as LegalPageKey;

  const { text } = await complete({
    system: LEGAL_SYSTEM,
    prompt: legalPrompt(orgName, legalKey, launch.name, ctx.pageInstruction),
    maxTokens: 3000,
    temperature: 0.4,
  });

  const body = extractJson(text) as { title?: string; content?: string };
  await insertPageAsset(launch, pageDef, ctx, body as Record<string, unknown>);
}

async function generateAfiliadosPage(
  launch: Launch,
  pageDef: PageDef,
  ctx: PageGenCtx,
) {
  const { text } = await complete({
    system: AFILIADOS_SYSTEM,
    prompt: afiliadosPrompt(
      launch.name,
      launch.promise!,
      launch.affiliateCommissionRate ?? 3000,
      ctx.pageInstruction,
    ),
    maxTokens: 1500,
    temperature: 0.7,
  });

  const body = extractJson(text) as AfiliadosPageBody;
  await normalizePageComposition(launch, body);

  await insertPageAsset(launch, pageDef, ctx, body as Record<string, unknown>);
}

async function generateSinglePage(
  launch: Launch,
  pageDef: PageDef,
  ctx: PageGenCtx,
  orgName: string,
) {
  if (pageDef.kind === "venta") return generateVentaPage(launch, pageDef, ctx);
  if (pageDef.kind === "registro")
    return generateRegistroPage(launch, pageDef, ctx);
  if (pageDef.kind === "contenido")
    return generateContenidoPage(launch, pageDef, ctx);
  if (pageDef.kind === "legal")
    return generateLegalPage(launch, pageDef, ctx, orgName);
  if (pageDef.kind === "afiliados")
    return generateAfiliadosPage(launch, pageDef, ctx);
  if (pageDef.kind === "gracias" || pageDef.kind === "baja")
    return generateServicePage(launch, pageDef, ctx);
}

/** Runs a handful of async jobs at a time instead of all at once (Claude/
 * Magnific/screenshot-service would choke on 10-14 concurrent calls) or
 * fully sequentially (too slow for a PLF's worth of pages). */
async function runInBatches<T>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<unknown>,
) {
  const results: PromiseSettledResult<unknown>[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    results.push(...(await Promise.allSettled(batch.map(fn))));
  }
  return results;
}

async function sharedPageGenContext(
  launch: Launch,
  organizationId: string,
  userId: string,
): Promise<PageGenCtx> {
  const [launchProducts, referenceSummary] = await Promise.all([
    db
      .select()
      .from(products)
      .where(and(eq(products.launchId, launch.id), eq(products.active, true))),
    launch.referenceUrl
      ? analyzeReferenceUrl(launch.referenceUrl)
      : Promise.resolve(null),
  ]);
  return {
    organizationId,
    userId,
    launchProducts: launchProducts.map((p) => ({
      slug: p.slug,
      name: p.name,
      priceCents: p.priceCents,
      currency: p.currency,
    })),
    referenceSummary,
  };
}

/**
 * Progress of a multi-page generation, written to the launch as each page lands.
 *
 * Without it the admin got a two-second spinner and then silence: the work runs
 * for minutes, and the only way to know whether it had finished was to reload the
 * page over and over. Now the run reports itself and the panel can follow along.
 */
export type GenerationProgress = {
  startedAt: string;
  finishedAt?: string;
  total: number;
  done: string[];
  failed: Array<{ page: string; error: string }>;
  /** Cerrada al arrancar porque el proceso que la ejecutaba ya no existe: un
   *  despliegue o una caída a mitad. Ver src/server/generation-sweep.ts. */
  interrupted?: boolean;
};

async function writeProgress(launchId: string, progress: GenerationProgress) {
  const [current] = await db
    .select({ cache: launches.assetsCache })
    .from(launches)
    .where(eq(launches.id, launchId))
    .limit(1);

  await db
    .update(launches)
    .set({
      assetsCache: {
        ...((current?.cache ?? {}) as Record<string, unknown>),
        generation: progress,
      },
      updatedAt: new Date(),
    })
    .where(eq(launches.id, launchId));
}

/**
 * Starts generating one page and returns immediately.
 *
 * For the MCP connector. An MCP client gives a tool call about a minute before it
 * gives up, and generating a page takes several — so waiting means the caller
 * always sees a timeout while the work quietly succeeds. Instead the work runs
 * detached and reports itself through the same progress record the panel already
 * polls, and the connector asks for the state when it wants it.
 */
export async function startPageGeneration(input: {
  launchId: string;
  organizationId: string;
  userId: string;
  pageKey: string;
  instruction?: string;
}) {
  const progress: GenerationProgress = {
    startedAt: new Date().toISOString(),
    total: 1,
    done: [],
    failed: [],
  };
  await writeProgress(input.launchId, progress);

  // Deliberately not awaited. Self-hosted Node keeps the task alive after the
  // response; if it ever dies mid-run, the record stays unfinished, which reads as
  // "it didn't finish" rather than as success.
  void generatePageForOrg(input)
    .then(() => {
      progress.done.push(input.pageKey);
    })
    .catch((err: unknown) => {
      progress.failed.push({
        page: input.pageKey,
        error: err instanceof Error ? err.message : String(err),
      });
    })
    .finally(() => {
      progress.finishedAt = new Date().toISOString();
      void writeProgress(input.launchId, progress).catch(() => {});
    });
}

/** The progress record of the last generation run on this launch. */
export async function readGenerationProgress(
  launchId: string,
  organizationId: string,
): Promise<GenerationProgress | null> {
  const [row] = await db
    .select({ cache: launches.assetsCache })
    .from(launches)
    .where(
      and(
        eq(launches.id, launchId),
        eq(launches.organizationId, organizationId),
      ),
    )
    .limit(1);
  const generation = (row?.cache as Record<string, unknown> | null)?.generation;
  return (generation as GenerationProgress | undefined) ?? null;
}

/** Generates every page this launch's type/config calls for, in one pass. */
export async function generateAllPagesAction(launchId: string) {
  const { user, organizationId } = await requireOrgAdmin();
  const launch = await getOrgLaunch(launchId, organizationId);
  if (!launch.promise || !launch.avatar) throw new Error("marco_copy_missing");
  if (
    launch.brandKitStatus !== "approved" ||
    !launch.brandPalette ||
    !launch.brandFonts
  ) {
    throw new Error("brand_kit_not_approved");
  }

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  const ctx = await sharedPageGenContext(launch, organizationId, user.id);
  const pages = resolvePages(launch.type as LaunchType, launch.pageConfig);

  const progress: GenerationProgress = {
    startedAt: new Date().toISOString(),
    total: pages.length,
    done: [],
    failed: [],
  };
  await writeProgress(launchId, progress);

  const results = await runInBatches(pages, 3, async (pageDef) => {
    try {
      await generateSinglePage(launch, pageDef, ctx, org?.name ?? launch.name);
      progress.done.push(pageDef.label);
    } catch (err) {
      progress.failed.push({
        page: pageDef.label,
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      // Written per page, so the panel can show "4 de 9" while the rest run.
      await writeProgress(launchId, progress).catch(() => {});
      revalidatePath(`/admin/lanzamientos/${launch.slug}`);
    }
  });

  progress.finishedAt = new Date().toISOString();
  await writeProgress(launchId, progress).catch(() => {});

  // Revalidate before reporting: some pages may have been written even if others
  // failed, and hiding those would be worse than reporting a partial run.
  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
  for (const pageDef of pages) revalidatePath(pagePath(launch.slug, pageDef));

  // This used to only console.error. Every page could fail and the admin was
  // shown a successful-looking screen with nothing changed — which is exactly
  // what it looked like: a couple of seconds of spinner and no explanation.
  const failed = results
    .map((r, i) => ({ r, page: pages[i]! }))
    .filter(
      (x): x is { r: PromiseRejectedResult; page: PageDef } =>
        x.r.status === "rejected",
    );

  if (failed.length > 0) {
    const detail = failed
      .map(
        ({ r, page }) =>
          `${page.label}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}`,
      )
      .join(" · ");
    console.error(
      "generateAllPagesAction failed pages",
      failed.map((f) => f.r.reason),
    );
    throw new Error(
      `No se pudieron generar ${failed.length} de ${pages.length} páginas. ${detail}`,
    );
  }
}

/** Regenerates a single already-existing (or not-yet-existing) page. */
export async function regenerateSinglePageAction(
  launchId: string,
  pageKey: string,
  formData?: FormData,
) {
  const { user, organizationId } = await requireOrgAdmin();
  const typed = formData
    ? String(formData.get("instruction") ?? "").trim()
    : "";
  await generatePageForOrg({
    launchId,
    organizationId,
    userId: user.id,
    pageKey,
    instruction: typed,
  });
}

/**
 * Generates one page, given who is asking rather than a session.
 *
 * Split out of the action because the MCP connector generates pages too, and it
 * authenticates with a token: it has an organization and a user id but no session
 * to `requireOrgAdmin()` against. Same work either way — one code path, so the
 * connector can't drift from the panel.
 */
export async function generatePageForOrg(input: {
  launchId: string;
  organizationId: string;
  /** Recorded as the asset's author. */
  userId: string;
  pageKey: string;
  /** Empty string means "keep whatever brief was stored for this page". */
  instruction?: string;
}) {
  const { launchId, organizationId, userId, pageKey } = input;
  const launch = await getOrgLaunch(launchId, organizationId);
  if (!launch.promise || !launch.avatar) throw new Error("marco_copy_missing");
  if (
    launch.brandKitStatus !== "approved" ||
    !launch.brandPalette ||
    !launch.brandFonts
  ) {
    throw new Error("brand_kit_not_approved");
  }

  const pageDef = resolvePages(
    launch.type as LaunchType,
    launch.pageConfig,
  ).find((p) => p.pageKey === pageKey);
  if (!pageDef) throw new Error("page_not_found");

  // Antes de escribir la página, refrescar las fechas desde el calendario: es hacia
  // ellas hacia donde va a contar su cuenta atrás.
  await syncLaunchDatesFromCalendar(launchId);

  // Remembered per page in assetsCache, so regenerating twice doesn't mean
  // retyping the brief — and so you can see what produced what you're looking at.
  const cache = (launch.assetsCache ?? {}) as Record<string, unknown>;
  const stored = (cache.pageInstructions ?? {}) as Record<string, string>;
  const typed = (input.instruction ?? "").trim();
  const pageInstruction = typed || stored[pageKey] || null;

  if (typed !== (stored[pageKey] ?? "")) {
    const next = { ...stored };
    if (typed) next[pageKey] = typed;
    else delete next[pageKey];
    await db
      .update(launches)
      .set({
        assetsCache: { ...cache, pageInstructions: next },
        updatedAt: new Date(),
      })
      .where(eq(launches.id, launchId));
  }

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  const ctx = await sharedPageGenContext(launch, organizationId, userId);
  await generateSinglePage(
    launch,
    pageDef,
    { ...ctx, pageInstruction },
    org?.name ?? launch.name,
  );

  revalidatePath(`/admin/lanzamientos/${launch.slug}/paginas/${pageKey}`);
  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
  revalidatePath(pagePath(launch.slug, pageDef));
}

/**
 * Saves a simple page (registro / contenido / legal / afiliados) from its real
 * inputs instead of a raw JSON textarea. Any stored key the schema doesn't cover
 * — a resolved `imageUrl`, say — is preserved, so editing the headline can't
 * silently drop the photo.
 */
export async function updatePageFieldsAction(
  launchId: string,
  pageKey: string,
  formData: FormData,
) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await getOrgLaunch(launchId, organizationId);

  const pageDef = resolvePages(
    launch.type as LaunchType,
    launch.pageConfig,
  ).find((p) => p.pageKey === pageKey);
  if (!pageDef) throw new Error("page_not_found");

  const [asset] = await db
    .select()
    .from(assets)
    .where(
      and(
        eq(assets.launchId, launchId),
        eq(assets.kind, "landing"),
        eq(assets.pageKey, pageKey),
      ),
    )
    .orderBy(desc(assets.createdAt))
    .limit(1);

  // Creating a page needs the identity approved; editing an existing one doesn't,
  // since the design is already decided and you may just be fixing a typo.
  if (!asset && launch.brandKitStatus !== "approved") {
    throw new Error(
      "No se puede crear esta página todavía: aprueba primero la identidad visual del lanzamiento.",
    );
  }

  const fields = fieldsForKind(pageDef.kind);
  const body = bodyFromFields(
    fields,
    (name) => (formData.has(name) ? String(formData.get(name) ?? "") : null),
    (asset?.body ?? null) as Record<string, unknown> | null,
  );

  // A new imagePrompt invalidates the photo resolved from the previous one.
  const previousPrompt = (asset?.body as Record<string, unknown> | undefined)
    ?.imagePrompt;
  if (
    typeof body.imagePrompt === "string" &&
    body.imagePrompt !== previousPrompt
  ) {
    const imageUrl = await autoResolveImage(
      body.imagePrompt,
      await imageContextFor(launch, "hero"),
    );
    if (imageUrl) body.imageUrl = imageUrl;
  }
  if (!body.imagePrompt) delete body.imageUrl;

  if (asset) {
    await db
      .update(assets)
      .set({ body, updatedAt: new Date() })
      .where(eq(assets.id, asset.id));
  } else {
    // No asset yet: the admin is writing this page by hand before generating it.
    await db.insert(assets).values({
      launchId,
      organizationId,
      kind: "landing",
      title: `${pageDef.label} · ${launch.name}`,
      pageKey,
      body,
    });
  }

  revalidatePath(`/admin/lanzamientos/${launch.slug}/paginas/${pageKey}`);
  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
  revalidatePath(pagePath(launch.slug, pageDef));
}

/**
 * Rewrites ONE part of a simple page with Claude, so those pages get the same
 * per-part editing the sales page has instead of an all-or-nothing regenerate.
 */
export async function refinePageFieldAction(
  launchId: string,
  pageKey: string,
  formData: FormData,
) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await getOrgLaunch(launchId, organizationId);

  const pageDef = resolvePages(
    launch.type as LaunchType,
    launch.pageConfig,
  ).find((p) => p.pageKey === pageKey);
  if (!pageDef) throw new Error("page_not_found");

  const fieldName = String(formData.get("field") ?? "");
  const instruction = String(formData.get("instruction") ?? "").trim();
  if (!instruction) return;

  const field = fieldsForKind(pageDef.kind).find((f) => f.name === fieldName);
  if (!field) throw new Error("field_not_found");

  const [asset] = await db
    .select()
    .from(assets)
    .where(
      and(
        eq(assets.launchId, launchId),
        eq(assets.kind, "landing"),
        eq(assets.pageKey, pageKey),
      ),
    )
    .orderBy(desc(assets.createdAt))
    .limit(1);
  if (!asset) throw new Error("page_not_generated");

  const body = (asset.body ?? {}) as Record<string, unknown>;
  const current = body[fieldName];

  const { text } = await complete({
    system: PAGE_FIELD_REFINE_SYSTEM,
    prompt: pageFieldRefinePrompt({
      pageLabel: pageDef.label,
      fieldLabel: field.label,
      isList: field.type === "list",
      current,
      instruction,
      launchName: launch.name,
      promise: launch.promise,
    }),
    maxTokens: 1500,
    temperature: 0.7,
  });

  // The model is asked for a bare value, but it still volunteers a fenced object
  // now and then — accept both rather than failing the edit.
  const answer = extractPageFieldValue(text, field.type === "list", fieldName);
  if (answer === null)
    throw new Error(
      "La IA no devolvió un valor usable. No se ha guardado nada.",
    );

  body[fieldName] = answer;

  if (fieldName === "imagePrompt" && typeof answer === "string") {
    const imageUrl = await autoResolveImage(
      answer,
      await imageContextFor(launch, "hero"),
    );
    if (imageUrl) body.imageUrl = imageUrl;
  }

  await db
    .update(assets)
    .set({ body, updatedAt: new Date() })
    .where(eq(assets.id, asset.id));

  revalidatePath(`/admin/lanzamientos/${launch.slug}/paginas/${pageKey}`);
  revalidatePath(pagePath(launch.slug, pageDef));
}

/** Pulls a string or a list out of the model's answer, however it wrapped it. */
function extractPageFieldValue(
  text: string,
  isList: boolean,
  fieldName: string,
): string | string[] | null {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fence ? fence[1] : text).trim();

  let parsed: unknown = raw;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Not JSON at all — a plain sentence, which is fine for a text field.
  }

  // Unwrap `{ headline: "..." }` / `{ value: [...] }`.
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    const key = [fieldName, "value", "content", "text"].find((k) => k in obj);
    if (key) parsed = obj[key];
  }

  if (isList) {
    if (Array.isArray(parsed)) {
      const items = parsed
        .filter((i): i is string => typeof i === "string")
        .map((i) => i.trim())
        .filter(Boolean);
      return items.length > 0 ? items : null;
    }
    if (typeof parsed === "string") {
      const items = parsed
        .split("\n")
        .map((l) => l.replace(/^[-*•]\s*/, "").trim())
        .filter(Boolean);
      return items.length > 0 ? items : null;
    }
    return null;
  }

  if (typeof parsed === "string" && parsed.trim()) return parsed.trim();
  return null;
}

export async function updatePageBodyAction(
  launchId: string,
  pageKey: string,
  formData: FormData,
) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await getOrgLaunch(launchId, organizationId);

  const raw = String(formData.get("json") ?? "{}");
  const body = JSON.parse(raw) as Record<string, unknown>;

  await db
    .update(assets)
    .set({ body, updatedAt: new Date() })
    .where(
      and(
        eq(assets.launchId, launchId),
        eq(assets.kind, "landing"),
        eq(assets.pageKey, pageKey),
      ),
    );

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

/**
 * Applies the design-review warnings that CAN be fixed from the page's own
 * JSON (long copy, box style, section order/removal) and re-runs the review
 * on the result. Anything CSS-level stays as a warning — see DESIGN_FIX_SYSTEM.
 */
export async function applyDesignFixesAction(
  launchId: string,
  pageKey: string,
) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await getOrgLaunch(launchId, organizationId);

  const [asset] = await db
    .select()
    .from(assets)
    .where(
      and(
        eq(assets.launchId, launchId),
        eq(assets.kind, "landing"),
        eq(assets.pageKey, pageKey),
      ),
    )
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

  const pageDef = resolvePages(
    launch.type as LaunchType,
    launch.pageConfig,
  ).find((p) => p.pageKey === pageKey);
  if (pageDef)
    await runDesignReview(
      launch,
      pageDef,
      asset.id,
      fixedBody as Record<string, unknown>,
    );

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

export async function updateLandingInstructionsAction(
  launchId: string,
  formData: FormData,
) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await getOrgLaunch(launchId, organizationId);

  const instructions =
    String(formData.get("instructions") ?? "").trim() || null;

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

type EmailItem = {
  subject: string;
  preheader?: string;
  body: string;
  ctaText?: string;
  ctaUrl?: string;
  phase?: string;
  timing?: string;
  sendOffsetDays?: number;
  approved?: boolean;
};

async function loadEmailAsset(launchId: string, organizationId: string) {
  const launch = await getOrgLaunch(launchId, organizationId);
  const [asset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.launchId, launchId), eq(assets.kind, "email")))
    .orderBy(desc(assets.createdAt))
    .limit(1);
  if (!asset) throw new Error("no_email_asset");
  const body = asset.body as { emails: EmailItem[] };
  if (!body?.emails?.length) throw new Error("no_emails");
  return { launch, asset, body };
}

export async function refineEmailAction(
  launchId: string,
  emailIndex: number,
  formData: FormData,
) {
  const { organizationId } = await requireOrgAdmin();
  const instruction = String(formData.get("instruction") ?? "").trim();
  if (!instruction) throw new Error("instruction_required");

  const { launch, body } = await loadEmailAsset(launchId, organizationId);
  const email = body.emails[emailIndex];
  if (!email) throw new Error("email_not_found");

  const { text } = await complete({
    system: EMAIL_REFINE_SYSTEM,
    prompt: emailRefinePrompt({
      email,
      instruction,
      launchContext: {
        name: launch.name,
        promise: launch.promise ?? "",
        painPoints: launch.painPoints ?? [],
        benefits: launch.benefits ?? [],
        primaryCountry: launch.primaryCountry,
      },
    }),
    maxTokens: 3000,
    temperature: 0.6,
  });

  const refined = extractJson(text) as EmailItem;
  const updatedEmails = [...body.emails];
  updatedEmails[emailIndex] = {
    ...email,
    subject: refined.subject ?? email.subject,
    preheader: refined.preheader ?? email.preheader,
    body: refined.body ?? email.body,
    ctaText: refined.ctaText ?? email.ctaText,
    ctaUrl: refined.ctaUrl ?? email.ctaUrl,
  };

  await db.insert(assets).values({
    organizationId,
    launchId,
    kind: "email",
    title: `Secuencia · ${launch.name}`,
    body: { emails: updatedEmails },
    generatedByAi: env.ANTHROPIC_MODEL,
  });

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

export async function updateEmailAction(
  launchId: string,
  emailIndex: number,
  formData: FormData,
) {
  const { organizationId } = await requireOrgAdmin();
  const { launch, body } = await loadEmailAsset(launchId, organizationId);
  const email = body.emails[emailIndex];
  if (!email) throw new Error("email_not_found");

  const subject = String(formData.get("subject") ?? "").trim();
  const preheader = String(formData.get("preheader") ?? "").trim();
  const htmlBody = String(formData.get("body") ?? "").trim();
  const ctaText = String(formData.get("ctaText") ?? "").trim();

  const updatedEmails = [...body.emails];
  updatedEmails[emailIndex] = {
    ...email,
    ...(subject && { subject }),
    ...(preheader && { preheader }),
    ...(htmlBody && { body: htmlBody }),
    ...(ctaText && { ctaText }),
  };

  await db.insert(assets).values({
    organizationId,
    launchId,
    kind: "email",
    title: `Secuencia · ${launch.name}`,
    body: { emails: updatedEmails },
  });

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

export async function approveEmailAction(
  launchId: string,
  emailIndex: number,
  approved: boolean,
) {
  const { organizationId } = await requireOrgAdmin();
  const { launch, body } = await loadEmailAsset(launchId, organizationId);
  const email = body.emails[emailIndex];
  if (!email) throw new Error("email_not_found");

  const updatedEmails = [...body.emails];
  updatedEmails[emailIndex] = { ...email, approved };

  await db.insert(assets).values({
    organizationId,
    launchId,
    kind: "email",
    title: `Secuencia · ${launch.name}`,
    body: { emails: updatedEmails },
  });

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

export async function approveAllEmailsAction(launchId: string) {
  const { organizationId } = await requireOrgAdmin();
  const { launch, body } = await loadEmailAsset(launchId, organizationId);

  const updatedEmails = body.emails.map((e) => ({ ...e, approved: true }));

  await db.insert(assets).values({
    organizationId,
    launchId,
    kind: "email",
    title: `Secuencia · ${launch.name}`,
    body: { emails: updatedEmails },
  });

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

export async function updateEmailOffsetAction(
  launchId: string,
  emailIndex: number,
  newOffset: number,
) {
  const { organizationId } = await requireOrgAdmin();
  const { launch, body } = await loadEmailAsset(launchId, organizationId);
  const email = body.emails[emailIndex];
  if (!email) throw new Error("email_not_found");

  const updatedEmails = [...body.emails];
  updatedEmails[emailIndex] = { ...email, sendOffsetDays: newOffset };

  await db.insert(assets).values({
    organizationId,
    launchId,
    kind: "email",
    title: `Secuencia · ${launch.name}`,
    body: { emails: updatedEmails },
  });

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

export async function fetchAcAutomationsAction(launchId: string) {
  const { organizationId } = await requireOrgAdmin();
  const ac = await getActiveCampaignClientForOrg(organizationId);
  if (!ac) return [];
  return ac.listAutomations();
}

export async function linkAcAutomationAction(
  launchId: string,
  automationId: string,
) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await getOrgLaunch(launchId, organizationId);

  const cache = (launch.assetsCache ?? {}) as Record<string, unknown>;
  const linked = (cache.acLinkedAutomationIds as string[]) ?? [];
  if (!linked.includes(automationId)) {
    linked.push(automationId);
  }
  cache.acLinkedAutomationIds = linked;

  await db
    .update(launches)
    .set({ assetsCache: cache, updatedAt: new Date() })
    .where(eq(launches.id, launchId));

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

export async function unlinkAcAutomationAction(
  launchId: string,
  automationId: string,
) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await getOrgLaunch(launchId, organizationId);

  const cache = (launch.assetsCache ?? {}) as Record<string, unknown>;
  const linked = (cache.acLinkedAutomationIds as string[]) ?? [];
  cache.acLinkedAutomationIds = linked.filter((id) => id !== automationId);

  await db
    .update(launches)
    .set({ assetsCache: cache, updatedAt: new Date() })
    .where(eq(launches.id, launchId));

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

export async function generateAdsAction(launchId: string) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await getOrgLaunch(launchId, organizationId);
  if (!launch.promise) throw new Error("marco_copy_missing");

  const ctaUrl = `${env.APP_URL}/${launch.slug}`;
  const { text } = await complete({
    system: ADS_SYSTEM,
    prompt: adsPrompt(
      launch.name,
      launch.promise,
      launch.painPoints ?? [],
      launch.benefits ?? [],
      ctaUrl,
    ),
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

export async function createStripeProductAction(
  launchId: string,
  formData: FormData,
) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await getOrgLaunch(launchId, organizationId);

  // El formulario manda euros con decimales; Stripe cobra en céntimos. El
  // redondeo importa: 39.99 * 100 son 3998.9999999999995 en coma flotante, y
  // truncarlo cobraría un céntimo de menos.
  const priceCents =
    euroAmount.safeParse(formData.get("price") ?? "").data ?? NaN;
  const currency = String(formData.get("currency") ?? "EUR").toLowerCase();
  const name = String(formData.get("name") ?? launch.name);
  const description = String(
    formData.get("description") ?? launch.promise ?? "",
  );
  // Only needed once there's more than one tier — keeps single-price launches
  // (the common case) exactly as before, with slug === launch.slug.
  const tierKey = String(formData.get("tierKey") ?? "").trim();

  if (!Number.isFinite(priceCents) || priceCents <= 0) {
    throw new Error("invalid_price");
  }

  const existingCount = await db
    .select()
    .from(products)
    .where(eq(products.launchId, launchId));
  const slug = tierKey ? `${launch.slug}--${createSlug(tierKey)}` : launch.slug;

  const stripe = await getStripeClientForOrg(organizationId);

  const stripeProduct = await stripe.products.create({
    name,
    description: description || undefined,
    metadata: {
      launch_id: launchId,
      launch_slug: launch.slug,
      tier_key: tierKey || "",
    },
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
      .set({
        defaultPriceCents: priceCents,
        currency: currency.toUpperCase(),
        updatedAt: new Date(),
      })
      .where(eq(launches.id, launchId));
  }

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

export async function deleteStripeProductAction(
  launchId: string,
  formData: FormData,
) {
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
  await stripe.prices
    .update(product.stripePriceId!, { active: false })
    .catch(() => {});
  if (product.stripeProductId) {
    await stripe.products
      .update(product.stripeProductId, { active: false })
      .catch(() => {});
  }

  await db
    .update(products)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(products.id, productId));

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

/**
 * El atajo de "créalo todo nuevo": una lista y las cuatro etiquetas del lanzamiento.
 *
 * El panel ya no lo usa —ahora cada hueco se elige en `linkActiveCampaignAction`,
 * dejando "crear" donde haga falta— pero sigue aquí porque es lo que hace falta para
 * montar un lanzamiento entero de una llamada, sin pantalla de por medio.
 */
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

/** Las listas y las etiquetas que ya existen en la cuenta, para los desplegables. */
export async function fetchAcListsAndTagsAction(launchId: string) {
  const { organizationId } = await requireOrgAdmin();
  const ac = await getActiveCampaignClientForOrg(organizationId);
  if (!ac) return { ok: false, listas: [], etiquetas: [] };

  await getOrgLaunch(launchId, organizationId);

  // Si la llamada falla hay que saberlo, y no confundir "no he podido preguntar" con
  // "ya no existe": sin esa distinción, un corte de red haría que el panel diera por
  // eliminadas las etiquetas de alguien.
  const [listas, etiquetas] = await Promise.all([
    ac.listAllLists().then(
      (r) => ({ ok: true, datos: r }),
      () => ({ ok: false, datos: [] as Awaited<ReturnType<typeof ac.listAllLists>> }),
    ),
    ac.listAllTags().then(
      (r) => ({ ok: true, datos: r }),
      () => ({ ok: false, datos: [] as Awaited<ReturnType<typeof ac.listAllTags>> }),
    ),
  ]);

  return {
    ok: listas.ok && etiquetas.ok,
    listas: listas.datos.map((l) => ({ id: Number(l.id), nombre: l.name })),
    etiquetas: etiquetas.datos.map((t) => ({ id: Number(t.id), nombre: t.tag })),
  };
}

/**
 * Conectar el lanzamiento con ActiveCampaign eligiendo qué usar de lo que ya hay.
 *
 * El botón de antes creaba siempre lista y cuatro etiquetas nuevas. Para quien
 * empieza está bien; para quien ya tiene su cuenta montada era duplicar su
 * estructura y partir sus contactos en dos. Aquí cada hueco se elige: una lista o
 * etiqueta existente, una nueva, o ninguna.
 *
 * Los ids llegan del formulario, así que se comprueba que existan de verdad en la
 * cuenta antes de guardarlos: un id inventado se guardaría igual y el fallo saldría
 * semanas después, cuando un registro no apareciese en ninguna lista.
 */
export async function linkActiveCampaignAction(
  launchId: string,
  formData: FormData,
) {
  const { organizationId } = await requireOrgAdmin();
  const ac = await getActiveCampaignClientForOrg(organizationId);
  if (!ac) throw new Error("activecampaign_not_configured");

  const launch = await getOrgLaunch(launchId, organizationId);
  const publicUrl = `${env.APP_URL}/${launch.slug}`;

  const listaPedida = String(formData.get("listId") ?? "").trim();
  let listId: number | null = launch.activeCampaignListId;

  if (listaPedida === "nueva") {
    const list = await ac.findOrCreateList({
      name: `Lanz: ${launch.name}`,
      senderUrl: publicUrl,
      senderReminder: `Te suscribiste en ${publicUrl}`,
    });
    listId = Number(list.id);
  } else if (listaPedida) {
    const existentes = await ac.listAllLists();
    const elegida = existentes.find((l) => String(l.id) === listaPedida);
    if (!elegida) {
      throw new Error(
        "Esa lista ya no está en ActiveCampaign. Vuelve a cargar la página y elige otra.",
      );
    }
    listId = Number(elegida.id);
  }

  const CLAVES = [
    { key: "registro", suffix: "-registro", description: "Registro / lead" },
    { key: "comprador", suffix: "-comprador", description: "Compradores" },
    { key: "evento", suffix: "-evento", description: "Asistente a evento" },
    {
      key: "abandono",
      suffix: "-carrito-abandono",
      description: "Carrito abandonado",
    },
  ] as const;

  const etiquetasExistentes = await ac.listAllTags();
  const tagIds: Record<string, number> = {};

  for (const clave of CLAVES) {
    const pedida = String(formData.get(`tag_${clave.key}`) ?? "").trim();
    if (!pedida) continue; // sin etiqueta para este caso, a propósito

    if (pedida === "nueva") {
      const tag = await ac.findOrCreateTag(
        `${launch.slug}${clave.suffix}`,
        clave.description,
      );
      tagIds[clave.key] = Number(tag.id);
      continue;
    }

    const elegida = etiquetasExistentes.find((t) => String(t.id) === pedida);
    if (!elegida) {
      throw new Error(
        `La etiqueta elegida para "${clave.key}" ya no está en ActiveCampaign. Vuelve a cargar la página.`,
      );
    }
    tagIds[clave.key] = Number(elegida.id);
  }

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

export async function pushEmailsToActiveCampaignAction(
  launchId: string,
  assetId: string,
) {
  const { organizationId } = await requireOrgAdmin();
  const ac = await getActiveCampaignClientForOrg(organizationId);
  if (!ac) throw new Error("activecampaign_not_configured");

  const launch = await getOrgLaunch(launchId, organizationId);

  const [asset] = await db
    .select()
    .from(assets)
    .where(
      and(eq(assets.id, assetId), eq(assets.organizationId, organizationId)),
    )
    .limit(1);
  if (!asset || asset.kind !== "email") throw new Error("asset_not_found");

  const sequence = asset.body as {
    emails: Array<{
      subject: string;
      preheader?: string;
      body: string;
      ctaText?: string;
      ctaUrl?: string;
      approved?: boolean;
    }>;
  };

  const brand: EmailBrandKit = {
    logoUrl: launch.brandLogoUrl,
    palette: launch.brandPalette,
    fonts: launch.brandFonts,
    launchName: launch.name,
  };

  // Only push approved emails (or all if none have the approved field yet — backwards compat)
  const hasApprovalField = sequence.emails.some((e) => "approved" in e);
  if (hasApprovalField && !sequence.emails.every((e) => e.approved)) {
    throw new Error("not_all_emails_approved");
  }

  const templateIds: string[] = [];
  for (let i = 0; i < sequence.emails.length; i++) {
    const email = sequence.emails[i];
    if (!email) continue;
    const tpl = await ac.createEmailTemplate({
      name: `${launch.slug} · ${String(i + 1).padStart(2, "0")} · ${email.subject.slice(0, 60)}`,
      subject: email.subject,
      html: wrapEmailHtml(
        email.body,
        email.preheader ?? "",
        email.ctaText,
        email.ctaUrl,
        brand,
      ),
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
/**
 * Sube una campaña diseñada a ActiveCampaign como plantilla.
 *
 * Sin pasar por `wrapEmailHtml`: ese envoltorio existe para vestir un cuerpo de texto
 * que escribió el generador, y aquí el diseño ES el correo entero. Envolverlo le
 * pondría nuestra cabecera y nuestro pie por encima del suyo.
 */
export async function pushDesignedEmailToAcAction(
  launchId: string,
  assetId: string,
) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await getOrgLaunch(launchId, organizationId);

  const ac = await getActiveCampaignClientForOrg(organizationId);
  if (!ac) throw new Error("activecampaign_not_configured");

  const [asset] = await db
    .select()
    .from(assets)
    .where(
      and(eq(assets.id, assetId), eq(assets.organizationId, organizationId)),
    )
    .limit(1);
  if (!asset || asset.kind !== "email" || !isCustomEmailBody(asset.body)) {
    throw new Error("asset_not_found");
  }

  const body = asset.body;
  const tpl = await ac.createEmailTemplate({
    name: `${launch.slug} · ${body.name}`.slice(0, 100),
    subject: body.subject,
    html: body.html,
  });

  // El id se guarda en la campaña, no en el lanzamiento: son muchas y cada una tiene
  // su plantilla. En assetsCache se pisarían entre ellas.
  await db
    .update(assets)
    .set({
      body: { ...body, acTemplateId: tpl.id } as unknown as Record<
        string,
        unknown
      >,
      updatedAt: new Date(),
    })
    .where(eq(assets.id, asset.id));

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

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

  const milestoneByPhase = new Map<string, (typeof launchMilestones)[number]>(
    launchMilestones.map((m) => [m.phase, m]),
  );

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

/**
 * Loads the latest version of ONE page's landing asset.
 *
 * `pageKey` is not optional by accident: without it this took the newest landing
 * asset of any page, so editing a section of the sales page could read the
 * registro page's body — and the companion save wrote to the `main` default,
 * which no multi-page launch renders. Every section edit looked like it did
 * nothing, and the old version reappeared on refresh.
 */
async function loadLandingAsset(
  launchId: string,
  organizationId: string,
  pageKey: string,
) {
  const launch = await getOrgLaunch(launchId, organizationId);

  const [asset] = await db
    .select()
    .from(assets)
    .where(
      and(
        eq(assets.launchId, launchId),
        eq(assets.kind, "landing"),
        eq(assets.pageKey, pageKey),
      ),
    )
    .orderBy(desc(assets.createdAt))
    .limit(1);

  return { launch, asset };
}

async function saveLandingBody(
  launchId: string,
  organizationId: string,
  slug: string,
  pageKey: string,
  body: LandingBody,
  authorId: string | null,
) {
  await db.insert(assets).values({
    organizationId,
    launchId,
    kind: "landing",
    pageKey,
    title: `Landing · ${pageKey}`,
    body: body as unknown as Record<string, unknown>,
    authorId: authorId ?? undefined,
  });
  revalidatePath(`/admin/lanzamientos/${slug}`);
  revalidatePath(`/admin/lanzamientos/${slug}/paginas/${pageKey}`);
  // The entry page lives at /slug and every other at /slug/pageKey.
  revalidatePath(`/${slug}`);
  revalidatePath(`/${slug}/${pageKey}`);
}

export async function refineLandingSectionAction(
  launchId: string,
  pageKey: string,
  section: LandingSectionKey,
  formData: FormData,
) {
  const { user, organizationId } = await requireOrgAdmin();
  const instruction = String(formData.get("instruction") ?? "").trim();
  if (!instruction) throw new Error("instruction_required");

  const { launch, asset } = await loadLandingAsset(
    launchId,
    organizationId,
    pageKey,
  );
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
    parsed &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    "content" in parsed;
  const rawContent = hasEnvelope ? parsed.content : parsed;
  const rawDesign = hasEnvelope ? parsed.design : undefined;

  // Validate before storing: a wrapped or invented shape here is what breaks
  // the public page later, far from its cause.
  const updated = normalizeSectionValue(section, rawContent);
  const newBody: LandingBody = { ...body, [section]: updated };

  // Anything outside the closed design vocabulary is dropped here, not stored.
  // Passing the section's kind is what enforces the per-kind rules (no photo
  // behind a form, no orbit around a long text block).
  const { design } = normalizeSectionDesign(rawDesign, {
    kind: SECTION_KIND_BY_KEY[section],
    contentLength: JSON.stringify(updated ?? "").length,
  });
  if (design) {
    // A photo background is useless without an actual image, so resolve it now
    // with the same Magnific → Unsplash path the rest of the generator uses.
    if (
      design.background === "photo" &&
      !design.imageUrl &&
      design.imagePrompt
    ) {
      const imageUrl = await autoResolveImage(
        design.imagePrompt,
        await imageContextFor(launch, "band"),
      );
      if (imageUrl) design.imageUrl = imageUrl;
      else design.background = "tint"; // don't leave an empty photo band
    }
    newBody.sectionDesign = {
      ...(body.sectionDesign ?? {}),
      [section]: design,
    };
  }

  await saveLandingBody(
    launchId,
    organizationId,
    launch.slug,
    pageKey,
    newBody,
    user.id,
  );
}

/** Deterministic counterpart to the refine box: the dropdowns in the section
 * editor, for when you know exactly what you want and don't want to rely on
 * the model interpreting it. */
export async function updateSectionDesignAction(
  launchId: string,
  pageKey: string,
  section: LandingSectionKey,
  formData: FormData,
) {
  const { user, organizationId } = await requireOrgAdmin();
  const { launch, asset } = await loadLandingAsset(
    launchId,
    organizationId,
    pageKey,
  );
  const body = (asset?.body ?? {}) as LandingBody;

  const { design } = normalizeSectionDesign(
    {
      background: formData.get("background"),
      effect: formData.get("effect"),
      height: formData.get("height"),
      width: formData.get("width"),
      // Keep whatever image/orbit data the section already had.
      imageUrl: body.sectionDesign?.[section]?.imageUrl,
      imagePrompt: body.sectionDesign?.[section]?.imagePrompt,
      orbitItems: body.sectionDesign?.[section]?.orbitItems,
    },
    { kind: SECTION_KIND_BY_KEY[section] },
  );

  const nextDesign = { ...(body.sectionDesign ?? {}) };
  if (design) {
    if (design.background === "photo" && !design.imageUrl) {
      const prompt =
        design.imagePrompt ?? `Fotografía de fondo para "${launch.name}"`;
      const imageUrl = await autoResolveImage(
        prompt,
        await imageContextFor(launch, "band"),
      );
      if (imageUrl) design.imageUrl = imageUrl;
      else design.background = "tint";
    }
    // Orbit with no items would render an empty ring — seed it from the launch.
    if (design.effect === "orbit" && !design.orbitItems?.length) {
      const seeds = (launch.benefits ?? [])
        .slice(0, 6)
        .map((b) => ({ label: b.split(" ").slice(0, 3).join(" ") }));
      if (seeds.length >= 3) design.orbitItems = seeds;
      else design.effect = "aurora";
    }
    // Picking every default in the dropdowns means "no design": store nothing,
    // so resetting a section actually clears it instead of leaving a row that
    // resolves to the same thing anyway.
    if (resolveSectionDesign(design).isDefault) delete nextDesign[section];
    else nextDesign[section] = design;
  } else {
    delete nextDesign[section];
  }

  await saveLandingBody(
    launchId,
    organizationId,
    launch.slug,
    pageKey,
    { ...body, sectionDesign: nextDesign },
    user.id,
  );
}

const ALLOWED_IMAGE_SLOTS = new Set(["hero.imageUrl", "about.creatorImageUrl"]);

export async function setSectionImageAction(
  launchId: string,
  pageKey: string,
  slotPath: string,
  formData: FormData,
) {
  const { user, organizationId } = await requireOrgAdmin();
  if (!ALLOWED_IMAGE_SLOTS.has(slotPath) && !slotPath.startsWith("includes.")) {
    throw new Error("invalid_slot");
  }
  const imageUrl = String(formData.get("imageUrl") ?? "").trim() || null;

  const { launch, asset } = await loadLandingAsset(
    launchId,
    organizationId,
    pageKey,
  );
  const body = (asset?.body ?? {}) as LandingBody;

  const newBody: LandingBody = JSON.parse(JSON.stringify(body));

  if (slotPath === "hero.imageUrl") {
    newBody.hero = { ...(newBody.hero ?? {}), imageUrl: imageUrl ?? undefined };
  } else if (slotPath === "about.creatorImageUrl") {
    const cur = newBody.about;
    if (typeof cur === "string") {
      newBody.about = { text: cur, creatorImageUrl: imageUrl ?? undefined };
    } else {
      newBody.about = {
        ...(cur ?? { text: "" }),
        creatorImageUrl: imageUrl ?? undefined,
      };
    }
  } else if (slotPath.startsWith("includes.")) {
    const idx = Number(slotPath.split(".")[1]);
    if (Number.isFinite(idx) && newBody.includes && newBody.includes[idx]) {
      newBody.includes[idx] = {
        ...newBody.includes[idx],
        imageUrl: imageUrl ?? undefined,
      };
    }
  }

  await saveLandingBody(
    launchId,
    organizationId,
    launch.slug,
    pageKey,
    newBody,
    user.id,
  );
}

export async function updateSectionRawAction(
  launchId: string,
  pageKey: string,
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

  const { launch, asset } = await loadLandingAsset(
    launchId,
    organizationId,
    pageKey,
  );
  const body = (asset?.body ?? {}) as LandingBody;
  const newBody: LandingBody = { ...body, [section]: parsed };

  await saveLandingBody(
    launchId,
    organizationId,
    launch.slug,
    pageKey,
    newBody,
    user.id,
  );
}

type EmailBrandKit = {
  logoUrl?: string | null;
  palette?: {
    primary: string;
    accent: string;
    background: string;
    foreground: string;
  } | null;
  fonts?: { display: string; body: string } | null;
  launchName?: string;
};

function wrapEmailHtml(
  body: string,
  preheader: string,
  ctaText?: string,
  ctaUrl?: string,
  brand?: EmailBrandKit,
): string {
  const bg = brand?.palette?.background ?? "#ffffff";
  const fg = brand?.palette?.foreground ?? "#1a1a1a";
  const primary = brand?.palette?.primary ?? "#e63946";
  const accent = brand?.palette?.accent ?? primary;
  const fontDisplay = brand?.fonts?.display ?? "Arial, Helvetica, sans-serif";
  const fontBody = brand?.fonts?.body ?? "Arial, Helvetica, sans-serif";

  const logoBlock = brand?.logoUrl
    ? `<tr><td align="center" style="padding: 32px 0 24px;">
        <img src="${brand.logoUrl}" alt="${brand.launchName ?? ""}" height="48" style="height:48px;max-width:200px;display:block;" />
      </td></tr>`
    : "";

  const ctaBlock =
    ctaText && ctaUrl
      ? `<tr><td align="center" style="padding: 24px 0 8px;">
          <a href="${ctaUrl}" target="_blank" style="display:inline-block;background:${primary};color:#ffffff;font-family:${fontDisplay};font-size:14px;font-weight:700;text-decoration:none;padding:14px 32px;border-radius:6px;letter-spacing:0.5px;text-transform:uppercase;">
            ${ctaText}
          </a>
        </td></tr>`
      : "";

  const footerText = brand?.launchName
    ? `<p style="margin:0;font-size:12px;color:#999999;">${brand.launchName}</p>`
    : "";

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${preheader}</title>
  <!--[if !mso]><!-->
  <link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontDisplay.split(",")[0]!.trim())}:wght@400;700&family=${encodeURIComponent(fontBody.split(",")[0]!.trim())}:wght@400;700&display=swap" rel="stylesheet">
  <!--<![endif]-->
  <style>
    body, table, td { margin:0; padding:0; }
    body { background-color: ${bg}; }
    a { color: ${accent}; }
    p { margin: 0 0 16px 0; line-height: 1.6; }
    ul, ol { margin: 0 0 16px 0; padding-left: 24px; }
    li { margin-bottom: 6px; line-height: 1.5; }
    strong { color: ${fg}; }
    h1, h2, h3 { font-family: ${fontDisplay}; color: ${fg}; margin: 0 0 12px 0; }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${bg};font-family:${fontBody};font-size:16px;color:${fg};">
  <!-- Preheader -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${bg};">${preheader}${"‌ ".repeat(30)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${bg};">
    <tr>
      <td align="center" style="padding:0;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <!-- Logo -->
          ${logoBlock}
          <!-- Body -->
          <tr>
            <td style="padding:0 32px;font-family:${fontBody};font-size:16px;line-height:1.6;color:${fg};">
              ${body}
            </td>
          </tr>
          <!-- CTA -->
          ${ctaBlock}
          <!-- Footer -->
          <tr>
            <td align="center" style="padding:32px 32px 40px;border-top:1px solid #e5e5e5;margin-top:24px;">
              ${footerText}
              <p style="margin:4px 0 0;font-size:11px;color:#bbbbbb;">
                Si no quieres recibir mas emails, <a href="%unsubscribeurl%" style="color:#999999;">cancela tu suscripcion</a>.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ---- Telegram ----

async function getOrgBotToken(organizationId: string): Promise<string | null> {
  return getTelegramToken(organizationId);
}

export async function connectTelegramGroupAction(
  launchId: string,
  formData: FormData,
) {
  const { organizationId } = await requireOrgAdmin();
  const orgBotToken = await getOrgBotToken(organizationId);
  if (!orgBotToken) throw new Error("telegram_not_configured");

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
    registerWebhook(
      env.APP_URL,
      env.TELEGRAM_WEBHOOK_SECRET,
      orgBotToken,
    ).catch((err) => console.error("Webhook registration failed", err));
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
  triggerEvent:
    | "on_lead"
    | "on_sale"
    | "on_cart_open"
    | "on_cart_close"
    | "manual";
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
    .where(
      and(eq(assets.launchId, launchId), eq(assets.kind, "telegram_message")),
    );

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

export async function sendTelegramAssetMessageAction(
  launchId: string,
  messageIndex: number,
) {
  const { organizationId } = await requireOrgAdmin();
  const orgBotToken = await getOrgBotToken(organizationId);
  const launch = await getOrgLaunch(launchId, organizationId);

  if (!launch.telegramChatId) throw new Error("telegram_not_connected");

  const [asset] = await db
    .select()
    .from(assets)
    .where(
      and(eq(assets.launchId, launchId), eq(assets.kind, "telegram_message")),
    )
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

  await sendTelegramMessage(
    launch.telegramChatId,
    text,
    { parseMode: "HTML" },
    orgBotToken,
  );

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
    .where(
      and(
        eq(assets.launchId, opts.launchId),
        eq(assets.kind, "telegram_message"),
      ),
    )
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

    await sendTelegramMessage(
      opts.chatId,
      text,
      { parseMode: "HTML" },
      orgBotToken,
    );
  }
}

export async function triggerTelegramCartAction(
  launchId: string,
  event: "on_cart_open" | "on_cart_close",
) {
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
    .where(
      and(eq(assets.launchId, launchId), eq(assets.kind, "telegram_message")),
    )
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
    .set({
      body: body as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
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
    .set({
      body: body as unknown as Record<string, unknown>,
      updatedAt: new Date(),
    })
    .where(eq(assets.id, asset.id));

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

// ---- Calendar / Milestones ----

export async function updateLaunchCountryAction(
  launchId: string,
  formData: FormData,
) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await getOrgLaunch(launchId, organizationId);

  const primaryCountry =
    String(formData.get("primaryCountry") ?? "").trim() || null;
  const regionsRaw = String(formData.get("targetRegions") ?? "").trim();
  const targetRegions = regionsRaw
    ? regionsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  await db
    .update(launches)
    .set({ primaryCountry, targetRegions, updatedAt: new Date() })
    .where(eq(launches.id, launchId));

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

export async function generateMilestonesAction(
  launchId: string,
  formData: FormData,
) {
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

  // Las páginas cuentan hacia estas fechas: se toman del calendario recién escrito.
  await syncLaunchDatesFromCalendar(launchId);

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

/**
 * Las fechas de cierre salen del calendario, no de escribirlas dos veces.
 *
 * El calendario ya dice cuándo acaba la captación y cuándo cierra el carrito; que
 * además hubiera que teclear esas dos fechas en el paso de páginas era pedir lo
 * mismo dos veces y, en cuanto una se movía, dejar la otra mintiendo — la cuenta
 * atrás de la página contando hacia un día que el calendario ya había cambiado.
 *
 * El calendario manda: esto se llama cada vez que se genera o se mueve un hito, así
 * que cambiar una fase mueve la cuenta atrás de las páginas con ella. Las columnas
 * se quedan porque son lo que leen las páginas, el runtime y el conector; son una
 * proyección del calendario, no una segunda fuente.
 *
 * `endsAt` y no `startsAt`: el carrito se cierra cuando acaba la fase de cierre, y
 * el registro cuando acaba la captación. La fase es el tramo, no el instante.
 */
export async function syncLaunchDatesFromCalendar(launchId: string): Promise<{
  cartClosesAt: Date | null;
  registrationClosesAt: Date | null;
}> {
  const rows = await db
    .select({
      phase: milestones.phase,
      endsAt: milestones.endsAt,
    })
    .from(milestones)
    .where(eq(milestones.launchId, launchId));

  const endOf = (phase: string) =>
    rows.find((row) => row.phase === phase)?.endsAt ?? null;

  const cartClosesAt = endOf("cierre_carrito");
  const registrationClosesAt = endOf("captacion");
  if (!cartClosesAt && !registrationClosesAt) {
    return { cartClosesAt: null, registrationClosesAt: null };
  }

  await db
    .update(launches)
    .set({
      ...(cartClosesAt ? { cartClosesAt } : {}),
      ...(registrationClosesAt ? { registrationClosesAt } : {}),
      updatedAt: new Date(),
    })
    .where(eq(launches.id, launchId));

  return { cartClosesAt, registrationClosesAt };
}

export async function updateMilestoneAction(
  milestoneId: string,
  formData: FormData,
) {
  const { organizationId } = await requireOrgAdmin();

  const [milestone] = await db
    .select()
    .from(milestones)
    .where(eq(milestones.id, milestoneId))
    .limit(1);
  if (!milestone) throw new Error("milestone_not_found");

  const launch = await getOrgLaunch(milestone.launchId, organizationId);

  const startsAt = formData.get("startsAt")
    ? new Date(String(formData.get("startsAt")))
    : undefined;
  const endsAt = formData.get("endsAt")
    ? new Date(String(formData.get("endsAt")))
    : undefined;
  const label = formData.get("label")
    ? String(formData.get("label")).trim()
    : undefined;

  await db
    .update(milestones)
    .set({
      ...(startsAt && { startsAt }),
      ...(endsAt && { endsAt }),
      ...(label && { label }),
      updatedAt: new Date(),
    })
    .where(eq(milestones.id, milestoneId));

  // Mover una fase mueve la cuenta atrás de las páginas con ella.
  await syncLaunchDatesFromCalendar(milestone.launchId);

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
  const secondaryCountries = ((launch.targetRegions as string[]) ?? []).filter(
    (c) => c !== primaryCountry,
  );

  const fmt = (d: Date) => d.toISOString().split("T")[0]!;
  const year = launchMilestones[0]!.startsAt.getFullYear();

  const { text } = await complete({
    system: CALENDAR_ANALYSIS_SYSTEM,
    prompt: calendarAnalysisPrompt({
      primaryCountry: `${primaryCountry} (${COUNTRIES[primaryCountry] ?? primaryCountry})`,
      secondaryCountries: secondaryCountries.map(
        (c) => `${c} (${COUNTRIES[c] ?? c})`,
      ),
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
    const phaseWarnings = analysis.warnings.filter(
      (w) => w.phase === milestone.phase || w.phase === milestone.label,
    );
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
  if (!orgBotToken) return [];

  const { discoverGroups } = await import("@/integrations/telegram");
  return discoverGroups(orgBotToken);
}

/* ------------------------------------------------- archivar y borrar ------- */

/**
 * Qué hay hecho en un lanzamiento, para saber si se puede borrar.
 *
 * Un lanzamiento vacío es un error de hace dos minutos —un nombre mal escrito, uno
 * duplicado por pulsar dos veces— y borrarlo no pierde nada. Uno con una visita ya
 * registrada es historia: aunque el cliente no lo lanzara nunca, esos números son
 * lo único que queda de lo que pasó. Ese se archiva, no se borra.
 */
async function launchFootprint(launchId: string) {
  const [[paginas], [productos], [eventos], [pedidos]] = await Promise.all([
    db
      .select({ n: sqlCount() })
      .from(assets)
      .where(eq(assets.launchId, launchId)),
    db
      .select({ n: sqlCount() })
      .from(products)
      .where(eq(products.launchId, launchId)),
    db
      .select({ n: sqlCount() })
      .from(trackingEvents)
      .where(eq(trackingEvents.launchId, launchId)),
    db.select({ n: sqlCount() }).from(orders).where(eq(orders.launchId, launchId)),
  ]);

  return {
    paginas: Number(paginas?.n ?? 0),
    productos: Number(productos?.n ?? 0),
    eventos: Number(eventos?.n ?? 0),
    pedidos: Number(pedidos?.n ?? 0),
  };
}

export async function launchCanBeDeleted(launchId: string) {
  const huella = await launchFootprint(launchId);
  const total =
    huella.paginas + huella.productos + huella.eventos + huella.pedidos;
  return {
    puede: total === 0,
    huella,
  };
}

/** Fuera de la galaxia, pero sin perder nada. Reversible. */
export async function archiveLaunchAction(launchId: string) {
  const { organizationId } = await requireOrgAdmin();
  if (!organizationId) throw new Error("no_organization");

  await db
    .update(launches)
    .set({ status: "archived", updatedAt: new Date() })
    .where(
      and(eq(launches.id, launchId), eq(launches.organizationId, organizationId)),
    );

  revalidatePath("/admin");
  redirect("/admin");
}

export async function unarchiveLaunchAction(launchId: string) {
  const { organizationId } = await requireOrgAdmin();
  if (!organizationId) throw new Error("no_organization");

  await db
    .update(launches)
    .set({ status: "draft", updatedAt: new Date() })
    .where(
      and(eq(launches.id, launchId), eq(launches.organizationId, organizationId)),
    );

  revalidatePath("/admin");
}

/**
 * Borrar de verdad, y solo si no hay nada hecho.
 *
 * La comprobación se repite aquí aunque el botón ya no aparezca cuando hay algo: el
 * botón es una cortesía y esto es la garantía. Entre que se pinta la pantalla y se
 * pulsa pueden pasar cosas —una visita, una compra— y lo que decide tiene que ser
 * el estado de ahora, no el de hace un rato.
 */
export async function deleteLaunchAction(launchId: string) {
  const { organizationId } = await requireOrgAdmin();
  if (!organizationId) throw new Error("no_organization");

  const [launch] = await db
    .select()
    .from(launches)
    .where(
      and(eq(launches.id, launchId), eq(launches.organizationId, organizationId)),
    )
    .limit(1);
  if (!launch) throw new Error("launch_not_found");

  const { puede, huella } = await launchCanBeDeleted(launchId);
  if (!puede) {
    throw new Error(
      `Este lanzamiento ya tiene cosas dentro (${huella.paginas} páginas, ${huella.productos} productos, ${huella.eventos} visitas o registros, ${huella.pedidos} pedidos). Archívalo en vez de borrarlo: se quita de la galaxia y no se pierde nada.`,
    );
  }

  await db.delete(launches).where(eq(launches.id, launchId));

  revalidatePath("/admin");
  redirect("/admin");
}

/* ------------------------------------------------------------------- seo --- */

/**
 * El SEO de una página: título, descripción, imagen de la tarjeta y si se indexa.
 *
 * Se guarda en el lanzamiento y por `pageKey`, no con el contenido de la página: el
 * contenido se sustituye —se regenera desde el panel, se rediseña en Claude— y el
 * título con el que la página sale en Google no tiene por qué irse con él.
 */
export async function updatePageSeoAction(
  launchId: string,
  pageKey: string,
  formData: FormData,
) {
  const { organizationId } = await requireOrgAdmin();
  const launch = await getOrgLaunch(launchId, organizationId);

  const texto = (campo: string, max: number) => {
    const valor = String(formData.get(campo) ?? "").trim();
    return valor ? valor.slice(0, max) : undefined;
  };

  const indexar = String(formData.get("index") ?? "");
  const nuevo: PageSeo = {
    // Los límites son los que de verdad se enseñan: Google corta el título sobre los
    // 60 caracteres y la descripción sobre los 160. Guardar más es guardar algo que
    // nadie va a leer, y encima esconde que está cortado.
    title: texto("title", 70),
    description: texto("description", 200),
    imageUrl: texto("imageUrl", 500),
    canonicalUrl: texto("canonicalUrl", 500),
    ...(indexar === "si"
      ? { index: true }
      : indexar === "no"
        ? { index: false }
        : {}),
  };

  const actual = (launch.seo ?? {}) as Record<string, PageSeo>;
  const limpio = Object.fromEntries(
    Object.entries(nuevo).filter(([, v]) => v !== undefined),
  ) as PageSeo;

  const seo = { ...actual };
  // Un ajuste vacío se borra en vez de guardarse como objeto vacío: así "sin nada
  // configurado" es una sola cosa y no dos que se parecen.
  if (Object.keys(limpio).length === 0) delete seo[pageKey];
  else seo[pageKey] = limpio;

  await db
    .update(launches)
    .set({ seo, updatedAt: new Date() })
    .where(eq(launches.id, launchId));

  revalidatePath(`/admin/lanzamientos/${launch.slug}/paginas/${pageKey}`);
  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}
