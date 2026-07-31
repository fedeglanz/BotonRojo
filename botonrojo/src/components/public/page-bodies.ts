import type { SectionDesign } from "./landing-types";

/**
 * Blocks a capture page can stack under its hero.
 *
 * The registro page used to be five fixed fields and a rigid two-column layout,
 * so a brief like "add a block with what you'll learn, and below it an image with
 * text and a button beside it" had nowhere to land: the model wrote new copy into
 * the same five fields and nothing visible changed. A closed set of blocks is what
 * makes that brief expressible — and closed, like the design vocabulary, so
 * nothing the renderer can't paint gets stored.
 */
export type PageBlock =
  | {
      type: "benefits";
      title?: string;
      /** 3-6 items. `icon` is a name from the icon vocabulary. */
      items: Array<{ icon?: string; title: string; text?: string }>;
    }
  | {
      type: "imageText";
      title?: string;
      text?: string;
      ctaLabel?: string;
      imagePrompt?: string;
      imageUrl?: string;
      /** Which side the image sits on. */
      imageSide?: "left" | "right";
    }
  | {
      type: "steps";
      title?: string;
      /** Numbered sequence — what happens after you sign up. */
      items: Array<{ title: string; text?: string }>;
    };

export type RegistroPageBody = {
  headline?: string;
  subheadline?: string;
  bullets?: string[];
  cta?: string;
  imagePrompt?: string;
  imageUrl?: string;
  /** Drop the hero photo when the brief asks for a background-driven hero and the
   *  form to be the only object on screen. */
  hideHeroImage?: boolean;
  blocks?: PageBlock[];
  /** Band design, same closed vocabulary as the landing sections. `blocks[i]`
   *  matches the block at that index. */
  design?: { hero?: SectionDesign; blocks?: SectionDesign[] };
};

export type ContenidoPageBody = {
  headline?: string;
  body?: string;
  ctaLabel?: string;
  imagePrompt?: string;
  imageUrl?: string;
  blocks?: PageBlock[];
  design?: { hero?: SectionDesign; blocks?: SectionDesign[] };
};

export type LegalPageBody = {
  title?: string;
  content?: string;
};

export type AfiliadosPageBody = {
  headline?: string;
  pitch?: string;
  commissionNote?: string;
  blocks?: PageBlock[];
  design?: { hero?: SectionDesign; blocks?: SectionDesign[] };
};
