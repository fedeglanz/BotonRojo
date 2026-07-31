import sharp from "sharp";

import { storage, BUCKET, ensureBucket, publicUrlFor } from "./storage";
import { createId } from "@/lib/ids";

/**
 * Trims the transparent margin off an uploaded logo and re-hosts it.
 *
 * This exists because of a real logo: a 2000×2000 PNG whose actual mark occupied
 * 1777×1469 inside it, sitting between 12% and 86% of the height. Constrained to
 * the 28px of a sticky bar, those 28px were mostly empty space — the mark came out
 * around 20px and the wordmark was unreadable. No amount of CSS fixes that, because
 * the padding is in the pixels.
 *
 * Trimming once on upload fixes every logo instead of tuning sizes for one.
 */
export type TrimmedLogo = {
  url: string;
  width: number;
  height: number;
  /** width / height of the trimmed mark — tells a caller whether it's a
   *  horizontal lockup (>2.5) or a stacked one (<1.6), which need different room. */
  aspect: number;
  /**
   * How the logo's ink is distributed by lightness, as fractions of its visible
   * pixels. A client usually supplies ONE logo, so whether it can be read on a
   * given surface is a measurable fact rather than a guess.
   *
   * A mean would hide the problem, and did: this logo averages 0.29 because its
   * bright green mark pulls the number up, while the near-black wordmark beside it
   * is the part that vanishes on a dark bar. What matters is whether a meaningful
   * SHARE of the ink is too close in value to the surface, so the shares are what
   * gets stored.
   */
  ink: { dark: number; mid: number; light: number };
};

export async function trimLogo(sourceUrl: string): Promise<TrimmedLogo | null> {
  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) return null;
    const input = Buffer.from(await res.arrayBuffer());

    // `trim` removes uniform borders; on an RGBA logo that's the transparent
    // padding. The threshold is deliberately low so a faint drop shadow isn't
    // mistaken for content.
    const trimmed = await sharp(input)
      .trim({ threshold: 8 })
      .png({ compressionLevel: 9 })
      .toBuffer({ resolveWithObject: true });

    const { width, height } = trimmed.info;
    if (!width || !height) return null;

    // Lightness distribution of the ink, weighted by alpha so soft edges and the
    // transparent margin don't skew it.
    const { data, info } = await sharp(trimmed.data).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let dark = 0;
    let mid = 0;
    let light = 0;
    let weight = 0;
    for (let i = 0; i < data.length; i += info.channels) {
      const alpha = data[i + 3]! / 255;
      if (alpha < 0.1) continue;
      // Rec. 709 luma, good enough for "is this ink light or dark".
      const luma = (0.2126 * data[i]! + 0.7152 * data[i + 1]! + 0.0722 * data[i + 2]!) / 255;
      if (luma < 0.25) dark += alpha;
      else if (luma > 0.6) light += alpha;
      else mid += alpha;
      weight += alpha;
    }
    const ink =
      weight > 0
        ? {
            dark: Number((dark / weight).toFixed(3)),
            mid: Number((mid / weight).toFixed(3)),
            light: Number((light / weight).toFixed(3)),
          }
        : { dark: 0, mid: 1, light: 0 };

    await ensureBucket();
    const key = `uploads/logos/${new Date().toISOString().slice(0, 10)}/${createId(12)}.png`;
    await storage.putObject(BUCKET, key, trimmed.data, trimmed.data.length, {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    });

    return {
      url: publicUrlFor(key),
      width,
      height,
      aspect: Number((width / height).toFixed(2)),
      ink,
    };
  } catch (err) {
    // Best-effort: an un-trimmable logo is still usable, just with its padding.
    console.error("logo trim failed", err);
    return null;
  }
}
