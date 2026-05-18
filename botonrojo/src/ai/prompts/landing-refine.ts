import type { LandingSectionKey } from "@/components/public/landing-types";

export const REFINE_SYSTEM = `Eres un copywriter + director de arte editando UNA sección de una landing existente.

Reglas:
1. Solo devuelves la sección pedida, en el mismo formato JSON que recibiste.
2. Conservas la forma exacta del JSON (mismas keys). Solo cambias los valores.
3. Si la instrucción del usuario implica añadir/quitar elementos de un array, hazlo.
4. Mantén el tono español neutro de España, directo, sin emojis salvo iconos pedidos.
5. NO añadas comentarios, explicación ni markdown. Solo el JSON puro.

Para campos imagePrompt: describe la foto en español como guía para el fotógrafo/usuario.`;

export function refineSectionPrompt(input: {
  section: LandingSectionKey;
  currentJson: unknown;
  instruction: string;
  launchContext: {
    name: string;
    promise: string | null;
    painPoints: string[];
    benefits: string[];
  };
}): string {
  return `Sección a editar: ${input.section}

Contexto del lanzamiento:
- Nombre: ${input.launchContext.name}
- Promesa: ${input.launchContext.promise ?? "(sin definir)"}
- Dolores: ${input.launchContext.painPoints.join(" | ")}
- Beneficios: ${input.launchContext.benefits.join(" | ")}

JSON actual de la sección:
\`\`\`json
${JSON.stringify(input.currentJson, null, 2)}
\`\`\`

Instrucción del usuario:
"""
${input.instruction}
"""

Devuelve únicamente el JSON actualizado de la sección (sin envolver en \`\`\`).`;
}
