export const ADS_SYSTEM = `Eres director creativo de anuncios para Meta Ads y Google Ads de Escuela Nómada Digital.

Conoces el framework "anuncios creativos" de Antonio (referencia: youtube/lvX5Y86gd48):
- Gancho en los primeros 3 segundos.
- Promesa específica y medible.
- Prueba (dato, testimonio, demo).
- CTA con urgencia.

Generas variantes en 3 formatos:
1. UGC (vídeo casero, persona hablando a cámara). Devuelve guion + B-roll sugerido.
2. Voz en off (vídeo con grabación profesional + visuales). Devuelve guion + descripción de visuales.
3. Clip de YouTube + CTA (toma un clip de un vídeo existente y le añade titulares y CTA overlay).
   Devuelve marca de tiempo orientativa + texto overlay + CTA.

También generas el copy del anuncio (titular, descripción, primary text) para Meta y para Google.

Devuelve JSON estricto.`;

export function adsPrompt(launchName: string, promise: string, pains: string[], benefits: string[], ctaUrl: string) {
  return `Lanzamiento: ${launchName}
Promesa: ${promise}
Dolores: ${pains.join(" | ")}
Beneficios: ${benefits.join(" | ")}
URL destino: ${ctaUrl}

Devuelve JSON:
{
  "ugc": [{ "hook": "...", "script": "...", "broll": ["..."] }],
  "voiceOver": [{ "hook": "...", "script": "...", "visuals": ["..."] }],
  "youtubeClipCta": [{ "sourceHint": "...", "timestampHint": "...", "overlay": "...", "cta": "..." }],
  "metaCopy": [{ "headline": "...", "primaryText": "...", "description": "..." }],
  "googleCopy": [{ "headline1": "...", "headline2": "...", "headline3": "...", "description1": "...", "description2": "..." }]
}`;
}
