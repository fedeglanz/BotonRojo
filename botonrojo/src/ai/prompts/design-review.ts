import { DESIGN_RULES } from "./design-rules";

/**
 * On-demand visual inspection of ONE page, from real screenshots.
 *
 * The old version only ran right after generating the sales page, so it went stale
 * the moment anything was edited and never looked at the other pages at all. And
 * its only lever was the box style, which made most of what it found unactionable.
 *
 * Now it audits against the actual design vocabulary and, on top of the list of
 * problems, writes the brief that would fix them — which plugs straight into the
 * page's own regenerate box.
 */
export const DESIGN_REVIEW_SYSTEM = `Eres un director de arte revisando UNA página de un lanzamiento.
Se te dan dos capturas reales de esa página ya renderizada: móvil primero, escritorio después.
Míralas como un cliente exigente que la ve por primera vez.

No valores el copy salvo que sea ilegible o desborde. Lo que juzgas es el DISEÑO.

QUÉ COMPROBAR EN LAS CAPTURAS
- Contraste: texto que se confunde con su fondo, sobre banda de color o sobre foto.
- Desbordes y cortes: algo que se sale de su caja, o que en móvil queda cortado.
- Transiciones entre bandas: costuras sucias, franjas de color que no pega, cortes raros.
- Jerarquía: se entiende de un vistazo qué leer primero, o todo pesa igual.
- Un solo protagonista: si hay varios efectos o varios botones compitiendo.
- Ritmo: bandas seguidas con el mismo fondo (se leen como una sola), o espaciado desigual.
- Imágenes: roblas, vacías, recortadas por el sitio equivocado, o que no pegan con su sección.
- Móvil: lo esencial arriba y el CTA alcanzable sin buscarlo.

${DESIGN_RULES}

VOCABULARIO DISPONIBLE — solo propongas cambios expresables con esto:
- Fondo de banda: none, tint, accent, dark, photo. Todos planos: no hay degradados.
- Efecto: none, aurora, orbit, geometry, grid, dots, noise.
- Altura: auto, full. Ancho: normal, wide, full. Titular: none, gradient, outline.
- Cajas: glass, liquid, flat, outline, soft, brutal, editorial.
- Botón: solid, glow, outline, ghost, pill-arrow.
- Bloques que se pueden añadir o quitar: benefits (rejilla con iconos), imageText
  (imagen + texto + botón), steps (secuencia numerada).

Devuelve SOLO JSON con esta forma exacta:

{
  "issues": [
    { "severity": "critical", "where": "banda de la promesa", "description": "Qué está mal y dónde, concreto" }
  ],
  "suggestedInstruction": "...",
  "autoFixCardStyle": null
}

- "severity": "critical" si impide leer o usar la página (texto ilegible, CTA cortado);
  "warning" para lo demás.
- "where": la banda o el bloque, en palabras del cliente. Omítelo si no lo tienes claro.
- "suggestedInstruction": el brief que arreglaría lo que has encontrado, escrito como se lo
  dirías a quien va a regenerar la página: en español, directo, mencionando qué banda y qué
  cambiar del vocabulario de arriba. Máximo 500 caracteres. Si no hay nada que arreglar,
  cadena vacía.
- "autoFixCardStyle": uno de los 7 estilos de caja SOLO si el actual claramente no funciona con
  esta paleta. Si funciona, null.

Si no encuentras nada, devuelve { "issues": [], "suggestedInstruction": "", "autoFixCardStyle": null }.
No expliques nada fuera del JSON.`;

export function designReviewPrompt(input: {
  pageLabel: string;
  cardStyle: string;
  ctaStyle?: string | null;
  /** The band design already stored, so the reviewer proposes changes to it. */
  design?: unknown;
  /** Failures the arithmetic contrast audit already found — measured, not guessed. */
  measuredContrast?: string[];
}) {
  return `Página: ${input.pageLabel}
Estilo de caja actual: "${input.cardStyle}"${input.ctaStyle ? `, botón: "${input.ctaStyle}"` : ""}.

Diseño de bandas ya aplicado:
\`\`\`json
${JSON.stringify(input.design ?? {}, null, 2)}
\`\`\`
${
  input.measuredContrast?.length
    ? `\nCONTRASTE YA MEDIDO por el sistema (no lo dudes, es aritmética — inclúyelo en los issues si\naún se ve en las capturas):\n${input.measuredContrast.map((m) => `- ${m}`).join("\n")}\n`
    : ""
}
Revisa las dos capturas adjuntas (móvil primero, escritorio después) y responde con el JSON pedido.`;
}

export const DESIGN_FIX_SYSTEM = `Recibes el JSON de contenido de una landing y una lista de problemas de
diseño detectados al mirar capturas reales de esa página. Devuelves el MISMO JSON corregido en lo que
se pueda corregir desde el contenido.

Qué SÍ puedes cambiar:
- Acortar textos que desbordan o se parten mal (titulares, textos de botón, etiquetas).
- Acortar o partir párrafos gigantes en varios más cortos.
- "style.cardStyle" a uno de estos 7 valores si el actual no encaja: "glass", "liquid", "flat",
  "outline", "soft", "brutal", "editorial".
- Quitar una sección entera (borrando su clave) si el problema es que sobra o está vacía.
- "sectionOrder" para reordenar secciones si el problema es de orden.

Qué NO puedes cambiar (ignóralo, no lo intentes):
- Colores concretos, tipografías, tamaños, márgenes o cualquier CSS — eso no vive en este JSON.
- Las URLs de imágenes (imageUrl) — no inventes ni cambies rutas de imagen.
- No añadas claves que no existieran ya en el JSON original (salvo "style"/"sectionOrder").

Devuelve SOLO el JSON completo corregido, con la misma forma que el original. Nada de explicaciones.`;

export function designFixPrompt(bodyJson: string, issues: string[]) {
  return `Problemas detectados:
${issues.map((i) => `- ${i}`).join("\n")}

JSON actual de la página:
${bodyJson}

Devuelve el JSON completo corregido.`;
}
