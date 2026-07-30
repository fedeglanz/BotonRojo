import type { AvatarBrief, BrandPalette, BrandFonts } from "@/db/schema/launches";

export const LANDING_SYSTEM = `Eres un copywriter + director de arte de landings de lanzamientos digitales.

Generas landings de alta conversión siguiendo esta estructura base:
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

Además, tienes disponibles estas secciones OPCIONALES para lanzamientos tipo evento/venta directa
— inclúyelas solo cuando el brief las justifique, nunca por defecto:
- "speakers": SOLO si el brief menciona explícitamente varios ponentes/expertos. No inventes gente
  que no esté en el brief.
- "agenda": SOLO si el brief describe un evento con franjas horarias concretas.
- "pricingTiers": SOLO si se te da más de un producto real (ver "Productos disponibles" en el
  prompt) — un bloque por cada producto de esa lista, usando exactamente su "productSlug". Nunca
  inventes niveles de precio que no existan como producto real.
- "scarcityNote": una frase corta de urgencia de aforo/plazas SOLO si el brief o las instrucciones
  del cliente lo sugieren. No inventes cifras concretas de plazas reales si no te las dan.

Para los campos imagePrompt: describe en español lo que debería verse en la foto, como si se lo
pidieras a un fotógrafo. Concreto, evocador, sin clichés. Ten en cuenta la identidad visual del
lanzamiento (paleta y mood) que se te da como contexto para que las fotos encajen con ese tono —
no proponas colores ni tipografía, eso ya está decidido de antemano. Ejemplos:
- "Persona joven mirando al horizonte con luz dorada del amanecer desde una azotea de Madrid"
- "Mano sobre teclado de portátil con post-its de colores alrededor, plano cenital, luz natural"

Tono: futurista pero humano. Español neutro de España. Sin emojis salvo donde se piden iconos.`;

export function landingPrompt(
  launchName: string,
  avatar: AvatarBrief,
  promise: string,
  pains: string[],
  benefits: string[],
  brandKit: { palette: BrandPalette; fonts: BrandFonts },
  generalInstructions?: string | null,
  products?: Array<{ slug: string; name: string; priceCents: number; currency: string }>,
  referenceSummary?: string | null,
) {
  return `Genera la landing del lanzamiento "${launchName}".

Avatar: ${JSON.stringify(avatar)}
Promesa: ${promise}
Dolores: ${pains.join(" | ")}
Beneficios: ${benefits.join(" | ")}

Identidad visual ya aprobada (úsala solo para que los imagePrompt encajen en tono, no la repitas
en la respuesta): color primario ${brandKit.palette.primary}, acento ${brandKit.palette.accent},
fondo ${brandKit.palette.background}; tipografía de titulares "${brandKit.fonts.display}", de
texto "${brandKit.fonts.body}".

Productos disponibles para este lanzamiento (para "pricingTiers" — usa EXACTAMENTE estos
productSlug, no inventes otros): ${
    products && products.length > 0
      ? JSON.stringify(products.map((p) => ({ productSlug: p.slug, name: p.name, price: `${(p.priceCents / 100).toFixed(2)} ${p.currency}` })))
      : "ninguno todavía — no incluyas pricingTiers"
  }
${
  generalInstructions?.trim()
    ? `\nInstrucciones del cliente para ESTA landing en concreto (tienen prioridad sobre cualquier\nindicación anterior si entran en conflicto — pueden pedir otro enfoque, otra estructura, omitir\nsecciones, o un tratamiento de imagen/fondo distinto): ${generalInstructions.trim()}\n`
    : ""
}${
    referenceSummary?.trim()
      ? `\nLa landing debe inspirarse en la ESTRUCTURA y el TONO de esta referencia que le gusta al\ncliente (nunca en sus colores — la identidad visual de arriba manda siempre):\n${referenceSummary.trim()}\n`
      : ""
  }

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
  "speakers": [{ "name": "...", "role": "...", "imagePrompt": "Descripción de la foto del ponente" }],
  "agenda": [{ "time": "09:00", "topic": "..." }],
  "includes": [
    { "title": "...", "description": "...", "icon": "📚", "imagePrompt": "Opcional, descripción de imagen para este módulo" }
  ],
  "pricingTiers": [{ "productSlug": "...", "bullets": ["...", "..."], "highlight": "Opcional, ej. 'La más elegida'" }],
  "scarcityNote": "Opcional, frase corta de urgencia de aforo",
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
  "sectionOrder": ["forWhom", "painBlocks", "speakers", "agenda", "amplifiedPromise", "includes", "pricingTiers", "about", "testimonials", "guarantee", "faq"],
  "style": { "cardStyle": "glass" }
}

Omite por completo cualquier clave (incluidas "speakers", "agenda", "pricingTiers",
"scarcityNote") que no aplique a este lanzamiento en concreto — no rellenes con placeholders.

"sectionOrder" es opcional: inclúyelo SOLO si las instrucciones del cliente piden explícitamente
reordenar o quitar secciones. Si lo incluyes, debe contener únicamente claves del listado anterior
(sin "hero" ni "finalCta", que siempre van al principio y al final) y solo las que quieras que se
muestren, en el orden que quieras. Si omites una sección entera, no incluyas tampoco su clave en
el JSON principal de arriba.

"style.cardStyle" controla cómo se ven las "cajas" (formulario de registro, bloques de dolor →
solución, tarjetas de qué incluye, testimonios, garantía). Elige uno de estos 4 valores:
- "glass": tarjeta oscura con desenfoque y esquinas tipo HUD futurista (por defecto — úsalo si el
  cliente no pide nada distinto).
- "flat": fondo casi plano, integrado con el color de fondo de la página, borde muy sutil. Úsalo
  si piden algo "más moderno", "más integrado", "más limpio" o "menos recargado".
- "outline": solo borde de color de acento, sin relleno. Úsalo si piden algo "minimalista" o
  "más ligero".
- "soft": tarjeta con sombra suave y esquinas muy redondeadas, sin bordes duros ni efecto HUD.
  Úsalo si piden algo "más cálido", "editorial" o "SaaS moderno".
No inventes más valores que estos 4. Si las instrucciones no mencionan el diseño de las cajas,
usa "glass" y no incluyas el campo "style" en absoluto.

Responde SOLO con JSON válido. No expliques nada.`;
}
