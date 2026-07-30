export type AdFormatKey =
  | "meta_feed_1x1"
  | "meta_story_9x16"
  | "display_300x250"
  | "display_728x90"
  | "display_160x600"
  | "display_300x600";

export type AdFormat = {
  key: AdFormatKey;
  label: string;
  width: number;
  height: number;
  channel: "meta" | "google";
  /** Narrow banners can't fit a subheadline legibly. */
  compact: boolean;
};

export const AD_FORMATS: Record<AdFormatKey, AdFormat> = {
  meta_feed_1x1: { key: "meta_feed_1x1", label: "Meta feed 1:1", width: 1080, height: 1080, channel: "meta", compact: false },
  meta_story_9x16: { key: "meta_story_9x16", label: "Meta story/reel 9:16", width: 1080, height: 1920, channel: "meta", compact: false },
  display_300x250: { key: "display_300x250", label: "Display 300×250", width: 300, height: 250, channel: "google", compact: true },
  display_728x90: { key: "display_728x90", label: "Display 728×90", width: 728, height: 90, channel: "google", compact: true },
  display_160x600: { key: "display_160x600", label: "Display 160×600", width: 160, height: 600, channel: "google", compact: true },
  display_300x600: { key: "display_300x600", label: "Display 300×600", width: 300, height: 600, channel: "google", compact: false },
};

export const AD_FORMAT_LIST: AdFormat[] = Object.values(AD_FORMATS);

export type AdTemplateKey = "scrim-bottom" | "banda-superior" | "centro" | "lateral";

export const AD_TEMPLATES: Record<AdTemplateKey, { key: AdTemplateKey; label: string; description: string }> = {
  "scrim-bottom": {
    key: "scrim-bottom",
    label: "Texto abajo",
    description: "Foto a sangre con degradado inferior y el texto sobre él.",
  },
  "banda-superior": {
    key: "banda-superior",
    label: "Banda arriba",
    description: "Banda de color de marca arriba con el titular, foto debajo.",
  },
  centro: {
    key: "centro",
    label: "Centrado",
    description: "Foto oscurecida por completo y texto centrado encima.",
  },
  lateral: {
    key: "lateral",
    label: "Lateral",
    description: "Foto a un lado, bloque de color con el texto al otro.",
  },
};

export const AD_TEMPLATE_LIST = Object.values(AD_TEMPLATES);

export function isAdTemplateKey(value: string): value is AdTemplateKey {
  return value in AD_TEMPLATES;
}

export function isAdFormatKey(value: string): value is AdFormatKey {
  return value in AD_FORMATS;
}

/** What the signed render URL carries — everything the page needs to draw. */
export type AdRenderPayload = {
  imageUrl: string;
  headline: string;
  subheadline?: string;
  ctaLabel?: string;
  logoUrl?: string;
  template: AdTemplateKey;
  format: AdFormatKey;
  primary: string;
  accent: string;
  background: string;
  foreground: string;
  displayFont: string;
  bodyFont: string;
};
