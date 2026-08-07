/**
 * Enlaces que abren un chat de Claude con la instrucción ya escrita.
 *
 * `claude.ai/new?q=…` deja el mensaje puesto en el cuadro de texto, sin enviarlo:
 * da tiempo a añadir "y cámbiale el titular" antes de darle. Eso es justo lo que
 * queremos aquí — el botón no hace el trabajo, lo empieza.
 *
 * Los prompts nombran las herramientas del conector porque Claude tiene muchas y
 * necesita saber cuáles son las de esto; y nombran el lanzamiento y la página por
 * su clave, no por su título, porque son los identificadores que aceptan.
 *
 * Van cortos a propósito: el mensaje viaja en la URL y un navegador empieza a
 * cortar por encima de unos pocos miles de caracteres. Lo que Claude necesita
 * saber de verdad lo pide él con `contrato_pagina` y `contexto_lanzamiento`.
 */

const CLAUDE_NEW_CHAT = "https://claude.ai/new";

function claudeUrl(prompt: string): string {
  return `${CLAUDE_NEW_CHAT}?q=${encodeURIComponent(prompt)}`;
}

/** Rediseñar una página que ya se diseñó en Claude. */
export function claudeEditPageUrl(input: {
  launchSlug: string;
  launchName: string;
  pageKey: string;
  pageLabel: string;
  publicUrl: string;
}): string {
  return claudeUrl(
    `Con el conector de Botón Rojo, cambia la página "${input.pageLabel}" del lanzamiento ${input.launchSlug}.

1. ver_pagina con lanzamiento="${input.launchSlug}" y pagina="${input.pageKey}" para tener el HTML que está publicado ahora.
2. contrato_pagina, para no perder los atributos data-br ni los {{tokens}} al retocarlo.
3. Cámbialo y publícalo con publicar_pagina en la misma página.

Está en vivo en ${input.publicUrl}. Antes de tocar nada, dime qué ves y qué propones cambiar.`,
  );
}

/** Diseñar desde cero una página del lanzamiento. */
export function claudeDesignPageUrl(input: {
  launchSlug: string;
  launchName: string;
  pageKey: string;
  pageLabel: string;
  pageKind: string;
  publicUrl: string;
}): string {
  return claudeUrl(
    `Con el conector de Botón Rojo, diseña la página "${input.pageLabel}" del lanzamiento ${input.launchSlug} y publícala.

1. contexto_lanzamiento con lanzamiento="${input.launchSlug}": marca, promesa, avatar, precios y fechas.
2. contrato_pagina: los atributos data-br y los {{tokens}} que tiene que llevar el HTML.
3. Diseña el documento completo en Claude Design, con la identidad visual del lanzamiento.
4. publicar_pagina con pagina="${input.pageKey}".

Es una página de tipo "${input.pageKind}" y quedará en ${input.publicUrl}. Las imágenes mándalas por url en "archivos", nunca en base64.

Empieza leyendo el contexto y proponme la idea antes de escribir el HTML.`,
  );
}

/** Crear una página que el lanzamiento todavía no tiene. */
export function claudeNewPageUrl(input: {
  launchSlug: string;
  launchName: string;
}): string {
  return claudeUrl(
    `Con el conector de Botón Rojo, quiero una página nueva en el lanzamiento ${input.launchSlug}.

1. contexto_lanzamiento con lanzamiento="${input.launchSlug}", para ver qué páginas tiene ya.
2. contrato_pagina.
3. crear_pagina con el nombre y el tipo que acordemos (registro, venta, contenido o afiliados).
4. Diséñala y publícala con publicar_pagina.

Pregúntame primero para qué es la página antes de crear nada.`,
  );
}
