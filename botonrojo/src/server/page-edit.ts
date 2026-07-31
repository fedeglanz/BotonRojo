"use server";

import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { assets, launches } from "@/db/schema";
import { requireOrgAdmin } from "@/lib/auth-helpers";
import { complete } from "@/lib/ai";
import { resolvePages, pagePath } from "@/lib/launch-pages";
import type { LaunchType } from "@/lib/launch-types";
import { normalizeSectionDesign } from "@/components/public/section-design";
import {
  BLOCK_SYSTEM,
  blockPrompt,
  blockRefinePrompt,
} from "@/ai/prompts/page-blocks";
import type { EditTarget } from "@/components/public/edit-mode";
import type { PageBlock } from "@/components/public/page-bodies";
import type {
  LandingSectionKey,
  SectionDesign,
} from "@/components/public/landing-types";
import {
  refineLandingSectionAction,
  updateSectionDesignAction,
} from "@/server/launches";

/**
 * The server side of in-page editing.
 *
 * Kept apart from `launches.ts` because these actions share one shape: they take a
 * `target` describing what the admin pointed at and dispatch on it, rather than
 * having a separate action per field. That's what lets one side panel edit a
 * landing section, a capture page's hero and any block.
 */

function parseTarget(formData: FormData): EditTarget {
  try {
    const raw = JSON.parse(
      String(formData.get("target") ?? "{}"),
    ) as EditTarget;
    if (raw.kind === "section" && typeof raw.key === "string") return raw;
    if (raw.kind === "block" && typeof raw.index === "number") return raw;
    if (raw.kind === "hero") return raw;
  } catch {
    // falls through
  }
  throw new Error("target_invalid");
}

async function loadPage(launchId: string, pageKey: string) {
  const { organizationId, user } = await requireOrgAdmin();

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
  if (!asset) throw new Error("Genera la página antes de editarla.");

  return { launch, pageDef, asset, organizationId, userId: user.id };
}

/** Writes the edited body back and revalidates both the panel and the live page. */
async function savePage(
  assetId: string,
  slug: string,
  pageKey: string,
  publicPath: string,
  body: Record<string, unknown>,
) {
  await db
    .update(assets)
    .set({ body, updatedAt: new Date() })
    .where(eq(assets.id, assetId));
  revalidatePath(publicPath);
  revalidatePath(`/admin/lanzamientos/${slug}/paginas/${pageKey}`);
}

/* ------------------------------------------------------------------ copy -- */

export async function editRefineAction(formData: FormData) {
  const launchId = String(formData.get("launchId") ?? "");
  const pageKey = String(formData.get("pageKey") ?? "");
  const instruction = String(formData.get("instruction") ?? "").trim();
  if (!instruction) return;

  const target = parseTarget(formData);

  // A landing section already has a refine action with all its shape validation;
  // reusing it keeps one code path rather than a parallel one that drifts.
  if (target.kind === "section") {
    const form = new FormData();
    form.set("instruction", instruction);
    await refineLandingSectionAction(
      launchId,
      pageKey,
      target.key as LandingSectionKey,
      form,
    );
    return;
  }

  const { launch, pageDef, asset } = await loadPage(launchId, pageKey);
  const body = (asset.body ?? {}) as Record<string, unknown>;

  if (target.kind === "hero") {
    // The hero of a simple page is its plain fields, so this refines those.
    const current = {
      headline: body.headline,
      subheadline: body.subheadline,
      bullets: body.bullets,
      cta: body.cta,
    };
    const { text } = await complete({
      system: BLOCK_SYSTEM,
      prompt: blockRefinePrompt({
        launchName: launch.name,
        promise: launch.promise,
        what: "la parte principal de la página (titular, subtítulo, viñetas y botón)",
        current,
        instruction,
      }),
      maxTokens: 1500,
    });
    const parsed = extractJson(text) as Record<string, unknown>;
    for (const key of ["headline", "subheadline", "cta"]) {
      if (typeof parsed[key] === "string") body[key] = parsed[key];
    }
    if (Array.isArray(parsed.bullets)) {
      body.bullets = parsed.bullets.filter(
        (b): b is string => typeof b === "string",
      );
    }
    await savePage(
      asset.id,
      launch.slug,
      pageKey,
      pagePath(launch.slug, pageDef),
      body,
    );
    return;
  }

  // A block: rewrite it in place, keeping its type.
  const blocks = (body.blocks ?? []) as PageBlock[];
  const block = blocks[target.index];
  if (!block) throw new Error("block_not_found");

  const { text } = await complete({
    system: BLOCK_SYSTEM,
    prompt: blockRefinePrompt({
      launchName: launch.name,
      promise: launch.promise,
      what: `el bloque de tipo "${block.type}"`,
      current: block,
      instruction,
    }),
    maxTokens: 2000,
  });

  const rewritten = normalizeBlock(extractJson(text), block.type);
  if (!rewritten)
    throw new Error("La IA devolvió el bloque con una forma que no encaja.");

  blocks[target.index] = rewritten;
  body.blocks = blocks;
  await savePage(
    asset.id,
    launch.slug,
    pageKey,
    pagePath(launch.slug, pageDef),
    body,
  );
}

/* ---------------------------------------------------------------- design -- */

export async function editDesignAction(formData: FormData) {
  const launchId = String(formData.get("launchId") ?? "");
  const pageKey = String(formData.get("pageKey") ?? "");
  const target = parseTarget(formData);

  // Only the fields actually chosen are applied; "" means "leave as it was".
  const chosen: Record<string, string> = {};
  for (const field of ["background", "effect", "height", "width"]) {
    const value = String(formData.get(field) ?? "").trim();
    if (value) chosen[field] = value;
  }

  if (target.kind === "section") {
    const form = new FormData();
    for (const [k, v] of Object.entries(chosen)) form.set(k, v);
    await updateSectionDesignAction(
      launchId,
      pageKey,
      target.key as LandingSectionKey,
      form,
    );
    return;
  }

  const { launch, pageDef, asset } = await loadPage(launchId, pageKey);
  const body = (asset.body ?? {}) as Record<string, unknown>;
  const design = (body.design ?? {}) as {
    hero?: SectionDesign;
    blocks?: SectionDesign[];
  };

  const brand = launch.brandDesign
    ? {
        cardStyle: launch.brandDesign.cardStyle,
        titleFx: launch.brandDesign.titleFx,
        density: launch.brandDesign.density,
        divider: launch.brandDesign.divider,
      }
    : null;

  if (target.kind === "hero") {
    const { design: normalized } = normalizeSectionDesign(
      { ...(design.hero ?? {}), ...chosen },
      // A capture page's hero is a form band: that's what keeps the orbit, which
      // forces a narrow column, away from the form's own two-column layout.
      { kind: pageDef.kind === "registro" ? "form" : "hero", brand },
    );
    if (normalized) {
      normalized.divider = "none"; // always the page's first band
      design.hero = normalized;
    }
  } else {
    const blocks = (body.blocks ?? []) as PageBlock[];
    const block = blocks[target.index];
    if (!block) throw new Error("block_not_found");
    const kind =
      block.type === "benefits" || block.type === "testimonials"
        ? "cards"
        : block.type === "steps"
          ? "list"
          : block.type === "faq"
            ? "faq"
            : block.type === "cta"
              ? "cta"
              : "media";

    const list = design.blocks ?? [];
    const { design: normalized } = normalizeSectionDesign(
      { ...(list[target.index] ?? {}), ...chosen },
      { kind, brand },
    );
    if (normalized) {
      list[target.index] = normalized;
      design.blocks = list;
    }
  }

  body.design = design;
  await savePage(
    asset.id,
    launch.slug,
    pageKey,
    pagePath(launch.slug, pageDef),
    body,
  );
}

/* ----------------------------------------------------------- add / remove -- */

const BLOCK_TYPES = [
  "benefits",
  "imageText",
  "steps",
  "faq",
  "testimonials",
  "cta",
] as const;

export async function addBlockAction(formData: FormData) {
  const launchId = String(formData.get("launchId") ?? "");
  const pageKey = String(formData.get("pageKey") ?? "");
  const instruction = String(formData.get("instruction") ?? "").trim();
  const blockType = String(formData.get("blockType") ?? "");
  if (!instruction) return;
  if (!(BLOCK_TYPES as readonly string[]).includes(blockType))
    throw new Error("block_type_invalid");

  const target = parseTarget(formData);
  const { launch, pageDef, asset } = await loadPage(launchId, pageKey);
  const body = (asset.body ?? {}) as Record<string, unknown>;
  const blocks = (body.blocks ?? []) as PageBlock[];

  const { text } = await complete({
    system: BLOCK_SYSTEM,
    prompt: blockPrompt({
      launchName: launch.name,
      promise: launch.promise,
      painPoints: launch.painPoints ?? [],
      benefits: launch.benefits ?? [],
      blockType,
      instruction,
    }),
    maxTokens: 2000,
  });

  const block = normalizeBlock(
    extractJson(text),
    blockType as PageBlock["type"],
  );
  if (!block)
    throw new Error(
      "La IA no devolvió una sección usable. Prueba a describirla de otra forma.",
    );

  // Insert under whatever was pointed at. `after` carries that band: a block
  // index means "right below this one", the hero means "first", and no `after` at
  // all means the end.
  let after: EditTarget | null = null;
  try {
    after = JSON.parse(
      String(formData.get("after") ?? "null"),
    ) as EditTarget | null;
  } catch {
    after = null;
  }

  const at =
    after?.kind === "block" && after.index >= 0
      ? after.index + 1
      : after?.kind === "hero"
        ? 0
        : blocks.length;
  blocks.splice(at, 0, block);
  body.blocks = blocks;

  // The per-block design list is positional, so it has to shift with the insert or
  // every band below would inherit the wrong design.
  const design = (body.design ?? {}) as {
    hero?: SectionDesign;
    blocks?: SectionDesign[];
  };
  if (design.blocks) {
    design.blocks.splice(at, 0, undefined as unknown as SectionDesign);
    body.design = design;
  }

  await savePage(
    asset.id,
    launch.slug,
    pageKey,
    pagePath(launch.slug, pageDef),
    body,
  );
}

/**
 * Moves a block one position up or down.
 *
 * The design list is positional, so it has to move with the block — otherwise the
 * band that moved keeps the background of the one now in its place, which reads as
 * the edit having gone wrong.
 */
export async function moveBlockAction(formData: FormData) {
  const launchId = String(formData.get("launchId") ?? "");
  const pageKey = String(formData.get("pageKey") ?? "");
  const direction = String(formData.get("direction") ?? "");
  const target = parseTarget(formData);
  if (target.kind !== "block" || target.index < 0)
    throw new Error("target_invalid");
  if (direction !== "up" && direction !== "down")
    throw new Error("direction_invalid");

  const { launch, pageDef, asset } = await loadPage(launchId, pageKey);
  const body = (asset.body ?? {}) as Record<string, unknown>;
  const blocks = (body.blocks ?? []) as PageBlock[];

  const from = target.index;
  const to = direction === "up" ? from - 1 : from + 1;
  // Silently ignore a move off either end: the arrows are hidden there anyway, and
  // throwing would turn a harmless double-click into an error page.
  if (to < 0 || to >= blocks.length) return;

  [blocks[from], blocks[to]] = [blocks[to]!, blocks[from]!];
  body.blocks = blocks;

  const design = (body.design ?? {}) as {
    hero?: SectionDesign;
    blocks?: SectionDesign[];
  };
  if (design.blocks) {
    const list = design.blocks;
    [list[from], list[to]] = [list[to]!, list[from]!];
    body.design = design;
  }

  await savePage(
    asset.id,
    launch.slug,
    pageKey,
    pagePath(launch.slug, pageDef),
    body,
  );
}

export async function removeBlockAction(formData: FormData) {
  const launchId = String(formData.get("launchId") ?? "");
  const pageKey = String(formData.get("pageKey") ?? "");
  const target = parseTarget(formData);
  if (target.kind !== "block" || target.index < 0)
    throw new Error("target_invalid");

  const { launch, pageDef, asset } = await loadPage(launchId, pageKey);
  const body = (asset.body ?? {}) as Record<string, unknown>;
  const blocks = (body.blocks ?? []) as PageBlock[];
  if (!blocks[target.index]) throw new Error("block_not_found");

  blocks.splice(target.index, 1);
  body.blocks = blocks.length > 0 ? blocks : undefined;

  const design = (body.design ?? {}) as {
    hero?: SectionDesign;
    blocks?: SectionDesign[];
  };
  if (design.blocks) {
    design.blocks.splice(target.index, 1);
    body.design = design;
  }

  await savePage(
    asset.id,
    launch.slug,
    pageKey,
    pagePath(launch.slug, pageDef),
    body,
  );
}

/* ---------------------------------------------------------------- helpers -- */

function extractJson(text: string): unknown {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fence ? fence[1] : text).trim();
  return JSON.parse(raw!);
}

/**
 * Validates one block against its type. Same principle as everywhere else: the
 * shape the renderer can paint is the only shape that gets stored, so a block the
 * model invented can't reach the page.
 */
function normalizeBlock(
  raw: unknown,
  type: PageBlock["type"],
): PageBlock | null {
  if (!raw || typeof raw !== "object") return null;
  const b = raw as Record<string, unknown>;
  const title =
    typeof b.title === "string" ? b.title.trim() || undefined : undefined;

  const items = Array.isArray(b.items)
    ? b.items.filter(
        (i): i is Record<string, unknown> =>
          Boolean(i) && typeof i === "object",
      )
    : [];

  if (type === "benefits") {
    const list = items
      .map((i) => ({
        icon: typeof i.icon === "string" ? i.icon : undefined,
        title: String(i.title ?? "").trim(),
        text: typeof i.text === "string" ? i.text.trim() : undefined,
      }))
      .filter((i) => i.title)
      .slice(0, 6);
    return list.length >= 2 ? { type, title, items: list } : null;
  }

  if (type === "steps") {
    const list = items
      .map((i) => ({
        title: String(i.title ?? "").trim(),
        text: typeof i.text === "string" ? i.text.trim() : undefined,
      }))
      .filter((i) => i.title)
      .slice(0, 6);
    return list.length >= 2 ? { type, title, items: list } : null;
  }

  if (type === "faq") {
    const list = items
      .map((i) => ({
        q: String(i.q ?? "").trim(),
        a: String(i.a ?? "").trim(),
      }))
      .filter((i) => i.q && i.a)
      .slice(0, 8);
    return list.length >= 2 ? { type, title, items: list } : null;
  }

  if (type === "testimonials") {
    const list = items
      .map((i) => ({
        quote: String(i.quote ?? "").trim(),
        author: String(i.author ?? "").trim(),
        role: typeof i.role === "string" ? i.role.trim() : undefined,
      }))
      .filter((i) => i.quote && i.author)
      .slice(0, 6);
    return list.length >= 2 ? { type, title, items: list } : null;
  }

  if (type === "cta") {
    const text = typeof b.text === "string" ? b.text.trim() : undefined;
    const ctaLabel =
      typeof b.ctaLabel === "string" ? b.ctaLabel.trim() : undefined;
    return title || text ? { type, title, text, ctaLabel } : null;
  }

  // imageText
  const text = typeof b.text === "string" ? b.text.trim() : undefined;
  return title || text
    ? {
        type: "imageText",
        title,
        text,
        ctaLabel:
          typeof b.ctaLabel === "string" ? b.ctaLabel.trim() : undefined,
        imagePrompt:
          typeof b.imagePrompt === "string" ? b.imagePrompt.trim() : undefined,
        imageSide: b.imageSide === "right" ? "right" : "left",
      }
    : null;
}

// Nothing else is exported on purpose: a "use server" module may only export
// async functions, so re-exporting a type or a constant from here breaks every
// page that imports it.
