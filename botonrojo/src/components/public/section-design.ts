import type { SectionBackground, SectionDesign, SectionEffect, SectionHeight, SectionWidth } from "./landing-types";

/**
 * Backgrounds read the brand variables injected by <BrandStyle>, never fixed
 * colours — a section must look right whatever palette the launch approved.
 */
const BACKGROUNDS: Record<SectionBackground, string> = {
  none: "",
  tint: "bg-[color-mix(in_srgb,var(--color-accent)_7%,transparent)]",
  accent: "bg-[color-mix(in_srgb,var(--color-accent)_16%,transparent)]",
  // A dark band must also force light text: on a light brand the page's own
  // foreground is near-black, which would be invisible here.
  dark: "bg-[color-mix(in_srgb,var(--color-fg)_4%,black_88%)] text-white [&_*]:!text-white/90",
  photo: "", // the photo layer is rendered as an <img>, not a class
  // Same reasoning as `dark`: the photo scrim is dark, so text goes light.
};

/**
 * Relaxes the inner section's own max-width without editing all 14 of them.
 * Uses a descendant selector, not `>`: the section is nested inside the shell's
 * content wrapper, so a direct-child selector silently matches nothing.
 */
const WIDTHS: Record<SectionWidth, string> = {
  normal: "",
  wide: "[&_section]:max-w-7xl",
  full: "[&_section]:max-w-none",
};

const HEIGHTS: Record<SectionHeight, string> = {
  auto: "",
  // Same pattern the hero already uses successfully.
  full: "flex min-h-[100svh] items-center",
};

export type ResolvedSectionDesign = {
  /** True when the design is entirely default — callers can skip the wrapper. */
  isDefault: boolean;
  wrapperClass: string;
  background: SectionBackground;
  effect: SectionEffect;
  imageUrl?: string;
  orbitItems?: Array<{ label: string; href?: string }>;
};

export function resolveSectionDesign(design?: SectionDesign | null): ResolvedSectionDesign {
  const background = design?.background ?? "none";
  const effect = design?.effect ?? "none";
  const height = design?.height ?? "auto";
  const width = design?.width ?? "normal";

  const isDefault =
    background === "none" && effect === "none" && height === "auto" && width === "normal";

  // The orbit needs a clear centre: its labels ride a ~52rem ring, so the copy
  // has to stay inside that or the labels land on top of the text (which would
  // break the legibility rule this whole feature is meant to serve). This wins
  // over the width token — a full-bleed column and an orbit are incompatible.
  const widthClass = effect === "orbit" ? "[&_section]:max-w-xl" : WIDTHS[width];

  return {
    isDefault,
    // `overflow-hidden` lives here, per-section, so decoration is clipped to its
    // own band instead of being cut off by a global clip on <main>.
    wrapperClass: ["relative w-full overflow-hidden", BACKGROUNDS[background], HEIGHTS[height], widthClass]
      .filter(Boolean)
      .join(" "),
    background,
    effect,
    imageUrl: design?.imageUrl,
    orbitItems: design?.orbitItems,
  };
}
