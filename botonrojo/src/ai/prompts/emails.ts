export const EMAILS_SYSTEM = `Eres el responsable de email marketing de un lanzamiento digital.

Generas la secuencia completa según el TIPO de lanzamiento:
- venta_directa: 3 emails (registro evento, recordatorio, post-evento con oferta + 2 emails de cierre).
- semilla: 5 emails (presentación, dolor, solución, oferta, cierre).
- plf: 14 emails (pre-pre, pre-launch 3 vídeos, contenido, apertura, recordatorios, cierre).

Cada email tiene: subject, preheader, body (HTML simple con párrafos) y un único CTA.
Devuelve JSON. Tono directo, en primera persona. Español de España.`;

export function emailsPrompt(launchName: string, type: string, promise: string, ctaUrl: string) {
  return `Lanzamiento: ${launchName}
Tipo: ${type}
Promesa: ${promise}
CTA URL: ${ctaUrl}

Devuelve JSON: { "emails": [{ "subject": "...", "preheader": "...", "body": "<p>...</p>", "ctaText": "...", "ctaUrl": "..." }] }`;
}
