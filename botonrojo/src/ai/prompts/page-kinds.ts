import type { AvatarBrief } from "@/db/schema/launches";
import type { LegalPageKey } from "@/lib/launch-pages";
import { DESIGN_RULES } from "./design-rules";

export const REGISTRO_SYSTEM = `Eres copywriter de páginas de captura (opt-in) para lanzamientos digitales.
Generas UNA página corta: titular, subtítulo, 3-4 bullets de qué gana quien se apunte, y CTA. Nada de
testimonios, garantía ni FAQ — eso vive en la página de venta, no aquí. Español neutro de España, sin
emojis. Para "imagePrompt": descripción concreta y evocadora de una foto, como si se lo pidieras a un
fotógrafo — sin proponer colores ni tipografía.

${DESIGN_RULES}`;

/**
 * The admin's own brief for this specific page, typed next to the regenerate
 * button. Goes last in the prompt so it outranks the generic instructions above
 * it, and is worded as an order rather than as context.
 */
function instructionBlock(instruction: string | null | undefined): string {
  const value = instruction?.trim();
  if (!value) return "";
  return `

INSTRUCCIONES DEL CLIENTE PARA ESTA PÁGINA — manda sobre todo lo anterior:
"""
${value}
"""`;
}

/**
 * The composable vocabulary every page except the legal ones can use: extra
 * blocks under the hero, and a band design per block.
 *
 * Without this a brief like "add a block with what you'll learn, and below it an
 * image with text and a button beside it" had nowhere to land — the model wrote
 * new copy into the same fixed fields and the page came out identical. Closed
 * lists, same as the landing: anything else is dropped on save.
 */
export const PAGE_COMPOSITION = `
BLOQUES OPCIONALES ("blocks"): una lista, en el orden en que quieras que aparezcan
debajo de la parte principal. Solo estos tres tipos, y solo si aportan algo:

1. { "type": "benefits", "title": "...", "items": [{ "icon": "nombre", "title": "...", "text": "..." }] }
   De 3 a 6 elementos, en rejilla con tarjetas e icono. Para "lo que vas a aprender",
   "qué te llevas", "por qué a ti".
2. { "type": "imageText", "title": "...", "text": "...", "ctaLabel": "...", "imagePrompt": "...",
     "imageSide": "left" | "right" }
   Imagen a un lado y argumento al otro, con botón que lleva al formulario. Para
   mostrar el resultado que consigue quien se apunta. Si pones dos seguidos,
   alterna "imageSide" para que no vayan en fila.
3. { "type": "steps", "title": "...", "items": [{ "title": "...", "text": "..." }] }
   Secuencia numerada: qué pasa después de registrarse.

Los "icon" son NOMBRES de este catálogo cerrado (se pintan en SVG con degradado de
marca). Cualquier otro se descarta:
"rayo", "cohete", "fuego", "tendencia", "grafica", "barras", "velocimetro", "diana", "trofeo", "corona", "estrella", "escudo", "escudoOk", "candado", "verificado", "documentoOk", "balanza", "salvavidas", "cartera", "monedas", "tarjeta", "factura", "porcentaje", "reloj", "alarma", "calendario", "repetir", "infinito", "libro", "birrete", "documento", "reproducir", "bombilla", "cerebro", "brujula", "lupa", "personas", "apretonManos", "manosCorazon", "mensajes", "correo", "enviar", "campana", "capas", "cajas", "ajustes", "enlace", "nube", "baseDatos", "movil", "pantalla", "maletin", "mundo", "regalo", "chispas", "varita", "check", "cerrar"

"hideHeroImage": true quita la foto que flota junto al formulario. Ponlo cuando le
des al hero un fondo o un efecto propios: la foto encima de una banda ya decorada
compite con el formulario en vez de ayudarlo.

DISEÑO DE BANDA ("design"): { "hero": {...}, "blocks": [{...}, {...}] } — "blocks"
va en el mismo orden que los bloques. Cada uno admite:
- "background": "none" | "tint" | "accent" | "dark" | "photo"
  (con "photo" añade "imagePrompt").
- "effect": "none" | "aurora" (resplandor en movimiento) | "geometry" | "grid" | "dots" |
  "noise" | "orbit" (solo con texto muy corto).
- "height": "auto" | "full". "width": "normal" | "wide" | "full".
- "titleFx": "none" | "gradient" | "outline".

Cómo componer: alterna fondos para que dos bandas seguidas no se lean como una, y
usa UN solo efecto llamativo en toda la página. Si te piden "fondo con efectos" o
"que llame la atención", eso va en el "design" del hero, no en más texto.`;

export function registroPrompt(
  launchName: string,
  avatar: AvatarBrief,
  promise: string,
  channel: string,
  instruction?: string | null,
) {
  return `Genera la página de registro del lanzamiento "${launchName}"${
    channel !== "General" ? ` pensada para tráfico que llega desde "${channel}"` : ""
  }.

Avatar: ${JSON.stringify(avatar)}
Promesa: ${promise}

Devuelve JSON con esta forma exacta:
{
  "headline": "...",
  "subheadline": "...",
  "bullets": ["...", "...", "..."],
  "cta": "...",
  "imagePrompt": "Descripción concreta de la foto de esta página"
}

Responde SOLO con JSON válido. No expliques nada.
${PAGE_COMPOSITION}${instructionBlock(instruction)}`;
}

export const GRACIAS_SYSTEM = `Escribes la página de gracias de una lista de correo o un lead magnet.

No es un acuse de recibo: es la entrega. Quien llega aquí acaba de dejar su email, así
que ya no hay que convencerle de nada — hay que darle lo prometido y decirle qué pasa
ahora. Español de España, directo, sin celebraciones vacías ("¡Enhorabuena!" no aporta
nada). Nada de emojis.`;

export function graciasPrompt(
  launchName: string,
  avatar: AvatarBrief,
  promise: string,
  instruction?: string | null,
) {
  return `Genera la página de gracias del lanzamiento "${launchName}", una lista de correo o lead magnet.

Avatar: ${JSON.stringify(avatar)}
Promesa: ${promise}

Es la página donde se ENTREGA lo prometido y se explica qué pasa a partir de ahora
(cada cuánto llegan los correos, de qué van, cómo darse de baja). Si lo prometido es un
descargable, el botón principal es para descargarlo.

Devuelve JSON con esta forma exacta:
{
  "headline": "...",
  "subheadline": "...",
  "bullets": ["Qué va a recibir y cada cuánto", "...", "..."],
  "cta": "Texto del botón de descarga o del siguiente paso",
  "imagePrompt": "Descripción concreta de la foto de esta página"
}

Responde SOLO con JSON válido. No expliques nada.
${PAGE_COMPOSITION}${instructionBlock(instruction)}`;
}

export const BAJA_SYSTEM = `Escribes la página de baja de una lista de correo.

Quien llega aquí quiere irse: la página tiene que dejarle irse en un clic, sin culpa, sin
laberinto y sin pedir explicaciones. Tono tranquilo y breve. Puede ofrecer una alternativa
—recibir menos correos, o solo lo importante— pero después de la baja, nunca antes ni en
su lugar. Español de España, sin emojis.`;

export function bajaPrompt(
  launchName: string,
  promise: string,
  instruction?: string | null,
) {
  return `Genera la página de baja de la lista del lanzamiento "${launchName}".

De qué va la lista: ${promise}

Devuelve JSON con esta forma exacta:
{
  "headline": "...",
  "subheadline": "Una o dos frases, tranquilas",
  "bullets": [],
  "cta": "Texto del botón que confirma la baja"
}

Sin foto: es una página de servicio, no de venta. Responde SOLO con JSON válido.
${instructionBlock(instruction)}`;
}

export const CONTENIDO_SYSTEM = `Eres copywriter de páginas de contenido educativo dentro de una secuencia
de lanzamiento (Product Launch Formula). Cada página enseña algo real y útil por sí mismo — no es una
venta directa, construye autoridad y deseo hacia la oferta que llega al final de la secuencia. Español
neutro de España, sin emojis. Para "imagePrompt": descripción concreta de una foto, sin proponer colores
ni tipografía.

${DESIGN_RULES}`;

export function contenidoPrompt(
  launchName: string,
  avatar: AvatarBrief,
  promise: string,
  benefits: string[],
  index: number,
  total: number,
  instruction?: string | null,
) {
  return `Genera la página de contenido ${index} de ${total} de la secuencia del lanzamiento "${launchName}".
${index === 1 ? "Es la primera — abre con el problema/creencia limitante más importante del avatar." : ""}
${index === total ? "Es la última — cierra con puente directo hacia la oferta." : ""}

Avatar: ${JSON.stringify(avatar)}
Promesa final del lanzamiento: ${promise}
Beneficios de la oferta: ${benefits.join(" | ")}

Devuelve JSON con esta forma exacta:
{
  "headline": "...",
  "body": "Varios párrafos de contenido real y útil, separados por saltos de línea dobles",
  "ctaLabel": "Texto del botón hacia ${index === total ? "la página de venta" : "la siguiente entrega"}",
  "imagePrompt": "Descripción concreta de la foto de esta página"
}

Responde SOLO con JSON válido. No expliques nada.
${PAGE_COMPOSITION}${instructionBlock(instruction)}`;
}

const LEGAL_LABELS: Record<LegalPageKey, string> = {
  privacidad: "política de privacidad",
  terminos: "términos y condiciones",
  cookies: "política de cookies",
};

export const LEGAL_SYSTEM = `Generas un BORRADOR de documento legal en español para la página web de un
negocio digital. Es un punto de partida, no asesoramiento legal — quien lo use debe revisarlo con un
profesional antes de publicarlo. Sé claro y específico sobre qué datos se recogen (nombre y email en
formularios de registro, datos de pago procesados por Stripe en las compras) y para qué se usan. No
inventes datos de contacto, dirección física ni de empresa que no se te den.`;

export function legalPrompt(
  orgName: string,
  legalType: LegalPageKey,
  launchName: string,
  instruction?: string | null,
) {
  return `Genera la ${LEGAL_LABELS[legalType]} de "${orgName}", en el contexto del lanzamiento
"${launchName}". No incluyas datos de contacto/dirección concretos que no tengas — deja un marcador
como "[dirección de la empresa]" donde haría falta.

Devuelve JSON con esta forma exacta:
{ "title": "...", "content": "Texto completo, con saltos de línea dobles entre secciones" }

Responde SOLO con JSON válido. No expliques nada.${instructionBlock(instruction)}`;
}

export const AFILIADOS_SYSTEM = `Escribes una página corta invitando a hacerse afiliado de un
lanzamiento digital: por qué merece la pena promocionarlo y qué comisión se lleva. Español neutro de
España, sin emojis, tono directo y honesto — nada de superlativos vacíos.`;

export function afiliadosPrompt(
  launchName: string,
  promise: string,
  commissionRateBps: number,
  instruction?: string | null,
) {
  const pct = (commissionRateBps / 100).toFixed(0);
  return `Genera la página de invitación a afiliados del lanzamiento "${launchName}".

Promesa del lanzamiento: ${promise}
Comisión: ${pct}%

Devuelve JSON con esta forma exacta:
{ "headline": "...", "pitch": "2-3 párrafos", "commissionNote": "Frase corta mencionando el ${pct}%" }

Responde SOLO con JSON válido. No expliques nada.
${PAGE_COMPOSITION}${instructionBlock(instruction)}`;
}
