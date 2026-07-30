import type { AvatarBrief } from "@/db/schema/launches";
import type { LegalPageKey } from "@/lib/launch-pages";

export const REGISTRO_SYSTEM = `Eres copywriter de páginas de captura (opt-in) para lanzamientos digitales.
Generas UNA página corta: titular, subtítulo, 3-4 bullets de qué gana quien se apunte, y CTA. Nada de
testimonios, garantía ni FAQ — eso vive en la página de venta, no aquí. Español neutro de España, sin
emojis. Para "imagePrompt": descripción concreta y evocadora de una foto, como si se lo pidieras a un
fotógrafo — sin proponer colores ni tipografía.`;

export function registroPrompt(
  launchName: string,
  avatar: AvatarBrief,
  promise: string,
  channel: string,
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

Responde SOLO con JSON válido. No expliques nada.`;
}

export const CONTENIDO_SYSTEM = `Eres copywriter de páginas de contenido educativo dentro de una secuencia
de lanzamiento (Product Launch Formula). Cada página enseña algo real y útil por sí mismo — no es una
venta directa, construye autoridad y deseo hacia la oferta que llega al final de la secuencia. Español
neutro de España, sin emojis. Para "imagePrompt": descripción concreta de una foto, sin proponer colores
ni tipografía.`;

export function contenidoPrompt(
  launchName: string,
  avatar: AvatarBrief,
  promise: string,
  benefits: string[],
  index: number,
  total: number,
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

Responde SOLO con JSON válido. No expliques nada.`;
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

export function legalPrompt(orgName: string, legalType: LegalPageKey, launchName: string) {
  return `Genera la ${LEGAL_LABELS[legalType]} de "${orgName}", en el contexto del lanzamiento
"${launchName}". No incluyas datos de contacto/dirección concretos que no tengas — deja un marcador
como "[dirección de la empresa]" donde haría falta.

Devuelve JSON con esta forma exacta:
{ "title": "...", "content": "Texto completo, con saltos de línea dobles entre secciones" }

Responde SOLO con JSON válido. No expliques nada.`;
}

export const AFILIADOS_SYSTEM = `Escribes una página corta invitando a hacerse afiliado de un
lanzamiento digital: por qué merece la pena promocionarlo y qué comisión se lleva. Español neutro de
España, sin emojis, tono directo y honesto — nada de superlativos vacíos.`;

export function afiliadosPrompt(launchName: string, promise: string, commissionRateBps: number) {
  const pct = (commissionRateBps / 100).toFixed(0);
  return `Genera la página de invitación a afiliados del lanzamiento "${launchName}".

Promesa del lanzamiento: ${promise}
Comisión: ${pct}%

Devuelve JSON con esta forma exacta:
{ "headline": "...", "pitch": "2-3 párrafos", "commissionNote": "Frase corta mencionando el ${pct}%" }

Responde SOLO con JSON válido. No expliques nada.`;
}
