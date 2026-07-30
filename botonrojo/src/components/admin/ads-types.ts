import type { AdTemplateKey } from "@/lib/ad-templates";

export type AdUgc = { hook?: string; script?: string; broll?: string[] };
export type AdVoiceOver = { hook?: string; script?: string; visuals?: string[] };
export type AdYoutubeClip = { sourceHint?: string; timestampHint?: string; overlay?: string; cta?: string };
export type AdMetaCopy = { headline?: string; primaryText?: string; description?: string };
export type AdGoogleCopy = {
  headline1?: string;
  headline2?: string;
  headline3?: string;
  description1?: string;
  description2?: string;
};

export type AdStaticConcept = {
  concept?: string;
  headline?: string;
  subheadline?: string;
  ctaLabel?: string;
  template?: AdTemplateKey;
};

export type AdsBody = {
  ugc?: AdUgc[];
  voiceOver?: AdVoiceOver[];
  youtubeClipCta?: AdYoutubeClip[];
  metaCopy?: AdMetaCopy[];
  googleCopy?: AdGoogleCopy[];
  statics?: AdStaticConcept[];
};

/**
 * HARD limits: over these the platform rejects the ad outright. An LLM can't
 * count characters reliably, so the UI measures the real strings and offers a
 * fix rather than trusting the prompt.
 */
export const AD_HARD_LIMITS = {
  googleHeadline: 30,
  googleDescription: 90,
  metaHeadline: 40,
} as const;

/** SOFT limits: the ad still runs, it just gets truncated in the feed. */
export const AD_SOFT_LIMITS = {
  metaPrimaryText: 125,
  staticHeadline: 60,
  staticSubheadline: 90,
  staticCta: 25,
} as const;

export type AdCopyIssue = { path: string; length: number; limit: number; value: string };

/** The exact over-limit fields, used both to badge the UI and to tell Claude
 * precisely what to shorten. */
export function findHardLimitIssues(body: AdsBody | null): AdCopyIssue[] {
  if (!body) return [];
  const issues: AdCopyIssue[] = [];

  const check = (path: string, value: string | undefined, limit: number) => {
    if (value && value.length > limit) issues.push({ path, length: value.length, limit, value });
  };

  body.googleCopy?.forEach((c, i) => {
    check(`googleCopy[${i}].headline1`, c.headline1, AD_HARD_LIMITS.googleHeadline);
    check(`googleCopy[${i}].headline2`, c.headline2, AD_HARD_LIMITS.googleHeadline);
    check(`googleCopy[${i}].headline3`, c.headline3, AD_HARD_LIMITS.googleHeadline);
    check(`googleCopy[${i}].description1`, c.description1, AD_HARD_LIMITS.googleDescription);
    check(`googleCopy[${i}].description2`, c.description2, AD_HARD_LIMITS.googleDescription);
  });
  body.metaCopy?.forEach((c, i) => {
    check(`metaCopy[${i}].headline`, c.headline, AD_HARD_LIMITS.metaHeadline);
  });

  return issues;
}

/** What a generated static ad image row stores in `assets.body`. */
export type AdImageBody = {
  formatKey: string;
  template: AdTemplateKey;
  headline: string;
  subheadline?: string;
  ctaLabel?: string;
  mediaItemId: string;
  conceptIndex: number;
  width: number;
  height: number;
};
