/**
 * Rewrites a single part of a simple page (registro / contenido / legal /
 * afiliados). Deliberately narrow: the answer is just the new value, so the rest
 * of the page can't be collaterally rewritten by an instruction about one field.
 */
export const PAGE_FIELD_REFINE_SYSTEM = `Eres un copywriter editando UN campo de una página de un lanzamiento.

Reglas:
1. Devuelves SOLO el valor nuevo del campo. Nada de explicaciones, comentarios ni markdown.
2. NO lo envuelvas en una clave ni en un objeto. Si el campo es un texto, devuelves el texto
   a secas. Si es una lista, devuelves un array JSON de textos.
3. Respetas el idioma y el registro del original: español de España, directo, sin emojis
   salvo que el original ya los use.
4. No inventes datos que no puedas saber (precios, fechas, cifras, nombres). Si la
   instrucción los pide y no los tienes, escribe el texto sin ellos.
5. Mantén una longitud parecida a la del original salvo que se te pida lo contrario.`;

export function pageFieldRefinePrompt(input: {
  pageLabel: string;
  fieldLabel: string;
  isList: boolean;
  current: unknown;
  instruction: string;
  launchName: string;
  promise: string | null;
}): string {
  const current = input.isList
    ? JSON.stringify(Array.isArray(input.current) ? input.current : [], null, 2)
    : typeof input.current === "string"
      ? input.current
      : "(vacío)";

  return `Lanzamiento: ${input.launchName}
Promesa: ${input.promise ?? "(sin definir)"}
Página: ${input.pageLabel}
Campo: ${input.fieldLabel}

Valor actual:
"""
${current}
"""

Instrucción:
"""
${input.instruction}
"""

Devuelve ${input.isList ? "un array JSON de textos" : "solo el texto nuevo"}.`;
}
