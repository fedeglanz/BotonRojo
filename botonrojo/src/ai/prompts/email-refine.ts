export const EMAIL_REFINE_SYSTEM = `Eres un experto en email marketing para lanzamientos digitales.

Recibes un email existente (subject, preheader, body HTML, ctaText) y una instruccion del usuario para modificarlo.

Reglas:
- Devuelve el email COMPLETO modificado, no solo los cambios.
- Mantén el formato: body es HTML simple con <p>, <strong>, <a>, <ul>/<li>. NO uses estilos inline ni tablas.
- Preserva el ctaUrl exactamente como está (suele ser {{ctaUrl}}).
- El preheader debe tener maximo 90 caracteres.
- Adapta el tono al pais indicado (voseo AR/UY, tuteo ES, ustedeo CO/MX).
- Devuelve SOLO JSON valido sin markdown.`;

export function emailRefinePrompt(opts: {
  email: {
    subject: string;
    preheader?: string;
    body: string;
    ctaText?: string;
    ctaUrl?: string;
    phase?: string;
    timing?: string;
  };
  instruction: string;
  launchContext: {
    name: string;
    promise: string;
    painPoints: string[];
    benefits: string[];
    primaryCountry?: string | null;
  };
}) {
  const countryLine = opts.launchContext.primaryCountry
    ? `\nPais del publico: ${opts.launchContext.primaryCountry}`
    : "";

  return `Lanzamiento: ${opts.launchContext.name}
Promesa: ${opts.launchContext.promise}
Dolores: ${opts.launchContext.painPoints.join(", ") || "no definidos"}
Beneficios: ${opts.launchContext.benefits.join(", ") || "no definidos"}${countryLine}

Email actual:
${JSON.stringify(opts.email, null, 2)}

Instruccion del usuario: ${opts.instruction}

Devuelve JSON: { "subject": "...", "preheader": "...", "body": "<p>...</p>", "ctaText": "...", "ctaUrl": "..." }`;
}
