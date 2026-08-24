import {
  pgTable,
  text,
  timestamp,
  pgEnum,
  jsonb,
  integer,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { createId } from "@/lib/ids";
import { organizations } from "./organizations";
import type { PageConfig } from "@/lib/launch-pages";

export const launchType = pgEnum("launch_type", [
  "venta_directa",
  "semilla",
  "plf",
  // Sin carrito y sin fechas: captar suscriptores en evergreen.
  "newsletter",
]);
/**
 * Lo que se puede decidir del SEO de una página.
 *
 * El tipo vive junto a la tabla porque `lib/page-seo.ts` —quien lo usa— ya importa
 * `Launch` de aquí: definirlo allí y traerlo aquí cerraría un ciclo entre los dos.
 */
export type PageSeo = {
  title?: string;
  description?: string;
  /** `false` mete un noindex. Sin valor, decide el tipo de página. */
  index?: boolean;
  imageUrl?: string;
  canonicalUrl?: string;
};

export const launchStatus = pgEnum("launch_status", [
  "draft",
  "scheduled",
  "live",
  "closed",
  "archived",
]);
export const brandKitStatus = pgEnum("brand_kit_status", [
  "pending",
  "draft",
  "approved",
]);

export const launches = pgTable("launches", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => createId()),
  organizationId: text("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  type: launchType("type").notNull(),
  status: launchStatus("status").notNull().default("draft"),

  // Marco copy
  avatar: jsonb("avatar").$type<AvatarBrief | null>(),
  promise: text("promise"),
  painPoints: jsonb("pain_points").$type<string[]>().default([]),
  benefits: jsonb("benefits").$type<string[]>().default([]),

  // Pricing / product link
  defaultPriceCents: integer("default_price_cents"),
  /**
   * Pago a plazos, si lo hay: cuántos y de cuánto cada uno.
   *
   * Se guarda aparte del precio único porque no es un descuento ni otro nivel:
   * es el mismo producto pagado en varias veces, y el copy tiene que poder decir
   * "o 3 pagos de 39 €" sin que nadie lo calcule a mano — 97/3 no da un número
   * que se pueda cobrar.
   */
  installmentCount: integer("installment_count"),
  installmentPriceCents: integer("installment_price_cents"),
  currency: text("currency").default("EUR"),

  // Target market
  primaryCountry: text("primary_country"), // ISO 3166-1 alpha-2, e.g. "AR"
  targetRegions: jsonb("target_regions").$type<string[]>().default([]), // ["AR","CL","MX"] or ["LATAM","ES"]

  // Schedule
  anchorDate: timestamp("anchor_date", { mode: "date" }), // event / cart-open date
  /** When registration closes. The capture pages' countdown runs to this, which
   *  used to borrow the content drip date — a different thing entirely: the drip
   *  is when the content starts, not when you can no longer sign up. */
  registrationClosesAt: timestamp("registration_closes_at", { mode: "date" }),
  cartOpensAt: timestamp("cart_opens_at", { mode: "date" }),
  cartClosesAt: timestamp("cart_closes_at", { mode: "date" }),
  // PLF only — day "contenido-1" unlocks; contenido-2/3/4 unlock one day
  // later each. Null = no gating, every content page is visible immediately.
  contentDripStartsAt: timestamp("content_drip_starts_at", { mode: "date" }),

  // Affiliate
  affiliateCommissionRate: integer("affiliate_commission_rate_bps").default(
    3000,
  ),
  affiliateEnabled: boolean("affiliate_enabled").notNull().default(true),

  // Generated assets cache
  assetsCache: jsonb("assets_cache")
    .$type<Record<string, unknown>>()
    .default({}),

  // ActiveCampaign provisioning
  activeCampaignListId: integer("active_campaign_list_id"),
  activeCampaignTagIds: jsonb("active_campaign_tag_ids")
    .$type<Record<string, number>>()
    .default({}),

  // PDC Checkout (campus) provisioning
  pdcLaunchId: integer("pdc_launch_id"),
  pdcProductId: integer("pdc_product_id"),
  pdcPriceIds: jsonb("pdc_price_ids").$type<number[]>().default([]),

  // Telegram provisioning
  telegramChatId: text("telegram_chat_id"),
  telegramInviteLink: text("telegram_invite_link"),
  telegramBotAdded: boolean("telegram_bot_added").notNull().default(false),

  // Raw brief used to generate the marco copy (kept for re-generations)
  brief: text("brief"),

  // Brand kit — mandatory before any landing can be generated (see launch wizard step 1)
  brandKitStatus: brandKitStatus("brand_kit_status")
    .notNull()
    .default("pending"),
  brandPalette: jsonb("brand_palette").$type<BrandPalette | null>(),
  brandFonts: jsonb("brand_fonts").$type<BrandFonts | null>(),
  brandLogoUrl: text("brand_logo_url"),
  brandMoodImageUrl: text("brand_mood_image_url"),
  brandMoodNotes: text("brand_mood_notes"),
  /** The design decisions the brand kit makes for every page of this launch:
   *  box treatment, CTA, density, decoration. Before this the kit only decided
   *  colours and fonts, and each generation improvised the rest. */
  brandDesign: jsonb("brand_design").$type<BrandDesign | null>(),
  designSystemProjectId: text("design_system_project_id"),
  /**
   * Título, descripción e indexado de cada página, por `pageKey`.
   *
   * Aquí y no con el contenido de la página porque el contenido se sustituye —se
   * regenera, se rediseña en Claude— y el SEO no tiene por qué irse con él.
   */
  seo: jsonb("seo").$type<Record<string, PageSeo> | null>(),
  /**
   * Quién diseña este lanzamiento.
   *
   * "boton_rojo" es el generador de la plataforma: identidad visual propuesta por
   * nosotros y páginas compuestas con el sistema de diseño cerrado. "claude" es el
   * otro camino: la identidad y las páginas las hace Claude Design y llegan por el
   * conector. Se guarda porque cambia lo que el panel ofrece — con "claude", los
   * botones de generar sobrarían y regenerar borraría el diseño.
   */
  designMode: text("design_mode")
    .$type<"boton_rojo" | "claude">()
    .notNull()
    .default("boton_rojo"),

  // Free-text steer for the landing generator: change of angle, structure,
  // background treatment, whatever doesn't fit the fixed brief/avatar fields.
  landingGeneralInstructions: text("landing_general_instructions"),

  // Optional URL of a page the client likes — analyzed (structure + visual,
  // never colors) to steer the generated structure/tone. Best-effort only.
  referenceUrl: text("reference_url"),

  // Decisions made at creation time about which pages this launch gets
  // (registro channels, content-page count, legal pages, affiliate signup) —
  // see src/lib/launch-pages.ts. Null on launches created before this existed,
  // which keeps resolving to the single legacy page.
  pageConfig: jsonb("page_config").$type<PageConfig | null>(),

  createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { mode: "date" }).notNull().defaultNow(),
});

export type AvatarBrief = {
  who: string;
  age?: string;
  desires?: string[];
  fears?: string[];
  beliefs?: string[];
  context?: string;
};

/**
 * The system-level design choices, decided once with the brand kit and applied
 * to every page. Kept separate from BrandPalette because these are *structural*
 * decisions (how a box looks, how loud the page is), not colours.
 */
export type BrandDesign = {
  /** Box treatment for cards, forms and panels. */
  cardStyle:
    | "glass"
    | "liquid"
    | "flat"
    | "outline"
    | "soft"
    | "brutal"
    | "editorial";
  /** Primary button treatment. */
  ctaStyle: "solid" | "glow" | "outline" | "ghost" | "pill-arrow";
  /** How much air the sections get. */
  density: "compact" | "normal" | "spacious";
  /** Display treatment for section headings. */
  titleFx: "none" | "gradient" | "outline";
  /** Transition drawn between bands. */
  divider: "none" | "line" | "fade" | "angle" | "curve" | "dots";
  /** How much decoration the pages should carry overall. */
  intensity: "sobrio" | "equilibrado" | "expresivo";
  /** Ambient effects that suit this brand, in order of preference. */
  effects: Array<
    "none" | "orbit" | "geometry" | "aurora" | "grid" | "dots" | "noise"
  >;
};

export type BrandPalette = {
  primary: string;
  accent: string;
  background: string;
  foreground: string;
};

export type BrandFonts = {
  display: string;
  body: string;
};

export type LaunchType = (typeof launchType.enumValues)[number];
export type BrandKitStatus = (typeof brandKitStatus.enumValues)[number];
export type Launch = typeof launches.$inferSelect;
export type NewLaunch = typeof launches.$inferInsert;
