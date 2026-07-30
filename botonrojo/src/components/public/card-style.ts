import type { LandingCardStyle } from "./landing-types";

/**
 * Tailwind classes for each "box" treatment, plus whether the sci-fi corner
 * brackets (.hud-corners — very tied to Botón Rojo's own dark HUD identity)
 * make sense on top of it. Only "glass" (the default/current look) uses them.
 */
const CARD_STYLES: Record<LandingCardStyle, { box: string; hudCorners: boolean }> = {
  glass: { box: "glass", hudCorners: true },
  flat: {
    box: "rounded-xl border border-[--color-muted-3]/30 bg-[color-mix(in_srgb,var(--color-fg)_5%,transparent)]",
    hudCorners: false,
  },
  outline: {
    box: "rounded-2xl border-2 border-[--color-accent]/40 bg-transparent",
    hudCorners: false,
  },
  soft: {
    box: "rounded-2xl border border-[--color-muted-3]/20 bg-[color-mix(in_srgb,var(--color-fg)_6%,transparent)] shadow-[0_20px_50px_-30px_rgba(0,0,0,0.35)]",
    hudCorners: false,
  },
};

export function resolveCardStyle(cardStyle?: LandingCardStyle) {
  return CARD_STYLES[cardStyle ?? "glass"];
}
