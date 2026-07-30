"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { assets, launches } from "@/db/schema";
import { requireOrgAdmin } from "@/lib/auth-helpers";
import { env } from "@/lib/env";
import { signPayload } from "@/lib/crypto";
import { createId } from "@/lib/ids";
import { storage, BUCKET, ensureBucket, publicUrlFor, removeObject, internalAssetUrl } from "@/integrations/storage";
import { AD_FORMATS, isAdFormatKey, isAdTemplateKey, type AdFormatKey, type AdRenderPayload } from "@/lib/ad-templates";
import { getMediaItemForOrg } from "@/server/media";
import { complete } from "@/lib/ai";
import { ADS_SHORTEN_SYSTEM, adsShortenPrompt } from "@/ai/prompts/ads";
import { findHardLimitIssues, type AdsBody, type AdImageBody } from "@/components/admin/ads-types";
import type { Launch } from "@/db/schema/launches";

function renderUrlFor(payload: AdRenderPayload): string {
  const { p, sig } = signPayload(payload);
  const params = new URLSearchParams({ p, sig });
  return `${env.SCREENSHOT_APP_URL}/ads-render?${params.toString()}`;
}

/** Screenshots the signed render URL as a PNG at the format's exact size. */
async function capturePng(url: string, width: number, height: number): Promise<Buffer> {
  const res = await fetch(`${env.SCREENSHOT_SERVICE_URL}/screenshot`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(env.SCREENSHOT_SERVICE_TOKEN ? { "x-screenshot-token": env.SCREENSHOT_SERVICE_TOKEN } : {}),
    },
    body: JSON.stringify({ url, width, height, fullPage: false, type: "png" }),
  });
  if (!res.ok) throw new Error(`screenshot_service_error: ${res.status} ${await res.text()}`);
  return Buffer.from(await res.arrayBuffer());
}

function buildRenderPayload(
  launch: Launch,
  concept: NonNullable<AdsBody["statics"]>[number],
  imageUrl: string,
  formatKey: AdFormatKey,
): AdRenderPayload {
  const palette = launch.brandPalette!;
  const fonts = launch.brandFonts!;
  const template = concept.template && isAdTemplateKey(concept.template) ? concept.template : "scrim-bottom";

  return {
    // Both must be fetchable by the screenshot container, not just by a browser.
    imageUrl: internalAssetUrl(imageUrl),
    headline: concept.headline ?? launch.name,
    subheadline: concept.subheadline,
    ctaLabel: concept.ctaLabel,
    logoUrl: launch.brandLogoUrl ? internalAssetUrl(launch.brandLogoUrl) : undefined,
    template,
    format: formatKey,
    primary: palette.primary,
    accent: palette.accent,
    background: palette.background,
    foreground: palette.foreground,
    displayFont: fonts.display,
    bodyFont: fonts.body,
  };
}

/**
 * Renders the chosen static concept over an uploaded photo, once per requested
 * format, and stores each PNG as an `ad_image` asset. The photo is used as-is
 * (never re-generated), so a real person's face comes out exactly as uploaded.
 */
export async function generateAdStaticsAction(launchId: string, formData: FormData) {
  const { user, organizationId } = await requireOrgAdmin();

  const [launch] = await db
    .select()
    .from(launches)
    .where(and(eq(launches.id, launchId), eq(launches.organizationId, organizationId)))
    .limit(1);
  if (!launch) throw new Error("launch_not_found");
  if (!launch.brandPalette || !launch.brandFonts) throw new Error("brand_kit_not_approved");

  const conceptIndex = Number(formData.get("conceptIndex") ?? 0);
  const mediaItemId = String(formData.get("mediaItemId") ?? "");
  const formatKeys = formData.getAll("formats").map(String).filter(isAdFormatKey);

  if (!mediaItemId) throw new Error("media_item_required");
  if (formatKeys.length === 0) throw new Error("formats_required");

  const media = await getMediaItemForOrg(mediaItemId, organizationId);
  if (!media) throw new Error("media_not_found");

  const [adsAsset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.launchId, launchId), eq(assets.kind, "ad_copy")))
    .orderBy(desc(assets.createdAt))
    .limit(1);

  const concept = (adsAsset?.body as AdsBody | undefined)?.statics?.[conceptIndex];
  if (!concept) throw new Error("concept_not_found");

  await ensureBucket();

  // Batches of 3, like page generation — a story at 1080×1920 is a heavy
  // render and the sidecar runs one browser.
  const results: { formatKey: AdFormatKey; ok: boolean; error?: string }[] = [];
  for (let i = 0; i < formatKeys.length; i += 3) {
    const batch = formatKeys.slice(i, i + 3);
    const settled = await Promise.allSettled(
      batch.map(async (formatKey) => {
        const format = AD_FORMATS[formatKey];
        const payload = buildRenderPayload(launch, concept, media.url, formatKey);
        const png = await capturePng(renderUrlFor(payload), format.width, format.height);

        const key = `ads/${launchId}/${createId(12)}.png`;
        await storage.putObject(BUCKET, key, png, png.length, {
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=31536000, immutable",
        });

        const body: AdImageBody = {
          formatKey,
          template: payload.template,
          headline: payload.headline,
          subheadline: payload.subheadline,
          ctaLabel: payload.ctaLabel,
          mediaItemId,
          conceptIndex,
          width: format.width,
          height: format.height,
        };

        try {
          await db.insert(assets).values({
            organizationId,
            launchId,
            kind: "ad_image",
            pageKey: `${formatKey}-c${conceptIndex}`,
            title: `${format.label} · ${concept.concept ?? `Concepto ${conceptIndex + 1}`}`,
            body: body as unknown as Record<string, unknown>,
            fileUrl: publicUrlFor(key),
            generatedByAi: null,
            authorId: user.id,
          });
        } catch (err) {
          // Don't leave an orphan PNG in storage if the row didn't land.
          await removeObject(key);
          throw err;
        }

        return formatKey;
      }),
    );

    settled.forEach((r, j) => {
      results.push(
        r.status === "fulfilled"
          ? { formatKey: batch[j], ok: true }
          : { formatKey: batch[j], ok: false, error: String(r.reason) },
      );
    });
  }

  const failed = results.filter((r) => !r.ok);
  if (failed.length > 0) {
    console.error("generateAdStaticsAction: some formats failed", failed);
    // All of them failing is a real failure the admin must see (service down,
    // bad photo URL) rather than a silently empty gallery.
    if (failed.length === results.length) {
      throw new Error(`ad_render_failed: ${failed[0].error}`);
    }
  }

  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

export async function deleteAdImageAction(launchId: string, formData: FormData) {
  const { organizationId } = await requireOrgAdmin();
  const assetId = String(formData.get("assetId") ?? "");

  const [asset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.id, assetId), eq(assets.organizationId, organizationId), eq(assets.kind, "ad_image")))
    .limit(1);
  if (!asset) throw new Error("ad_image_not_found");

  await db.delete(assets).where(eq(assets.id, assetId));

  // fileUrl is a public MinIO URL; recover the object key from it.
  if (asset.fileUrl) {
    const prefix = `${env.S3_PUBLIC_URL.replace(/\/$/, "")}/`;
    if (asset.fileUrl.startsWith(prefix)) await removeObject(asset.fileUrl.slice(prefix.length));
  }

  const [launch] = await db.select().from(launches).where(eq(launches.id, launchId)).limit(1);
  if (launch) revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

/**
 * Rewrites only the fields that exceed a hard platform limit. Applies each fix
 * by its `path`, and only if the rewrite actually fits — a model that returns
 * something still too long must not make things worse.
 */
export async function fixAdCopyLengthsAction(launchId: string) {
  const { organizationId } = await requireOrgAdmin();

  const [launch] = await db
    .select()
    .from(launches)
    .where(and(eq(launches.id, launchId), eq(launches.organizationId, organizationId)))
    .limit(1);
  if (!launch) throw new Error("launch_not_found");

  const [asset] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.launchId, launchId), eq(assets.kind, "ad_copy")))
    .orderBy(desc(assets.createdAt))
    .limit(1);
  if (!asset) throw new Error("ads_not_generated");

  const body = asset.body as AdsBody;
  const issues = findHardLimitIssues(body);
  if (issues.length === 0) return;

  const { text } = await complete({
    system: ADS_SHORTEN_SYSTEM,
    prompt: adsShortenPrompt(issues),
    maxTokens: 2000,
    temperature: 0.4,
  });

  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const parsed = JSON.parse((fence ? fence[1] : text).trim()) as { fixes?: Record<string, string> };
  const fixes = parsed.fixes ?? {};

  const next = structuredClone(body);
  let applied = 0;

  for (const issue of issues) {
    const replacement = fixes[issue.path];
    if (!replacement || replacement.length > issue.limit) continue;

    const match = /^(googleCopy|metaCopy)\[(\d+)\]\.(\w+)$/.exec(issue.path);
    if (!match) continue;
    const [, group, indexRaw, field] = match;
    const list = group === "googleCopy" ? next.googleCopy : next.metaCopy;
    const target = list?.[Number(indexRaw)] as Record<string, unknown> | undefined;
    if (!target) continue;

    target[field] = replacement;
    applied++;
  }

  if (applied === 0) throw new Error("shorten_failed_no_valid_fixes");

  await db.update(assets).set({ body: next as Record<string, unknown>, updatedAt: new Date() }).where(eq(assets.id, asset.id));
  revalidatePath(`/admin/lanzamientos/${launch.slug}`);
}

export async function listAdImages(launchId: string) {
  const { organizationId } = await requireOrgAdmin();
  return db
    .select()
    .from(assets)
    .where(and(eq(assets.launchId, launchId), eq(assets.organizationId, organizationId), eq(assets.kind, "ad_image")))
    .orderBy(desc(assets.createdAt));
}
