export type RegistroPageBody = {
  headline?: string;
  subheadline?: string;
  bullets?: string[];
  cta?: string;
  imagePrompt?: string;
  imageUrl?: string;
};

export type ContenidoPageBody = {
  headline?: string;
  body?: string;
  ctaLabel?: string;
  imagePrompt?: string;
  imageUrl?: string;
};

export type LegalPageBody = {
  title?: string;
  content?: string;
};

export type AfiliadosPageBody = {
  headline?: string;
  pitch?: string;
  commissionNote?: string;
};
