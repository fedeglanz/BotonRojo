import "server-only";

import { and, desc, eq, gte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";

import { db } from "@/db";
import {
  assets,
  launches,
  mcpTokens,
  products,
  trackingEvents,
  users,
} from "@/db/schema";
import {
  resolvePages,
  pagePath,
  pageKeyFrom,
  type PageDef,
  type PageConfig,
  type ExtraPage,
} from "@/lib/launch-pages";
import type { LaunchType } from "@/lib/launch-types";
import { env } from "@/lib/env";
import {
  storage,
  BUCKET,
  ensureBucket,
  publicUrlFor,
} from "@/integrations/storage";
import { createId } from "@/lib/ids";
import {
  isCustomPageBody,
  rewriteAssetPaths,
  unresolvedReferences,
  type CustomPageAssets,
  type CustomPageBody,
} from "@/lib/custom-page";
import { startPageGeneration, readGenerationProgress } from "@/server/launches";
import {
  listPendingTasks,
  listLaunchTasks,
  completeTask,
} from "@/server/launch-tasks";
import {
  normalizeBrandDesign,
  BRAND_DESIGN_OPTIONS,
} from "@/lib/design/brand-design";
import type { BrandFonts, BrandPalette } from "@/db/schema/launches";
import { PAGE_CONTRACT } from "./contract";
import { canPublishCustomPages, type McpAuth } from "./auth";

/**
 * The tools Claude gets.
 *
 * Every one of them is scoped to the token's organization: the launch id is an
 * argument, but it's always re-read with the organization in the WHERE clause, so a
 * token can't be pointed at somebody else's launch by guessing an id.
 */

export type ToolDef = {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (auth: McpAuth, args: Record<string, unknown>) => Promise<unknown>;
};

const NO_ARGS = { type: "object", properties: {}, additionalProperties: false };

/* --------------------------------------------------------------- utilities -- */

async function requireLaunch(auth: McpAuth, slugOrId: unknown) {
  const key = String(slugOrId ?? "").trim();
  if (!key) throw new ToolError("Falta el lanzamiento (slug o id).");

  const [launch] = await db
    .select()
    .from(launches)
    .where(
      and(
        eq(launches.organizationId, auth.organization.id),
        // The slug is what a person says out loud, so both are accepted.
        sql`(${launches.slug} = ${key} or ${launches.id} = ${key})`,
      ),
    )
    .limit(1);

  if (!launch)
    throw new ToolError(`No hay ningún lanzamiento "${key}" en esta cuenta.`);
  return launch;
}

function requirePage(
  launch: { type: string; pageConfig: unknown; slug: string },
  pageKey: unknown,
): PageDef {
  const key = String(pageKey ?? "").trim();
  const pages = resolvePages(
    launch.type as LaunchType,
    launch.pageConfig as never,
  );
  const page = pages.find((p) => p.pageKey === key);
  if (!page) {
    throw new ToolError(
      `Ese lanzamiento no tiene la página "${key}". Las que tiene: ${pages.map((p) => p.pageKey).join(", ")}.`,
    );
  }
  return page;
}

/** A message meant for Claude to read out, not a crash. */
export class ToolError extends Error {}

const PAGE_KINDS = ["registro", "venta", "contenido", "afiliados"] as const;

/**
 * Adds a page to a launch and returns it.
 *
 * The page set used to come entirely from the launch type, so "one more page" had
 * no answer: the connector could only publish over what already existed. Extra
 * pages are stored in `pageConfig`, which is also what a launch created before
 * page config existed lacks entirely — hence the empty config built here rather
 * than refusing.
 */
async function addExtraPage(
  launch: {
    id: string;
    slug: string;
    type: string;
    pageConfig: PageConfig | null;
  },
  input: { nombre: unknown; tipo: unknown },
): Promise<PageDef> {
  const parsed = pageKeyFrom(String(input.nombre ?? "").trim());
  if ("error" in parsed) throw new ToolError(parsed.error);

  const kind = String(input.tipo ?? "venta");
  if (!(PAGE_KINDS as readonly string[]).includes(kind)) {
    throw new ToolError(
      `El tipo de página tiene que ser uno de: ${PAGE_KINDS.join(", ")}.`,
    );
  }

  const existing = resolvePages(launch.type as LaunchType, launch.pageConfig);
  if (existing.some((page) => page.pageKey === parsed.key)) {
    throw new ToolError(`Ese lanzamiento ya tiene una página "${parsed.key}".`);
  }

  const extra: ExtraPage = {
    pageKey: parsed.key,
    label: String(input.nombre).trim(),
    kind: kind as ExtraPage["kind"],
  };

  // A launch with no config at all is a pre-config one: its only page is "main"
  // and everything it has published lives there. The flag is what stops writing a
  // config from switching it onto the typed page set and blanking the live site.
  const config: PageConfig = launch.pageConfig ?? {
    legalPages: [],
    keepLegacyMain: true,
  };
  const next: PageConfig = {
    ...config,
    extraPages: [...(config.extraPages ?? []), extra],
  };

  await db
    .update(launches)
    .set({ pageConfig: next, updatedAt: new Date() })
    .where(eq(launches.id, launch.id));

  // The caller's copy is now stale, and it's about to publish onto this page.
  launch.pageConfig = next;

  const pageDef = resolvePages(launch.type as LaunchType, next).find(
    (p) => p.pageKey === parsed.key,
  );
  if (!pageDef)
    throw new ToolError(
      "La página se ha guardado pero no se resuelve; avisa al equipo.",
    );
  return pageDef;
}

/** Un color de marca o un error que se entiende. */
function hexOrFail(raw: unknown, field: string): string {
  const value = String(raw ?? "").trim();
  if (!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) {
    throw new ToolError(
      `El color "${field}" tiene que ser hexadecimal (#1b1b18). Ha llegado: ${value || "(vacío)"}.`,
    );
  }
  return value.toLowerCase();
}

function absoluteUrl(path: string): string {
  return `${env.APP_URL.replace(/\/$/, "")}${path}`;
}

/* ------------------------------------------------------------------- tools -- */

const listarLanzamientos: ToolDef = {
  name: "listar_lanzamientos",
  title: "Listar lanzamientos",
  description:
    "Los lanzamientos de la cuenta, con su estado y sus páginas. Empieza siempre por aquí: el resto de herramientas piden el slug de un lanzamiento.",
  inputSchema: NO_ARGS,
  handler: async (auth) => {
    const rows = await db
      .select()
      .from(launches)
      .where(eq(launches.organizationId, auth.organization.id))
      .orderBy(desc(launches.createdAt));

    return {
      cuenta: auth.organization.name,
      plan: auth.organization.plan,
      puede_publicar_diseno_propio: canPublishCustomPages(auth.organization),
      lanzamientos: rows.map((l) => ({
        slug: l.slug,
        nombre: l.name,
        tipo: l.type,
        estado: l.status,
        marca_aprobada: l.brandKitStatus === "approved",
        copy_listo: Boolean(l.promise && l.avatar),
        paginas: resolvePages(l.type as LaunchType, l.pageConfig).map(
          (p) => p.pageKey,
        ),
      })),
    };
  },
};

const contextoLanzamiento: ToolDef = {
  name: "contexto_lanzamiento",
  title: "Contexto de un lanzamiento",
  description:
    "Todo lo que hace falta para diseñar sus páginas: marca (colores, tipografías, logo), promesa, avatar, dolores, beneficios, productos con precios, fechas de cierre y qué páginas hay. Léelo antes de diseñar.",
  inputSchema: {
    type: "object",
    properties: {
      lanzamiento: { type: "string", description: "Slug del lanzamiento" },
    },
    required: ["lanzamiento"],
    additionalProperties: false,
  },
  handler: async (auth, args) => {
    const launch = await requireLaunch(auth, args.lanzamiento);
    const launchProducts = await db
      .select()
      .from(products)
      .where(and(eq(products.launchId, launch.id), eq(products.active, true)));

    const pages = resolvePages(launch.type as LaunchType, launch.pageConfig);
    const existing = await db
      .select({
        pageKey: assets.pageKey,
        body: assets.body,
        updatedAt: assets.updatedAt,
      })
      .from(assets)
      .where(and(eq(assets.launchId, launch.id), eq(assets.kind, "landing")))
      .orderBy(desc(assets.createdAt));

    const latest = new Map<string, (typeof existing)[number]>();
    for (const row of existing)
      if (!latest.has(row.pageKey)) latest.set(row.pageKey, row);

    return {
      slug: launch.slug,
      nombre: launch.name,
      tipo: launch.type,
      promesa: launch.promise,
      avatar: launch.avatar,
      dolores: launch.painPoints ?? [],
      beneficios: launch.benefits ?? [],
      marca: {
        estado: launch.brandKitStatus,
        paleta: launch.brandPalette,
        tipografias: launch.brandFonts,
        logo: launch.brandLogoUrl,
        // The design system already chosen for this launch — a page designed
        // outside should look like the rest of it, not like a different product.
        diseno: launch.brandDesign,
      },
      precios: {
        pago_unico_centimos: launch.defaultPriceCents,
        moneda: launch.currency ?? "EUR",
        plazos:
          launch.installmentCount && launch.installmentPriceCents
            ? {
                numero: launch.installmentCount,
                cada_centimos: launch.installmentPriceCents,
              }
            : null,
      },
      productos: launchProducts.map((p) => ({
        slug: p.slug,
        nombre: p.name,
        precio_centimos: p.priceCents,
        moneda: p.currency,
        cobrable: Boolean(p.stripePriceId),
      })),
      fechas: {
        cierre_carrito: launch.cartClosesAt?.toISOString() ?? null,
        cierre_registro: launch.registrationClosesAt?.toISOString() ?? null,
        inicio_contenidos: launch.contentDripStartsAt?.toISOString() ?? null,
      },
      afiliados: {
        comision_por_ciento: (launch.affiliateCommissionRate ?? 3000) / 100,
      },
      paginas: pages.map((p) => {
        const row = latest.get(p.pageKey);
        return {
          pagina: p.pageKey,
          etiqueta: p.label,
          tipo: p.kind,
          url: absoluteUrl(pagePath(launch.slug, p)),
          estado: !row
            ? "sin_generar"
            : isCustomPageBody(row.body)
              ? "diseno_propio"
              : "generada",
          actualizada: row?.updatedAt?.toISOString() ?? null,
          // Legal pages stay ours on purpose: boilerplate nobody should redesign.
          publicable: p.kind !== "legal",
        };
      }),
      instrucciones_de_diseno: launch.landingGeneralInstructions,
    };
  },
};

const contratoPagina: ToolDef = {
  name: "contrato_pagina",
  title: "Contrato de diseño",
  description:
    "Las reglas que tiene que cumplir un HTML para que, una vez publicado, funcionen el formulario, el pago, la cuenta atrás, la medición y los afiliados. Léelo ANTES de diseñar una página.",
  inputSchema: NO_ARGS,
  handler: async () => PAGE_CONTRACT,
};

const publicarPagina: ToolDef = {
  name: "publicar_pagina",
  title: "Publicar una página diseñada",
  description:
    "Publica un HTML propio en una página del lanzamiento. Sustituye a la página generada, que se conserva y vuelve con retirar_pagina. Requiere plan pro.",
  inputSchema: {
    type: "object",
    properties: {
      lanzamiento: { type: "string", description: "Slug del lanzamiento" },
      pagina: {
        type: "string",
        description:
          'Clave de la página, tal como la da contexto_lanzamiento (p. ej. "registro", "venta"). Si no existe y pasas "crear", se crea al publicar.',
      },
      crear: {
        type: "string",
        enum: ["registro", "venta", "contenido", "afiliados"],
        description:
          'Solo si la página no existe todavía: créala con este tipo y publica en ella de una vez. "registro" para captar leads, "venta" para vender, "contenido" para entregar, "afiliados" para reclutar.',
      },
      html: {
        type: "string",
        description:
          "Documento HTML completo, tal cual, sin inlinear los archivos",
      },
      titulo: { type: "string", description: "Título de la página (opcional)" },
      archivos: {
        type: "array",
        description:
          'Los css/js/imágenes que el HTML referencia con rutas relativas. Para IMÁGENES usa siempre "url" y deja que el servidor la descargue: mandarlas en base64 te obliga a escribir megas de texto y la llamada no termina. "contenido" solo para css/js pequeños.',
        items: {
          type: "object",
          properties: {
            nombre: {
              type: "string",
              description: "La ruta tal como aparece en el HTML",
            },
            url: {
              type: "string",
              description:
                "De dónde bajarlo. Es la forma recomendada para imágenes, vídeos y fuentes: lo descarga el servidor.",
            },
            contenido: {
              type: "string",
              description: "El contenido en texto. Solo para css/js pequeños.",
            },
            base64: {
              type: "boolean",
              description: "true si contenido viene en base64",
            },
          },
          required: ["nombre"],
          additionalProperties: false,
        },
      },
    },
    required: ["lanzamiento", "pagina", "html"],
    additionalProperties: false,
  },
  handler: async (auth, args) => {
    if (!canPublishCustomPages(auth.organization)) {
      throw new ToolError(
        `El plan de esta cuenta (${auth.organization.plan}) no publica diseño propio. Puedes generar la página con el sistema de Botón Rojo usando generar_pagina, o subir el plan a pro.`,
      );
    }

    const launch = await requireLaunch(auth, args.lanzamiento);

    // Publishing onto a page that doesn't exist yet is the common case for a launch
    // that never had one. Creating it here saves a round trip, and creating it
    // *before* publishing means a failed publish doesn't leave an empty page behind
    // — the page and its content arrive together or not at all.
    const known = resolvePages(launch.type as LaunchType, launch.pageConfig);
    const asked = String(args.pagina ?? "").trim();
    const pageDef =
      args.crear && !known.some((page) => page.pageKey === asked)
        ? await addExtraPage(launch, { nombre: asked, tipo: args.crear })
        : requirePage(launch, args.pagina);

    if (pageDef.kind === "legal") {
      throw new ToolError(
        "Las páginas legales no se rediseñan: su texto lo mantiene la plataforma.",
      );
    }

    const html = String(args.html ?? "");
    if (html.length < 200)
      throw new ToolError(
        "Ese HTML está vacío o es demasiado corto para ser una página.",
      );

    // Upload first: the page must never be stored pointing at files that failed.
    const files = await uploadFiles(
      auth,
      launch.slug,
      pageDef.pageKey,
      args.archivos,
    );
    const missing = unresolvedReferences(html, files);
    if (missing.length) {
      throw new ToolError(
        `Faltan archivos que el HTML referencia: ${missing.join(", ")}. Mándalos en "archivos" y vuelve a publicar.`,
      );
    }

    const [token] = await db
      .select()
      .from(mcpTokens)
      .where(eq(mcpTokens.id, auth.tokenId))
      .limit(1);

    const body: CustomPageBody = {
      format: "html",
      html,
      files,
      publishedAt: new Date().toISOString(),
      source: "claude-design",
      title: String(args.titulo ?? "") || pageDef.label,
    };

    await db.insert(assets).values({
      organizationId: auth.organization.id,
      launchId: launch.id,
      kind: "landing",
      pageKey: pageDef.pageKey,
      title: body.title ?? pageDef.label,
      body: body as unknown as Record<string, unknown>,
      authorId: token?.createdById ?? null,
      generatedByAi: "claude-design",
    });

    const path = pagePath(launch.slug, pageDef);
    revalidatePath(path);
    revalidatePath(`/admin/lanzamientos/${launch.slug}`);
    revalidatePath(
      `/admin/lanzamientos/${launch.slug}/paginas/${pageDef.pageKey}`,
    );

    return {
      publicada: true,
      url: absoluteUrl(path),
      archivos_alojados: Object.keys(files).length,
      aviso:
        "La página ya está en vivo. La medición, el formulario, el pago y los afiliados están cableados por la plataforma.",
    };
  },
};

const crearPagina: ToolDef = {
  name: "crear_pagina",
  title: "Crear una página nueva",
  description:
    "Añade al lanzamiento una página que su tipo no trae de serie: un webinar, una segunda página de venta, una de gracias propia. Devuelve su clave y su URL, listas para publicar o generar.",
  inputSchema: {
    type: "object",
    properties: {
      lanzamiento: { type: "string" },
      nombre: {
        type: "string",
        description:
          'Nombre de la página. De ahí sale la URL: "Webinar de junio" → /slug/webinar-de-junio',
      },
      tipo: {
        type: "string",
        enum: ["registro", "venta", "contenido", "afiliados"],
        description:
          "Para qué es: registro (captar leads), venta (vender), contenido (entregar), afiliados (reclutar). Decide el formulario y los botones que la plataforma cablea.",
      },
    },
    required: ["lanzamiento", "nombre", "tipo"],
    additionalProperties: false,
  },
  handler: async (auth, args) => {
    const launch = await requireLaunch(auth, args.lanzamiento);
    const pageDef = await addExtraPage(launch, {
      nombre: args.nombre,
      tipo: args.tipo,
    });

    revalidatePath(`/admin/lanzamientos/${launch.slug}`);
    return {
      creada: true,
      pagina: pageDef.pageKey,
      tipo: pageDef.kind,
      url: absoluteUrl(pagePath(launch.slug, pageDef)),
      siguiente:
        "Todavía no tiene contenido: publica un HTML con publicar_pagina o genérala con generar_pagina.",
    };
  },
};

const borrarPagina: ToolDef = {
  name: "borrar_pagina",
  title: "Borrar una página añadida",
  description:
    "Quita una página de las que se añadieron con crear_pagina, junto con lo que se hubiera publicado en ella. Las páginas que trae el tipo de lanzamiento no se pueden borrar.",
  inputSchema: {
    type: "object",
    properties: { lanzamiento: { type: "string" }, pagina: { type: "string" } },
    required: ["lanzamiento", "pagina"],
    additionalProperties: false,
  },
  handler: async (auth, args) => {
    const launch = await requireLaunch(auth, args.lanzamiento);
    const key = String(args.pagina ?? "").trim();
    const config = launch.pageConfig;
    const extras = config?.extraPages ?? [];

    if (!extras.some((extra) => extra.pageKey === key)) {
      throw new ToolError(
        `"${key}" no es una página añadida: o no existe, o viene con el tipo de lanzamiento y no se puede borrar.`,
      );
    }

    const pageDef = requirePage(launch, key);
    const path = pagePath(launch.slug, pageDef);

    await db
      .update(launches)
      .set({
        pageConfig: {
          ...config!,
          extraPages: extras.filter((extra) => extra.pageKey !== key),
        },
        updatedAt: new Date(),
      })
      .where(eq(launches.id, launch.id));

    // Its assets go too: leaving them would resurrect the old content if somebody
    // later created a page with the same name.
    await db
      .delete(assets)
      .where(and(eq(assets.launchId, launch.id), eq(assets.pageKey, key)));

    revalidatePath(path);
    revalidatePath(`/admin/lanzamientos/${launch.slug}`);
    return { borrada: true, pagina: key };
  },
};

const trabajoPendiente: ToolDef = {
  name: "trabajo_pendiente",
  title: "Qué hay pendiente",
  description:
    "La lista de trabajo que Botón Rojo ha dejado apuntada: identidades visuales y páginas por diseñar, en el orden en que tienen sentido. Empieza por aquí cuando te pidan hacer un lanzamiento entero, y ve haciéndolas de una en una.",
  inputSchema: {
    type: "object",
    properties: {
      lanzamiento: {
        type: "string",
        description:
          "Para ver solo la cola de un lanzamiento. Sin esto, todo lo pendiente de la cuenta.",
      },
    },
    additionalProperties: false,
  },
  handler: async (auth, args) => {
    const asked = String(args.lanzamiento ?? "").trim();
    const launch = asked ? await requireLaunch(auth, asked) : null;

    const tasks = launch
      ? (await listLaunchTasks(launch.id, auth.organization.id)).filter(
          (task) => task.status === "pending",
        )
      : await listPendingTasks(auth.organization.id);

    if (!tasks.length) {
      return {
        pendiente: [],
        aviso: launch
          ? `No queda nada apuntado en ${launch.slug}.`
          : "No hay trabajo pendiente en esta cuenta.",
      };
    }

    // El slug de cada lanzamiento, que es lo que piden el resto de herramientas.
    const slugs = new Map<string, string>();
    for (const task of tasks) {
      if (slugs.has(task.launchId)) continue;
      const [row] = await db
        .select({ slug: launches.slug })
        .from(launches)
        .where(eq(launches.id, task.launchId))
        .limit(1);
      if (row) slugs.set(task.launchId, row.slug);
    }

    return {
      pendiente: tasks.map((task) => ({
        lanzamiento: slugs.get(task.launchId) ?? task.launchId,
        que: task.kind === "design_system" ? "identidad_visual" : "pagina",
        pagina: task.pageKey,
        titulo: task.label,
        instruccion: task.instruction,
      })),
      como_se_hace: [
        "identidad_visual: propón paleta, tipografías y estilo, y guárdala con guardar_identidad. Hasta que no esté, las páginas no se pueden diseñar con la marca del lanzamiento.",
        "pagina: contexto_lanzamiento y contrato_pagina, diseña el HTML y publícalo con publicar_pagina.",
      ],
      aviso:
        "Cada tarea se cierra sola al guardar la identidad o al publicar la página; no hay que avisar de nada. Ve de una en una y cuéntame qué vas haciendo.",
    };
  },
};

const guardarIdentidad: ToolDef = {
  name: "guardar_identidad",
  title: "Guardar la identidad visual",
  description:
    "Guarda la paleta, las tipografías y el estilo del lanzamiento, y la deja aprobada. Es el primer paso de un lanzamiento que se diseña en Claude: el resto de páginas, y el generador de Botón Rojo, usan esto.",
  inputSchema: {
    type: "object",
    properties: {
      lanzamiento: { type: "string" },
      paleta: {
        type: "object",
        description: "Cuatro colores en hexadecimal.",
        properties: {
          primary: {
            type: "string",
            description: "Color de marca, el de los botones",
          },
          accent: {
            type: "string",
            description: "Acento para detalles y destacados",
          },
          background: { type: "string", description: "Fondo de las páginas" },
          foreground: {
            type: "string",
            description: "Color del texto sobre ese fondo",
          },
        },
        required: ["primary", "accent", "background", "foreground"],
        additionalProperties: false,
      },
      tipografias: {
        type: "object",
        description: "Nombres tal como los publica Google Fonts.",
        properties: {
          display: { type: "string", description: "Para titulares" },
          body: { type: "string", description: "Para texto" },
        },
        required: ["display", "body"],
        additionalProperties: false,
      },
      estilo: {
        type: "object",
        description:
          "Decisiones estructurales. Lo que no encaje con el vocabulario se ajusta al valor más cercano en vez de romper.",
        properties: {
          cardStyle: {
            type: "string",
            enum: [...BRAND_DESIGN_OPTIONS.cardStyle],
          },
          ctaStyle: {
            type: "string",
            enum: [...BRAND_DESIGN_OPTIONS.ctaStyle],
          },
          density: { type: "string", enum: [...BRAND_DESIGN_OPTIONS.density] },
          titleFx: { type: "string", enum: [...BRAND_DESIGN_OPTIONS.titleFx] },
          divider: { type: "string", enum: [...BRAND_DESIGN_OPTIONS.divider] },
          intensity: {
            type: "string",
            enum: [...BRAND_DESIGN_OPTIONS.intensity],
          },
          effects: {
            type: "array",
            items: { type: "string", enum: [...BRAND_DESIGN_OPTIONS.effects] },
          },
        },
        additionalProperties: false,
      },
      notas: {
        type: "string",
        description:
          "En qué se ha pensado al elegirla: tono, referencias, qué se evita.",
      },
    },
    required: ["lanzamiento", "paleta", "tipografias"],
    additionalProperties: false,
  },
  handler: async (auth, args) => {
    const launch = await requireLaunch(auth, args.lanzamiento);

    const paleta = args.paleta as Record<string, unknown> | undefined;
    const palette = {
      primary: hexOrFail(paleta?.primary, "primary"),
      accent: hexOrFail(paleta?.accent, "accent"),
      background: hexOrFail(paleta?.background, "background"),
      foreground: hexOrFail(paleta?.foreground, "foreground"),
    } satisfies BrandPalette;

    const tipos = args.tipografias as Record<string, unknown> | undefined;
    const display = String(tipos?.display ?? "").trim();
    const body = String(tipos?.body ?? "").trim();
    if (!display || !body) {
      throw new ToolError(
        "Hacen falta las dos tipografías: una para titulares y otra para texto.",
      );
    }
    const fonts = { display, body } satisfies BrandFonts;

    // El estilo pasa por el mismo normalizador que el panel: lo que no esté en el
    // vocabulario se ajusta al valor más cercano en vez de llegar a la página.
    const design = normalizeBrandDesign(args.estilo ?? null, palette);

    await db
      .update(launches)
      .set({
        brandPalette: palette,
        brandFonts: fonts,
        brandDesign: design,
        brandMoodNotes:
          String(args.notas ?? "").trim() || launch.brandMoodNotes,
        // Aprobada directamente: la ha decidido quien está diseñando, y dejarla en
        // borrador obligaría a volver al panel a darle a un botón de aprobar en medio
        // de un trabajo que va del tirón.
        brandKitStatus: "approved",
        updatedAt: new Date(),
      })
      .where(eq(launches.id, launch.id));

    await completeTask({
      launchId: launch.id,
      kind: "design_system",
      result: `${palette.primary} · ${display} / ${body}`,
    });

    revalidatePath(`/admin/lanzamientos/${launch.slug}`);
    return {
      guardada: true,
      aprobada: true,
      estilo_ajustado: design,
      siguiente:
        "Ya puedes diseñar las páginas: mira trabajo_pendiente para ver cuáles quedan.",
    };
  },
};

const verPagina: ToolDef = {
  name: "ver_pagina",
  title: "Ver el HTML publicado",
  description:
    "Devuelve el HTML que hay publicado ahora mismo en una página, para poder retocarlo en vez de rehacerlo. Si la página es generada por Botón Rojo, lo dice.",
  inputSchema: {
    type: "object",
    properties: {
      lanzamiento: { type: "string" },
      pagina: { type: "string" },
    },
    required: ["lanzamiento", "pagina"],
    additionalProperties: false,
  },
  handler: async (auth, args) => {
    const launch = await requireLaunch(auth, args.lanzamiento);
    const pageDef = requirePage(launch, args.pagina);
    const [asset] = await db
      .select()
      .from(assets)
      .where(
        and(
          eq(assets.launchId, launch.id),
          eq(assets.kind, "landing"),
          eq(assets.pageKey, pageDef.pageKey),
        ),
      )
      .orderBy(desc(assets.createdAt))
      .limit(1);

    if (!asset)
      return {
        estado: "sin_generar",
        url: absoluteUrl(pagePath(launch.slug, pageDef)),
      };
    if (!isCustomPageBody(asset.body)) {
      return {
        estado: "generada",
        url: absoluteUrl(pagePath(launch.slug, pageDef)),
        aviso:
          "Esta página la genera Botón Rojo desde el copy. Publicar diseño propio la sustituye.",
        contenido: asset.body,
      };
    }

    return {
      estado: "diseno_propio",
      url: absoluteUrl(pagePath(launch.slug, pageDef)),
      publicada: asset.body.publishedAt,
      archivos: Object.keys(asset.body.files ?? {}),
      html: asset.body.html,
    };
  },
};

const retirarPagina: ToolDef = {
  name: "retirar_pagina",
  title: "Retirar el diseño propio",
  description:
    "Quita el HTML publicado y devuelve la página generada por Botón Rojo, que seguía guardada debajo. Si no había ninguna, la página queda sin generar.",
  inputSchema: {
    type: "object",
    properties: { lanzamiento: { type: "string" }, pagina: { type: "string" } },
    required: ["lanzamiento", "pagina"],
    additionalProperties: false,
  },
  handler: async (auth, args) => {
    const launch = await requireLaunch(auth, args.lanzamiento);
    const pageDef = requirePage(launch, args.pagina);

    const rows = await db
      .select()
      .from(assets)
      .where(
        and(
          eq(assets.launchId, launch.id),
          eq(assets.kind, "landing"),
          eq(assets.pageKey, pageDef.pageKey),
        ),
      )
      .orderBy(desc(assets.createdAt));

    // Only the custom ones at the top go: whatever generated version sits below
    // becomes the newest again, which is what "restore" has to mean here.
    const toDelete: string[] = [];
    for (const row of rows) {
      if (!isCustomPageBody(row.body)) break;
      toDelete.push(row.id);
    }
    if (!toDelete.length)
      throw new ToolError("Esa página no tiene diseño propio publicado.");

    for (const id of toDelete) await db.delete(assets).where(eq(assets.id, id));

    const path = pagePath(launch.slug, pageDef);
    revalidatePath(path);
    revalidatePath(`/admin/lanzamientos/${launch.slug}`);

    const restored = rows.find((row) => !isCustomPageBody(row.body));
    return {
      retirada: true,
      url: absoluteUrl(path),
      ahora: restored ? "generada" : "sin_generar",
    };
  },
};

const generarPagina: ToolDef = {
  name: "generar_pagina",
  title: "Generar una página con Botón Rojo",
  description:
    "Genera (o regenera) una página con el sistema de diseño de Botón Rojo a partir de un brief en lenguaje natural. No necesita plan pro ni Claude Design: el diseño lo compone la plataforma.",
  inputSchema: {
    type: "object",
    properties: {
      lanzamiento: { type: "string" },
      pagina: { type: "string" },
      brief: {
        type: "string",
        description:
          'Qué quieres de esta página, en español ("fondo oscuro, la caja de registro como protagonista…")',
      },
    },
    required: ["lanzamiento", "pagina"],
    additionalProperties: false,
  },
  handler: async (auth, args) => {
    const launch = await requireLaunch(auth, args.lanzamiento);
    const pageDef = requirePage(launch, args.pagina);
    const [token] = await db
      .select()
      .from(mcpTokens)
      .where(eq(mcpTokens.id, auth.tokenId))
      .limit(1);
    if (!token?.createdById) {
      throw new ToolError(
        "Este token no tiene un usuario asociado; vuelve a crearlo desde el panel.",
      );
    }

    // These two conditions are checked before starting, because they're the usual
    // reasons it fails and they have a concrete fix. Everything after this point
    // happens in the background, where the only way to report a problem is the
    // progress record.
    if (!launch.promise || !launch.avatar) {
      throw new ToolError(
        "Ese lanzamiento no tiene todavía promesa y avatar. Complétalos en el panel y vuelve.",
      );
    }
    if (
      launch.brandKitStatus !== "approved" ||
      !launch.brandPalette ||
      !launch.brandFonts
    ) {
      throw new ToolError(
        "La identidad visual del lanzamiento no está aprobada. Apruébala en el panel y vuelve.",
      );
    }

    await startPageGeneration({
      launchId: launch.id,
      organizationId: auth.organization.id,
      userId: token.createdById,
      pageKey: pageDef.pageKey,
      instruction: String(args.brief ?? ""),
    });

    return {
      iniciada: true,
      url: absoluteUrl(pagePath(launch.slug, pageDef)),
      aviso:
        "Generar una página tarda un par de minutos y no se puede esperar dentro de una llamada. Consulta estado_generacion cuando quieras saber si ha terminado.",
    };
  },
};

const estadoGeneracion: ToolDef = {
  name: "estado_generacion",
  title: "Estado de la generación",
  description:
    "Si la última generación de páginas de este lanzamiento ha terminado, y qué páginas han salido bien o mal. Úsalo después de generar_pagina.",
  inputSchema: {
    type: "object",
    properties: { lanzamiento: { type: "string" } },
    required: ["lanzamiento"],
    additionalProperties: false,
  },
  handler: async (auth, args) => {
    const launch = await requireLaunch(auth, args.lanzamiento);
    const progress = await readGenerationProgress(
      launch.id,
      auth.organization.id,
    );
    if (!progress) return { estado: "sin_ejecuciones" };

    return {
      estado: progress.finishedAt ? "terminada" : "en_curso",
      empezo: progress.startedAt,
      termino: progress.finishedAt ?? null,
      total: progress.total,
      hechas: progress.done,
      fallidas: progress.failed,
    };
  },
};

const metricasLanzamiento: ToolDef = {
  name: "metricas_lanzamiento",
  title: "Métricas de un lanzamiento",
  description:
    "Visitas, leads, ventas e ingresos del lanzamiento, y el reparto por afiliado. Sirve para saber si una página publicada está funcionando.",
  inputSchema: {
    type: "object",
    properties: {
      lanzamiento: { type: "string" },
      dias: { type: "number", description: "Ventana en días (por defecto 30)" },
    },
    required: ["lanzamiento"],
    additionalProperties: false,
  },
  handler: async (auth, args) => {
    const launch = await requireLaunch(auth, args.lanzamiento);
    const days = Math.min(Math.max(Number(args.dias) || 30, 1), 365);
    const from = new Date(Date.now() - days * 864e5);

    // Queried here rather than through server/stats.ts: those helpers authenticate
    // with a session, and this request only has a token.
    const totals = await db
      .select({
        type: trackingEvents.type,
        count: sql<number>`count(*)::int`,
        revenue: sql<number>`coalesce(sum(${trackingEvents.amountCents}), 0)::int`,
      })
      .from(trackingEvents)
      .where(
        and(
          eq(trackingEvents.organizationId, auth.organization.id),
          eq(trackingEvents.launchId, launch.id),
          gte(trackingEvents.occurredAt, from),
        ),
      )
      .groupBy(trackingEvents.type);

    const byType = (t: string) => totals.find((r) => r.type === t);

    const affiliates = await db
      .select({
        ref: trackingEvents.affiliateRef,
        name: users.name,
        leads: sql<number>`count(*) filter (where ${trackingEvents.type} = 'lead')::int`,
        sales: sql<number>`count(*) filter (where ${trackingEvents.type} = 'sale')::int`,
        revenue: sql<number>`coalesce(sum(${trackingEvents.amountCents}) filter (where ${trackingEvents.type} = 'sale'), 0)::int`,
      })
      .from(trackingEvents)
      .leftJoin(users, eq(users.id, trackingEvents.affiliateUserId))
      .where(
        and(
          eq(trackingEvents.organizationId, auth.organization.id),
          eq(trackingEvents.launchId, launch.id),
          sql`${trackingEvents.affiliateRef} is not null`,
          gte(trackingEvents.occurredAt, from),
        ),
      )
      .groupBy(trackingEvents.affiliateRef, users.name);

    return {
      lanzamiento: launch.slug,
      ventana_dias: days,
      visitas: byType("visit")?.count ?? 0,
      leads: byType("lead")?.count ?? 0,
      ventas: byType("sale")?.count ?? 0,
      ingresos_centimos: byType("sale")?.revenue ?? 0,
      afiliados: affiliates.map((a) => ({
        ref: a.ref,
        nombre: a.name,
        leads: a.leads,
        ventas: a.sales,
        ingresos_centimos: a.revenue,
      })),
    };
  },
};

export const TOOLS: ToolDef[] = [
  listarLanzamientos,
  contextoLanzamiento,
  contratoPagina,
  trabajoPendiente,
  guardarIdentidad,
  crearPagina,
  publicarPagina,
  verPagina,
  retirarPagina,
  borrarPagina,
  generarPagina,
  estadoGeneracion,
  metricasLanzamiento,
];

/* ------------------------------------------------------------------ upload -- */

/** Extensions we host for a designed page. No SVG: it can carry script, and these
 *  are served from our own origin, so an SVG would be same-origin XSS. */
const ALLOWED_EXTENSIONS = new Map<string, string>([
  ["css", "text/css"],
  ["js", "text/javascript"],
  ["mjs", "text/javascript"],
  ["png", "image/png"],
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["webp", "image/webp"],
  ["avif", "image/avif"],
  ["gif", "image/gif"],
  ["ico", "image/x-icon"],
  ["woff", "font/woff"],
  ["woff2", "font/woff2"],
  ["mp4", "video/mp4"],
  ["webm", "video/webm"],
]);

const MAX_FILE_BYTES = 10 * 1024 * 1024;

async function uploadFiles(
  auth: McpAuth,
  launchSlug: string,
  pageKey: string,
  raw: unknown,
): Promise<CustomPageAssets> {
  if (!Array.isArray(raw) || !raw.length) return {};
  await ensureBucket();

  const out: CustomPageAssets = {};
  for (const entry of raw) {
    const name = String((entry as { nombre?: unknown }).nombre ?? "").trim();
    const content = String((entry as { contenido?: unknown }).contenido ?? "");
    const from = String((entry as { url?: unknown }).url ?? "").trim();
    const isBase64 = Boolean((entry as { base64?: unknown }).base64);
    if (!name || (!content && !from)) continue;

    // No directory traversal: the name is only ever a key in the HTML, never a
    // path we resolve on disk, but it does become part of an object key.
    const clean = name
      .replace(/^\.\//, "")
      .replace(/\.\./g, "")
      .replace(/^\/+/, "");
    const ext = clean.split(".").pop()?.toLowerCase() ?? "";
    const contentType = ALLOWED_EXTENSIONS.get(ext);
    if (!contentType) {
      throw new ToolError(
        `No se puede alojar "${name}": extensión no admitida. Admitidas: ${[...ALLOWED_EXTENSIONS.keys()].join(", ")}.`,
      );
    }

    // Por URL siempre que sea una foto. Mandarla en base64 obliga al modelo a
    // ESCRIBIR el fichero entero como texto: 3 MB de imagen son más de un millón
    // de tokens, así que la llamada no termina nunca — se queda "publicando" un
    // buen rato y no llega nada. Con la URL, quien descarga es el servidor.
    const buffer = from
      ? await downloadFile(from, name)
      : isBase64
        ? Buffer.from(content, "base64")
        : Buffer.from(content, "utf8");

    if (buffer.byteLength > MAX_FILE_BYTES) {
      throw new ToolError(`"${name}" pesa más de 10 MB.`);
    }

    // A fresh prefix per publish, so republishing can't be served from a cached
    // copy of the previous file under the same name.
    const key = `paginas/${auth.organization.id}/${launchSlug}/${pageKey}/${createId(8)}/${clean}`;
    await storage.putObject(BUCKET, key, buffer, buffer.byteLength, {
      "Content-Type": contentType,
    });
    out[clean] = publicUrlFor(key);
  }
  return out;
}

/**
 * Trae un archivo por URL para alojarlo nosotros.
 *
 * Solo http/https y con límite de tamaño: la URL la elige quien habla con el
 * conector, así que esto puede pedir cualquier cosa desde nuestro servidor. No
 * seguimos redirecciones a hosts privados porque no hace falta: lo que se aloja
 * son imágenes públicas.
 */
async function downloadFile(url: string, name: string): Promise<Buffer> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ToolError(`La url de "${name}" no es válida: ${url}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new ToolError(`La url de "${name}" tiene que ser http o https.`);
  }

  const response = await fetch(parsed, {
    redirect: "follow",
    signal: AbortSignal.timeout(30_000),
    // Con User-Agent porque sin él hay hosts que devuelven 400 sin más
    // explicación — Wikimedia, entre otros —, y el error que llega no dice que
    // el problema sea la cabecera que falta.
    headers: {
      "User-Agent": "BotonRojo/1.0 (+https://escuelanomadadigital.com)",
      Accept: "*/*",
    },
  }).catch((err: unknown) => {
    throw new ToolError(
      `No se ha podido descargar "${name}" desde ${url}: ${err instanceof Error ? err.message : String(err)}`,
    );
  });

  if (!response.ok) {
    throw new ToolError(
      `No se ha podido descargar "${name}": el servidor respondió ${response.status}.`,
    );
  }

  const declared = Number(response.headers.get("content-length") ?? "0");
  if (declared > MAX_FILE_BYTES) {
    throw new ToolError(`"${name}" pesa más de 10 MB.`);
  }

  return Buffer.from(await response.arrayBuffer());
}

/** Exported for the panel's preview, which needs the same path rewriting. */
export { rewriteAssetPaths };
