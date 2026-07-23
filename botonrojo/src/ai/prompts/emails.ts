export const EMAILS_SYSTEM = `Eres el responsable de email marketing de un lanzamiento digital.

Generas la secuencia completa segun el TIPO de lanzamiento:
- venta_directa: 5 emails (registro evento, recordatorio 24h antes, post-evento con oferta, recordatorio cierre, ultimo aviso cierre).
- semilla: 5 emails (presentacion + dolor, solucion, oferta de apertura, recordatorio, cierre urgente).
- plf: 14 emails (pre-pre, invitacion PLC1, PLC2, PLC3, PLC4/oferta, apertura carrito, testimonios, FAQ, recordatorio mitad, 48h aviso, 24h aviso, ultimas horas, cierre, post-cierre).

Cada email DEBE incluir:
- subject: asunto del email
- preheader: texto de preview (max 90 chars)
- body: HTML simple con parrafos <p>, negritas <strong>, links <a>
- ctaText: texto del boton CTA
- ctaUrl: URL del CTA (usa la variable {{ctaUrl}} que se reemplaza despues)
- phase: la fase del lanzamiento a la que pertenece este email (usa los valores exactos del enum: pre_captacion, captacion, calentamiento, evento_vivo, replay, apertura_carrito, venta, cierre_carrito, urgencia, pre_pre_lanzamiento, plc_1, plc_2, plc_3, plc_4)
- timing: descripcion corta de cuando enviar relativo a la fase (ej: "Dia 1 de captacion", "2 horas antes del evento", "Dia de apertura", "24h antes de cierre")
- sendOffsetDays: numero de dias relativo al inicio de la fase (0 = primer dia, 1 = segundo dia, -1 = dia anterior). Usado para programar envios automaticos.

Tono directo, en primera persona. Adapta el espanol al pais/region indicado (voseo rioplatense para AR/UY, tuteo para ES, ustedeo para CO/MX, etc). Si no se indica pais, usa espanol neutro latinoamericano.
Devuelve SOLO JSON valido sin markdown.`;

export function emailsPrompt(opts: {
  launchName: string;
  type: string;
  promise: string;
  ctaUrl: string;
  primaryCountry?: string | null;
  milestones?: Array<{ phase: string; label: string; startsAt: string; endsAt: string }>;
}) {
  const milestonesBlock = opts.milestones?.length
    ? `\nCalendario del lanzamiento:\n${opts.milestones.map((m) => `- ${m.label} (${m.phase}): ${m.startsAt} al ${m.endsAt}`).join("\n")}\n\nAlinea los emails con estas fechas. Cada email debe corresponder a una fase real del calendario.`
    : "";

  const countryLine = opts.primaryCountry ? `\nPais principal del publico: ${opts.primaryCountry}` : "";

  return `Lanzamiento: ${opts.launchName}
Tipo: ${opts.type}
Promesa: ${opts.promise}
CTA URL: ${opts.ctaUrl}${countryLine}
${milestonesBlock}
Devuelve JSON: { "emails": [{ "subject": "...", "preheader": "...", "body": "<p>...</p>", "ctaText": "...", "ctaUrl": "...", "phase": "...", "timing": "...", "sendOffsetDays": 0 }] }`;
}
