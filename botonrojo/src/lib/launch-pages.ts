import type { LaunchType } from "./launch-types";
import { createSlug } from "./ids";

export type LegalPageKey = "privacidad" | "terminos" | "cookies";

export const LEGAL_PAGE_LABELS: Record<LegalPageKey, string> = {
  privacidad: "Política de privacidad",
  terminos: "Términos y condiciones",
  cookies: "Política de cookies",
};

/**
 * A page somebody added that the launch type doesn't include by itself.
 *
 * The page set used to be entirely derived from the launch type, which is right
 * for the pages a launch always needs and wrong the moment a client wants one
 * more — a webinar page, a second sales page for a different angle. These are
 * stored rather than derived, and they carry their own kind so the renderer knows
 * what to do with them.
 */
export type ExtraPage = {
  pageKey: string;
  label: string;
  /** Which renderer and which generator prompt it uses. Never "legal": those are
   *  boilerplate the platform maintains, and one more of them means nothing. */
  kind: Exclude<PageKind, "legal">;
};

export type PageConfig = {
  /** PLF only — one registro page per channel label (e.g. "Instagram", "Email"). */
  registroChannels?: string[];
  /** PLF only — number of PLC/training content pages: 3 or 4. */
  contentPageCount?: 3 | 4;
  /** PLF only — whether an affiliate-signup teaser page is included. */
  includeAffiliateRegistro?: boolean;
  legalPages: LegalPageKey[];
  /** Pages added after the fact — from the connector or the panel. */
  extraPages?: ExtraPage[];
  /**
   * Set when a launch that predated page config gains its first extra page.
   *
   * Those launches resolve to a single page keyed "main", which is where every
   * asset they ever published lives. Writing a config to store the new page would
   * otherwise switch them onto the typed page set and "main" would vanish, taking
   * the live site with it. Recorded explicitly rather than inferred from the launch
   * type, because the type says nothing about what was published under it.
   */
  keepLegacyMain?: boolean;
};

export type PageKind =
  | "registro"
  | "venta"
  | "contenido"
  | "legal"
  | "afiliados"
  /**
   * Solo en newsletter. En los demás tipos el "gracias" es la ruta compartida
   * `/gracias` — siempre existe, distingue lead de compra y no hay que generarla.
   * Pero en una lista o un lead magnet esa página ES la entrega: ahí está la
   * descarga y lo que pasa a partir de ahora. Eso sí se diseña.
   */
  | "gracias"
  /** Darse de baja de la lista. Solo en newsletter. */
  | "baja";

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
export function resolvePages(
  type: LaunchType,
  config: PageConfig | null,
): PageDef[] {
  if (!config) {
    // Pre-config launches resolve to the single legacy page every existing asset
    // already uses. They can still gain pages: adding one writes a config with the
    // extra list, and this branch stops applying.
    return [{ pageKey: "main", kind: "venta", label: "Venta", isEntry: true }];
  }

  const pages: PageDef[] = [];

  // A launch that predates the typed page set keeps "main": it's where everything
  // it has ever published lives, and dropping it would blank the site. It does NOT
  // gain the pages its type would bring — it never had them, and adding a second
  // sales page next to the one in use only makes the panel lie about what exists.
  const legacy = Boolean(config.keepLegacyMain);
  if (legacy) {
    pages.push({
      pageKey: "main",
      kind: "venta",
      label: "Venta",
      isEntry: true,
    });
  }

  // Semilla y PLF siempre llevan registro + venta (con su "gracias" respectivo
  // — ver nota más abajo, no son PageDef porque no necesitan generarse).
  if (!legacy && type === "semilla") {
    pages.push({
      pageKey: "registro",
      kind: "registro",
      label: "Registro",
      isEntry: true,
    });
    pages.push({ pageKey: "venta", kind: "venta", label: "Venta" });
  }

  // Newsletter: captar y entregar, nada más. Sin venta, sin contenido con goteo y
  // sin countdown, porque no hay fecha hacia la que contar. La página de gracias es
  // la entrega —ahí está la descarga—, y la de baja tiene que existir por ley y por
  // decencia: quien se apunta tiene que poder irse en un clic.
  if (!legacy && type === "newsletter") {
    pages.push({
      pageKey: "registro",
      kind: "registro",
      label: "Registro",
      isEntry: true,
    });
    pages.push({
      pageKey: "gracias",
      kind: "gracias",
      label: "Gracias y entrega",
    });
    pages.push({ pageKey: "baja", kind: "baja", label: "Baja de la lista" });
  }

  if (!legacy && type === "venta_directa") {
    pages.push({
      pageKey: "venta",
      kind: "venta",
      label: "Venta",
      isEntry: true,
    });
  }

  if (!legacy && type === "plf") {
    const channels = config.registroChannels?.length
      ? config.registroChannels
      : ["General"];
    channels.forEach((channel, i) => {
      const pageKey = i === 0 ? "registro" : `registro-${createSlug(channel)}`;
      pages.push({
        pageKey,
        kind: "registro",
        label: `Registro — ${channel}`,
        isEntry: i === 0,
      });
    });

    // Only 3 or 4 are offered; clamp anything else (e.g. a value stored by an
    // older version of the form) rather than silently inflating it.
    const contentCount = (config.contentPageCount ?? 4) <= 3 ? 3 : 4;
    for (let i = 1; i <= contentCount; i++) {
      pages.push({
        pageKey: `contenido-${i}`,
        kind: "contenido",
        label: `Contenido ${i} de ${contentCount}`,
      });
    }

    pages.push({ pageKey: "venta", kind: "venta", label: "Venta" });

    if (config.includeAffiliateRegistro) {
      pages.push({
        pageKey: "afiliados",
        kind: "afiliados",
        label: "Registro de afiliados",
      });
    }
  }

  for (const extra of config.extraPages ?? []) {
    // Never shadow a page the type already provides: the typed one is the one every
    // other part of the app expects to find.
    if (pages.some((page) => page.pageKey === extra.pageKey)) continue;
    pages.push({
      pageKey: extra.pageKey,
      kind: extra.kind,
      label: extra.label,
    });
  }

  for (const legal of config.legalPages ?? []) {
    pages.push({
      pageKey: `legal-${legal}`,
      kind: "legal",
      label: LEGAL_PAGE_LABELS[legal],
    });
  }

  // Somebody has to be the entry page: without one, `/slug` renders nothing.
  if (!pages.some((page) => page.isEntry) && pages[0]) pages[0].isEntry = true;

  return pages;
}

/**
 * Turns a name into a usable pageKey, or explains why it can't.
 *
 * The key ends up in the public URL and in the asset rows, so it has to be
 * url-safe and stable. The reserved list is what would collide with a route or a
 * page the platform manages itself.
 */
const RESERVED_PAGE_KEYS = new Set([
  "main",
  "venta",
  "registro",
  "afiliados",
  "gracias",
  "api",
  "admin",
  "login",
  "archivos",
  "_sites",
]);

export function pageKeyFrom(
  input: string,
): { key: string } | { error: string } {
  const key = createSlug(input);
  if (!key)
    return { error: "Ese nombre no deja ninguna letra ni número usable." };
  if (key.length < 3) return { error: "El nombre es demasiado corto." };
  if (RESERVED_PAGE_KEYS.has(key)) {
    return {
      error: `"${key}" está reservado por la plataforma. Usa otro nombre.`,
    };
  }
  if (key.startsWith("legal-")) {
    return {
      error: "Las páginas legales las mantiene la plataforma; no se crean así.",
    };
  }
  if (/^contenido-\d+$/.test(key)) {
    return {
      error: `"${key}" es de las páginas de contenido con goteo. Usa otro nombre.`,
    };
  }
  return { key };
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
export function contentUnlockDate(
  dripStartsAt: Date | null,
  pageKey: string,
): Date | null {
  if (!dripStartsAt) return null;
  const match = /^contenido-(\d+)$/.exec(pageKey);
  if (!match) return null;
  const unlock = new Date(dripStartsAt);
  unlock.setDate(unlock.getDate() + (Number(match[1]) - 1));
  return unlock;
}
