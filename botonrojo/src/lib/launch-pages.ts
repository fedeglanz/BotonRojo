import type { LaunchType } from "./launch-types";
import { createSlug } from "./ids";

export type LegalPageKey = "privacidad" | "terminos" | "cookies";

export const LEGAL_PAGE_LABELS: Record<LegalPageKey, string> = {
  privacidad: "Política de privacidad",
  terminos: "Términos y condiciones",
  cookies: "Política de cookies",
};

export type PageConfig = {
  /** PLF only — one registro page per channel label (e.g. "Instagram", "Email"). */
  registroChannels?: string[];
  /** PLF only — number of PLC/training content pages: 3 or 4. */
  contentPageCount?: 3 | 4;
  /** PLF only — whether an affiliate-signup teaser page is included. */
  includeAffiliateRegistro?: boolean;
  legalPages: LegalPageKey[];
};

export type PageKind = "registro" | "venta" | "contenido" | "legal" | "afiliados";

export type PageDef = {
  pageKey: string;
  kind: PageKind;
  label: string;
  isEntry?: boolean;
};

/**
 * The single source of truth for "which pages does this launch have" — used
 * by the admin (to list them), the public routes (to resolve what to render),
 * and generateAllPagesAction (to know what to generate). `config === null`
 * means this launch was created before per-type page config existed, and
 * resolves to the single legacy page every pre-existing asset already uses
 * (pageKey "main") — zero data migration, zero regression for old launches.
 *
 * Not modeled here: "gracias por registro" and "gracias por compra". Every
 * registro/venta page already redirects to the existing generic `/gracias`
 * route (branded per launch, differentiates lead vs. purchase automatically)
 * — they always exist and never need AI generation, so they're not a
 * `PageDef`. Semilla and PLF both always have registro + venta (+ their
 * gracias) — that pairing is never optional.
 */
export function resolvePages(type: LaunchType, config: PageConfig | null): PageDef[] {
  if (!config) {
    return [{ pageKey: "main", kind: "venta", label: "Venta", isEntry: true }];
  }

  const pages: PageDef[] = [];

  // Semilla y PLF siempre llevan registro + venta (con su "gracias" respectivo
  // — ver nota más abajo, no son PageDef porque no necesitan generarse).
  if (type === "semilla") {
    pages.push({ pageKey: "registro", kind: "registro", label: "Registro", isEntry: true });
    pages.push({ pageKey: "venta", kind: "venta", label: "Venta" });
  }

  if (type === "venta_directa") {
    pages.push({ pageKey: "venta", kind: "venta", label: "Venta", isEntry: true });
  }

  if (type === "plf") {
    const channels = config.registroChannels?.length ? config.registroChannels : ["General"];
    channels.forEach((channel, i) => {
      const pageKey = i === 0 ? "registro" : `registro-${createSlug(channel)}`;
      pages.push({ pageKey, kind: "registro", label: `Registro — ${channel}`, isEntry: i === 0 });
    });

    // Only 3 or 4 are offered; clamp anything else (e.g. a value stored by an
    // older version of the form) rather than silently inflating it.
    const contentCount = (config.contentPageCount ?? 4) <= 3 ? 3 : 4;
    for (let i = 1; i <= contentCount; i++) {
      pages.push({ pageKey: `contenido-${i}`, kind: "contenido", label: `Contenido ${i} de ${contentCount}` });
    }

    pages.push({ pageKey: "venta", kind: "venta", label: "Venta" });

    if (config.includeAffiliateRegistro) {
      pages.push({ pageKey: "afiliados", kind: "afiliados", label: "Registro de afiliados" });
    }
  }

  for (const legal of config.legalPages ?? []) {
    pages.push({ pageKey: `legal-${legal}`, kind: "legal", label: LEGAL_PAGE_LABELS[legal] });
  }

  return pages;
}

/** `/slug` for the entry page, `/slug/pageKey` for every other page. */
export function pagePath(slug: string, pageDef: PageDef): string {
  return pageDef.isEntry ? `/${slug}` : `/${slug}/${pageDef.pageKey}`;
}

/**
 * PLF content pages drip one per day: "contenido-1" unlocks on
 * `dripStartsAt` itself, "contenido-2" the day after, etc. Returns `null`
 * when there's nothing to gate (no schedule set, or not a numbered content
 * page), in which case the page is always visible.
 */
export function contentUnlockDate(dripStartsAt: Date | null, pageKey: string): Date | null {
  if (!dripStartsAt) return null;
  const match = /^contenido-(\d+)$/.exec(pageKey);
  if (!match) return null;
  const unlock = new Date(dripStartsAt);
  unlock.setDate(unlock.getDate() + (Number(match[1]) - 1));
  return unlock;
}
