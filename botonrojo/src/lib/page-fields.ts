import type { PageKind } from "./launch-pages";

/**
 * Which editable parts each kind of page has.
 *
 * Before this, only the sales page could be edited part by part; every other
 * page offered a raw JSON textarea, which made them feel second-class and meant
 * a typo in a brace lost the whole page. The schema below drives real inputs for
 * all of them, and is also what the per-part AI refine box reads.
 */
export type PageFieldType = "text" | "textarea" | "list";

export type PageField = {
  name: string;
  label: string;
  type: PageFieldType;
  /** Shown under the input. Say what the field is for, not what it is. */
  help?: string;
  rows?: number;
};

/** Fields that hold an image prompt, so the UI can offer to resolve a photo. */
export const IMAGE_PROMPT_FIELDS: Record<string, string> = {
  imagePrompt: "imageUrl",
};

const REGISTRO_FIELDS: PageField[] = [
  { name: "headline", label: "Titular", type: "text", help: "Lo primero que se lee. Corto y concreto." },
  { name: "subheadline", label: "Subtítulo", type: "textarea", rows: 3, help: "Una o dos frases que amplíen el titular." },
  {
    name: "bullets",
    label: "Puntos",
    type: "list",
    rows: 6,
    help: "Uno por línea. Lo que se llevan por registrarse.",
  },
  { name: "cta", label: "Texto del botón", type: "text", help: "Verbo en primera persona: “Apúntame gratis”." },
  {
    name: "imagePrompt",
    label: "Descripción de la imagen",
    type: "textarea",
    rows: 2,
    help: "Se usa para generar o buscar la foto. Si la dejas vacía, la página va sin imagen.",
  },
];

const CONTENIDO_FIELDS: PageField[] = [
  { name: "headline", label: "Titular de la entrega", type: "text" },
  {
    name: "body",
    label: "Contenido",
    type: "textarea",
    rows: 14,
    help: "Separa los párrafos con una línea en blanco.",
  },
  { name: "ctaLabel", label: "Texto del botón", type: "text", help: "Lleva a la entrega siguiente o a la venta." },
  { name: "imagePrompt", label: "Descripción de la imagen", type: "textarea", rows: 2 },
];

const LEGAL_FIELDS: PageField[] = [
  { name: "title", label: "Título", type: "text" },
  {
    name: "content",
    label: "Texto legal",
    type: "textarea",
    rows: 22,
    help: "Una línea en blanco separa apartados; una línea corta y sin punto final se pinta como encabezado.",
  },
];

const AFILIADOS_FIELDS: PageField[] = [
  { name: "headline", label: "Titular", type: "text" },
  { name: "pitch", label: "Propuesta", type: "textarea", rows: 5, help: "Por qué le interesa promocionarlo." },
  { name: "commissionNote", label: "Nota de comisión", type: "text", help: "La condición económica, en una línea." },
];

/** `venta` is absent on purpose: it has its own section editor. */
export const PAGE_FIELDS: Partial<Record<PageKind, PageField[]>> = {
  registro: REGISTRO_FIELDS,
  contenido: CONTENIDO_FIELDS,
  legal: LEGAL_FIELDS,
  afiliados: AFILIADOS_FIELDS,
};

export function fieldsForKind(kind: PageKind): PageField[] {
  return PAGE_FIELDS[kind] ?? [];
}

/**
 * Builds a page body from submitted form values, keeping any stored key the
 * schema doesn't cover (a resolved `imageUrl`, for instance) so saving one field
 * never silently drops another.
 */
export function bodyFromFields(
  fields: PageField[],
  get: (name: string) => string | null,
  existing: Record<string, unknown> | null,
): Record<string, unknown> {
  const body: Record<string, unknown> = { ...(existing ?? {}) };

  for (const field of fields) {
    const raw = get(field.name);
    if (raw === null) continue;

    if (field.type === "list") {
      const items = raw
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      if (items.length > 0) body[field.name] = items;
      else delete body[field.name];
      continue;
    }

    const value = raw.trim();
    if (value) body[field.name] = value;
    else delete body[field.name];
  }

  return body;
}

/** The stored value of a field, as text for an input. */
export function fieldValue(body: Record<string, unknown> | null, field: PageField): string {
  const value = body?.[field.name];
  if (field.type === "list") return Array.isArray(value) ? value.join("\n") : "";
  return typeof value === "string" ? value : "";
}
