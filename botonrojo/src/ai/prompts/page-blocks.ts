/**
 * Writing and rewriting ONE block of a page.
 *
 * Deliberately narrow: the answer is a single block, so an instruction about the
 * benefits grid can't collaterally rewrite the hero. The shape is validated on the
 * way in — see normalizeBlock in server/page-edit.ts.
 */
export const BLOCK_SYSTEM = `Eres un copywriter de lanzamientos digitales escribiendo UNA sección de una página.

Reglas:
1. Devuelves SOLO el JSON de esa sección, con la forma exacta que se te pide.
2. Español de España, directo, sin relleno ni clichés de marketing.
3. No inventes datos que no puedas saber: precios, fechas, cifras, nombres de clientes
   reales, resultados concretos. Si la instrucción los pide y no los tienes, escribe el
   texto sin ellos.
4. Nada de emojis. Los iconos van por nombre, del catálogo que se te da.
5. NO añadas comentarios, explicación ni markdown fuera del JSON.`;

const SHAPES: Record<string, string> = {
  benefits: `{ "title": "...", "items": [{ "icon": "nombre", "title": "...", "text": "..." }] }
De 3 a 6 elementos. "title" de cada uno: 2-5 palabras. "text": una frase.`,
  imageText: `{ "title": "...", "text": "2-3 frases", "ctaLabel": "...", "imagePrompt": "descripción de la foto en español", "imageSide": "left" | "right" }`,
  steps: `{ "title": "...", "items": [{ "title": "...", "text": "..." }] }
De 3 a 5 pasos, en orden.`,
  faq: `{ "title": "...", "items": [{ "q": "...", "a": "..." }] }
De 3 a 6 preguntas. Respuestas de 1-2 frases.`,
  testimonials: `{ "title": "...", "items": [{ "quote": "...", "author": "Nombre", "role": "Rol" }] }
De 2 a 4. Son PLACEHOLDERS: nombres genéricos y verosímiles, nunca personas reales.`,
  cta: `{ "title": "...", "text": "una o dos frases", "ctaLabel": "verbo en primera persona" }`,
};

const ICON_NOTE = `Los "icon" son NOMBRES de un catálogo cerrado que se pinta en SVG con degradado de
marca. Úsalos tal cual; cualquier otro nombre se descarta. Algunos: rayo, cohete, escudoOk,
candado, verificado, documentoOk, reloj, alarma, calendario, cartera, monedas, factura, libro,
birrete, bombilla, cerebro, personas, apretonManos, mensajes, correo, capas, ajustes, movil,
mundo, regalo, chispas, diana, trofeo, tendencia, grafica, check.`;

export function blockPrompt(input: {
  launchName: string;
  promise: string | null;
  painPoints: string[];
  benefits: string[];
  blockType: string;
  instruction: string;
}): string {
  return `Lanzamiento: ${input.launchName}
Promesa: ${input.promise ?? "(sin definir)"}
Dolores del avatar: ${input.painPoints.join(" | ") || "(sin definir)"}
Beneficios: ${input.benefits.join(" | ") || "(sin definir)"}

Sección a escribir: "${input.blockType}"

Forma exacta del JSON:
${SHAPES[input.blockType] ?? "{}"}

${input.blockType === "benefits" ? ICON_NOTE + "\n" : ""}
Instrucción del cliente:
"""
${input.instruction}
"""

Devuelve únicamente el JSON.`;
}

export function blockRefinePrompt(input: {
  launchName: string;
  promise: string | null;
  what: string;
  current: unknown;
  instruction: string;
}): string {
  return `Lanzamiento: ${input.launchName}
Promesa: ${input.promise ?? "(sin definir)"}

Estás reescribiendo ${input.what}. Devuelve el JSON con las MISMAS claves que recibes.

Contenido actual:
\`\`\`json
${JSON.stringify(input.current, null, 2)}
\`\`\`

Instrucción del cliente:
"""
${input.instruction}
"""

Devuelve únicamente el JSON, con la misma forma.`;
}
