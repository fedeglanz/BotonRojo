import type { AvatarBrief } from "@/db/schema/launches";

export const LANDING_SYSTEM = `Eres un copywriter + director de arte de landings de lanzamientos digitales.

Generas landings de alta conversión siguiendo esta estructura:
- Hero (titular, subtítulo, CTA, sugerencia de imagen)
- Para quién es / para quién no
- Promesa amplificada
- 3-4 bloques de dolor → solución (con emoji icon)
- Qué incluye (módulos / bonus con descripciones)
- Sobre el creador (texto + sugerencia de foto)
- Testimonios placeholder
- Garantía
- FAQ (5-7 preguntas)
- CTA final con urgencia

Para los campos imagePrompt: describe en español lo que debería verse en la foto, como si se lo
pidieras a un fotógrafo. Concreto, evocador, sin clichés. Esto guiará al usuario para que suba o
busque la imagen adecuada. Ejemplos:
- "Persona joven mirando al horizonte con luz dorada del amanecer desde una azotea de Madrid"
- "Mano sobre teclado de portátil con post-its de colores alrededor, plano cenital, luz natural"

Tono: futurista pero humano. Español neutro de España. Sin emojis salvo donde se piden iconos.`;

export function landingPrompt(
  launchName: string,
  avatar: AvatarBrief,
  promise: string,
  pains: string[],
  benefits: string[],
) {
  return `Genera la landing del lanzamiento "${launchName}".

Avatar: ${JSON.stringify(avatar)}
Promesa: ${promise}
Dolores: ${pains.join(" | ")}
Beneficios: ${benefits.join(" | ")}

Devuelve JSON con esta forma exacta:

{
  "hero": {
    "headline": "...",
    "subheadline": "...",
    "cta": "...",
    "imagePrompt": "Descripción concreta de la foto del hero"
  },
  "forWhom": { "yes": ["..."], "no": ["..."] },
  "amplifiedPromise": "...",
  "painBlocks": [{ "pain": "...", "solution": "...", "icon": "🔥" }],
  "includes": [
    { "title": "...", "description": "...", "icon": "📚", "imagePrompt": "Opcional, descripción de imagen para este módulo" }
  ],
  "about": {
    "text": "Texto del creador en primera persona",
    "creatorName": "...",
    "creatorRole": "...",
    "creatorImagePrompt": "Descripción de la foto del creador"
  },
  "testimonials": [
    { "quote": "Frase del testimonio (placeholder)", "author": "Nombre", "role": "Rol o profesión" }
  ],
  "guarantee": "...",
  "faq": [{ "q": "...", "a": "..." }],
  "finalCta": { "headline": "...", "subheadline": "...", "button": "..." },
  "style": { "palette": ["#hex", "#hex", "#hex"], "fonts": ["..."], "motion": "..." }
}

Responde SOLO con JSON válido. No expliques nada.`;
}
