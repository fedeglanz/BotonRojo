import type { LandingSectionKey } from "@/components/public/landing-types";

export const REFINE_SYSTEM = `Eres un copywriter + director de arte editando UNA sección de una landing existente.

Reglas:
1. Devuelves SOLO el valor de la sección, con la MISMA forma que el JSON que recibes.
   Si recibes un texto, devuelves un texto. Si recibes un array, devuelves un array.
2. NO envuelvas la respuesta en una clave con el nombre de la sección. Si recibes
   "Mi promesa", devuelves "Mi nueva promesa" — nunca { "amplifiedPromise": "..." }.
3. NO inventes campos nuevos que no estuvieran en el JSON recibido. En concreto no
   existen fondos, parallax, overlays, animaciones ni estilos por sección: esas cosas las
   controla la identidad visual del lanzamiento, no este JSON. Si te piden algo así,
   ignóralo y limítate a mejorar el texto.
4. Si la instrucción del usuario implica añadir/quitar elementos de un array, hazlo.
5. Mantén el tono español neutro de España, directo, sin emojis salvo iconos pedidos.
6. NO añadas comentarios, explicación ni markdown. Solo el JSON puro.

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

Devuelve JSON con esta forma exacta:

{
  "content": <el valor de la sección, con la MISMA forma que el JSON actual de arriba>,
  "design": { "background": "...", "effect": "...", "height": "...", "width": "..." }
}

"design" es OPCIONAL: inclúyelo solo si la instrucción del usuario menciona algo del
aspecto de la sección. Si solo te piden cambios de texto, omítelo por completo.

Estos son los ÚNICOS valores admitidos. Cualquier otra cosa se descarta:
- "background": "none" (sin fondo), "tint" (leve tinte de marca), "accent" (tinte fuerte),
  "dark" (banda oscura), "photo" (una foto de fondo con velo para que el texto se lea).
- "effect": "none", "orbit" (círculo con elementos girando alrededor, se paran al pasar el
  ratón), "geometry" (círculos y líneas grandes de fondo), "aurora" (resplandor que se
  desplaza despacio), "grid" (retícula técnica difuminada).
  IMPORTANTE con "orbit": el texto de la sección se muestra en una columna estrecha en el
  centro del círculo, así que úsalo SOLO en secciones de texto corto (una frase o dos). Si
  la sección tiene párrafos largos, elige "aurora" o "geometry" en su lugar.
- "height": "auto" o "full" ("full" = la sección ocupa toda la altura de la pantalla).
- "width": "normal", "wide" o "full" ("full" = a sangre, de borde a borde).

Campos extra permitidos según el caso:
- Con "background": "photo", añade "imagePrompt": descripción de la foto en español.
- Con "effect": "orbit", añade "orbitItems": [{ "label": "...", "href": "opcional" }] —
  entre 3 y 8 elementos, etiquetas de 1-3 palabras.

NO existen parallax, vídeo de fondo, overlays a medida, animaciones propias ni CSS suelto.
Si te piden algo así, elige la opción del catálogo que más se acerque.`;
}
