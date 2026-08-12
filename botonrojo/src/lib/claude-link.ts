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

/**
 * Dos destinos, porque son dos trabajos distintos.
 *
 * Diseñar una página es trabajo de Claude Design: ahí es donde se ve lo que sale
 * mientras se hace. Crear una página nueva empieza por una conversación —para qué
 * es, de qué tipo— y eso va en un chat normal.
 */
const CLAUDE_DESIGN = "https://claude.ai/design";
const CLAUDE_CHAT = "https://claude.ai/new";

/**
 * El mensaje va en `q` y en `prompt`.
 *
 * El chat de claude.ai lee `q`; de Design no tenemos forma de comprobarlo desde
 * aquí, y un parámetro que no se reconoce se ignora sin más. Mandar los dos cuesta
 * unos bytes de URL y evita que el cuadro salga vacío por el nombre de una clave.
 */
function claudeUrl(base: string, prompt: string): string {
  const encoded = encodeURIComponent(prompt);
  return `${base}?q=${encoded}&prompt=${encoded}`;
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
    CLAUDE_DESIGN,
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
    CLAUDE_DESIGN,
    `Con el conector de Botón Rojo, diseña la página "${input.pageLabel}" del lanzamiento ${input.launchSlug} y publícala.

1. contexto_lanzamiento con lanzamiento="${input.launchSlug}": marca, promesa, avatar, precios y fechas.
2. contrato_pagina: los atributos data-br y los {{tokens}} que tiene que llevar el HTML.
3. Diseña el documento completo en Claude Design, con la identidad visual del lanzamiento.
4. publicar_pagina con pagina="${input.pageKey}".

Es una página de tipo "${input.pageKind}" y quedará en ${input.publicUrl}. Las imágenes mándalas por url en "archivos", nunca en base64.

Empieza leyendo el contexto y proponme la idea antes de escribir el HTML.`,
  );
}

/**
 * El mensaje que hace el trabajo entero: identidad visual y todas las páginas.
 *
 * Se expone como texto además de como enlace porque el botón depende de que Claude
 * abra con el mensaje ya puesto, y eso no está en nuestra mano. Poder copiarlo y
 * pegarlo es el camino que siempre funciona.
 *
 * La lista de tareas no se enumera aquí a propósito: la pide Claude con
 * `trabajo_pendiente`, que es la única versión al día. Repetirla sería una copia que
 * envejece en cuanto se cierra la primera tarea.
 */
export function claudeQueuePrompt(input: {
  launchSlug: string;
  launchName: string;
}): string {
  return `Trabaja con el conector de Botón Rojo en el lanzamiento "${input.launchSlug}".

Para empezar: llama a trabajo_pendiente con lanzamiento="${input.launchSlug}" para ver la lista de tareas, y a contexto_lanzamiento para saber de qué va (brief, promesa, avatar, precios y fechas).

TAREA 1 — Identidad visual. Propónme:
· 4 colores en hexadecimal: principal (el de los botones), acento, fondo y texto.
· 2 tipografías de Google Fonts: una para titulares y otra para texto.
· el estilo: cómo son las cajas, el botón principal, la densidad y cuánta decoración.
Enséñamelo con una muestra visual antes de guardar nada. Cuando te diga que sí, guárdala con guardar_identidad.

TAREAS SIGUIENTES — una por página. Lee contrato_pagina, diseña el documento HTML completo con esa identidad, enséñamelo, y cuando lo apruebe publícalo con publicar_pagina. Las imágenes van por url en "archivos", nunca en base64.

No hace falta avisar de nada al terminar: cada tarea se cierra sola al guardar la identidad o al publicar la página.

Empieza enseñándome la lista de tareas y tu propuesta de identidad visual.`;
}

/**
 * Hacer la cola de trabajo entera: identidad visual y todas las páginas.
 *
 * A Claude Design, y con la lista sin enumerar aquí a propósito: la pide él con
 * `trabajo_pendiente`, que es la única versión que está al día. Repetirla en la URL
 * sería una copia que envejece en cuanto se cierra la primera tarea.
 */
export function claudeQueueUrl(input: {
  launchSlug: string;
  launchName: string;
}): string {
  return claudeUrl(CLAUDE_DESIGN, claudeQueuePrompt(input));
}

/** Crear una página que el lanzamiento todavía no tiene. */
export function claudeNewPageUrl(input: {
  launchSlug: string;
  launchName: string;
}): string {
  return claudeUrl(
    CLAUDE_CHAT,
    `Con el conector de Botón Rojo, quiero una página nueva en el lanzamiento ${input.launchSlug}.

1. contexto_lanzamiento con lanzamiento="${input.launchSlug}", para ver qué páginas tiene ya.
2. contrato_pagina.
3. crear_pagina con el nombre y el tipo que acordemos (registro, venta, contenido o afiliados).
4. Diséñala y publícala con publicar_pagina.

Pregúntame primero para qué es la página antes de crear nada.`,
  );
}
