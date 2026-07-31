import { env } from "@/lib/env";
import { storage, BUCKET, ensureBucket, publicUrlFor } from "./storage";
import { createId } from "@/lib/ids";
import type { BrandPalette } from "@/db/schema/launches";

// Magnific (formerly Freepik) — Mystic text-to-image. Platform-level: the
// platform pays for this, it isn't a per-client credential like Stripe/AC.
// Docs: https://docs.magnific.com/api-reference/mystic/post-mystic
const MAGNIFIC_BASE_URL = "https://api.magnific.com";

export function isImageGenConfigured() {
  return Boolean(env.MAGNIFIC_API_KEY);
}

type MysticTask = {
  task_id: string;
  status: "CREATED" | "IN_PROGRESS" | "COMPLETED" | "FAILED";
  generated: string[];
};

/**
 * Where the image is going.
 *
 * Every slot needs a different shape and a different model, and using one
 * setting for all of them was the whole problem: every image came out
 * `widescreen_16_9` at `1k`, so a creator portrait arrived as a letterbox strip
 * and a full-bleed band background was stretched by the browser into mush.
 */
export type ImageSlot =
  | "hero" // wide, above the fold
  | "band" // full-bleed section background, very wide, text on top
  | "card" // inside a card in a grid
  | "portrait" // the creator, a speaker
  | "story" // 9:16, mobile-first pages and ads
  | "square";

type SlotConfig = {
  aspect_ratio: string;
  resolution: "1k" | "2k" | "4k";
  model: "zen" | "flexible" | "fluid" | "realism" | "super_real" | "editorial_portraits";
  /** Magnific's rendering engine. `sparkle` adds the most texture. */
  engine: "automatic" | "magnific_illusio" | "magnific_sharpy" | "magnific_sparkle";
  creative_detailing: number;
  hdr: number;
};

const SLOTS: Record<ImageSlot, SlotConfig> = {
  // Seen first and largest, so it gets the resolution and the most detail.
  hero: {
    aspect_ratio: "widescreen_16_9",
    resolution: "2k",
    model: "super_real",
    engine: "magnific_sparkle",
    creative_detailing: 45,
    hdr: 60,
  },
  // Copy sits on top of this one, so it has to stay quiet: wide, low detail,
  // empty in the middle. A busy background here ruins the text, not the image.
  band: {
    aspect_ratio: "horizontal_2_1",
    resolution: "2k",
    model: "fluid",
    engine: "magnific_illusio",
    creative_detailing: 20,
    hdr: 40,
  },
  card: {
    aspect_ratio: "social_post_4_5",
    resolution: "1k",
    model: "realism",
    engine: "automatic",
    creative_detailing: 35,
    hdr: 50,
  },
  // A face. `editorial_portraits` is Magnific's own model for this; asking
  // `realism` for a person at 16:9 is what produced the cropped headshots.
  portrait: {
    aspect_ratio: "traditional_3_4",
    resolution: "2k",
    model: "editorial_portraits",
    engine: "magnific_sharpy",
    creative_detailing: 30,
    hdr: 55,
  },
  story: {
    aspect_ratio: "social_story_9_16",
    resolution: "2k",
    model: "super_real",
    engine: "magnific_sparkle",
    creative_detailing: 45,
    hdr: 60,
  },
  square: {
    aspect_ratio: "square_1_1",
    resolution: "1k",
    model: "realism",
    engine: "automatic",
    creative_detailing: 35,
    hdr: 50,
  },
};

export type GenerateImageOptions = {
  slot?: ImageSlot;
  /**
   * The launch's approved palette, passed to Magnific as colour guidance so the
   * photography comes back in the brand's range instead of whatever the model
   * felt like. This is the single biggest reason generated images looked bolted
   * on rather than designed in.
   */
  palette?: BrandPalette | null;
  /**
   * An already-generated image as raw base64 (no data URI prefix), used as a
   * style reference. Feeding the launch's mood image here is what makes every
   * image of a launch look like it came from the same shoot.
   */
  styleReference?: string | null;
  /** Art direction from the brand kit, appended to the prompt. */
  moodNotes?: string | null;
};

/** The brand palette as Magnific colour guidance (1-5 colours, weights 0.05-1). */
function stylingFor(palette: BrandPalette | null | undefined) {
  if (!palette) return undefined;
  const colors = [
    { color: palette.accent, weight: 0.5 },
    { color: palette.primary, weight: 0.3 },
    // The background anchors the image's overall value: a light brand gets light
    // photography, a dark one gets dark.
    { color: palette.background, weight: 0.2 },
  ].filter((c) => /^#[0-9a-fA-F]{6}$/.test(c.color));

  return colors.length > 0 ? { colors } : undefined;
}

/**
 * Direction that applies to every image so the set holds together, plus the two
 * hard rules: no text (it would be baked into the pixels, untranslatable and
 * impossible to edit) and no logos.
 */
function buildPrompt(prompt: string, slot: ImageSlot, moodNotes?: string | null): string {
  const parts = [prompt.trim()];

  if (moodNotes?.trim()) parts.push(`Dirección de arte: ${moodNotes.trim()}`);

  if (slot === "band") {
    parts.push(
      "Fondo amplio y atmosférico, con mucho espacio vacío en el centro, poca profundidad de campo, nada que compita por la atención.",
    );
  }
  if (slot === "portrait") {
    parts.push("Retrato editorial, luz natural, fondo desenfocado, mirando a cámara.");
  }
  if (slot === "card") {
    parts.push("Composición sencilla, un solo sujeto claro, encuadre vertical.");
  }

  parts.push("Sin texto, sin palabras, sin letras, sin logotipos, sin marcas de agua.");
  return parts.join(" ");
}

export async function generateImage(
  prompt: string,
  options: GenerateImageOptions = {},
): Promise<string> {
  if (!env.MAGNIFIC_API_KEY) throw new Error("magnific_not_configured");

  const slot = options.slot ?? "hero";
  const config = SLOTS[slot];

  const headers = {
    "x-magnific-api-key": env.MAGNIFIC_API_KEY,
    "Content-Type": "application/json",
  };

  const body: Record<string, unknown> = {
    prompt: buildPrompt(prompt, slot, options.moodNotes),
    ...config,
    filter_nsfw: true,
  };

  const styling = stylingFor(options.palette);
  if (styling) body.styling = styling;
  if (options.styleReference) {
    body.style_reference = options.styleReference;
    // With a reference in play, loosen adherence to the words so the reference's
    // look actually comes through instead of being overridden by the prompt.
    body.adherence = 40;
  }

  const createRes = await fetch(`${MAGNIFIC_BASE_URL}/v1/ai/mystic`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!createRes.ok) {
    throw new Error(`magnific_api_error: ${await createRes.text()}`);
  }

  let task = ((await createRes.json()) as { data: MysticTask }).data;

  if (task.status !== "COMPLETED") {
    // 2k takes longer than the old 1k default, hence the higher ceiling.
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const pollRes = await fetch(`${MAGNIFIC_BASE_URL}/v1/ai/mystic/${task.task_id}`, { headers });
      task = ((await pollRes.json()) as { data: MysticTask }).data;
      if (task.status === "COMPLETED") break;
      if (task.status === "FAILED") throw new Error("generation_failed");
    }
  }

  const imageUrl = task.generated?.[0];
  if (!imageUrl) throw new Error("no_output");

  // Download the Magnific-hosted image and re-host it on our own MinIO.
  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error("download_failed");

  const buf = Buffer.from(await imgRes.arrayBuffer());
  await ensureBucket();
  const key = `ai-gen/${new Date().toISOString().slice(0, 10)}/${createId(12)}.webp`;

  await storage.putObject(BUCKET, key, buf, buf.length, {
    "Content-Type": "image/webp",
    "Cache-Control": "public, max-age=31536000, immutable",
  });

  return publicUrlFor(key);
}

/**
 * Fetches an already-generated image and returns raw base64, for use as a style
 * reference. Best-effort: a failed fetch means the next image is generated
 * without the reference, not that it isn't generated.
 */
export async function asStyleReference(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    // Magnific rejects very large references, and they add nothing: the style is
    // read from colour and texture, not from resolution.
    if (buf.length > 4_000_000) return null;
    return buf.toString("base64");
  } catch {
    return null;
  }
}
