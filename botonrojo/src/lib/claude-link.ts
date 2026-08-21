/**
 * Lo que se le manda a Claude para trabajar en un lanzamiento: a dónde va cada
 * botón y qué instrucción lleva.
 *
 * Los dos destinos no son intercambiables. Diseñar una página es trabajo de Claude
 * Design, que es donde se ve lo que sale mientras se hace; crear una página nueva
 * empieza por una conversación —para qué es, de qué tipo— y eso va en un chat.
 *
 * Y llevan la instrucción de forma distinta porque no queda otra. El chat lee el
 * mensaje de `?q=` y aparece escrito. Design no: su compositor es un contenteditable
 * de ProseMirror que no mira la URL, y escribir en la página de otro dominio no lo
 * puede hacer nadie desde aquí. Así que los botones de Design abren la página limpia
 * y copian la instrucción al portapapeles en el mismo clic (ver ClaudeGoButton):
 * pegarla es un paso real, y es mejor documentarlo que prometer un autorrelleno que
 * no va a pasar.
 *
 * Las instrucciones nombran las herramientas del conector, porque Claude tiene
 * muchas y necesita saber cuáles son las de esto; y nombran el lanzamiento y la
 * página por su clave, no por su título, porque son los identificadores que aceptan.
 */

export const CLAUDE_DESIGN_URL = "https://claude.ai/design";
const CLAUDE_CHAT = "https://claude.ai/new";

/** El chat sí lee `?q=`, así que ahí el mensaje va en el enlace. */
function claudeChatUrl(prompt: string): string {
  return `${CLAUDE_CHAT}?q=${encodeURIComponent(prompt)}`;
}


/**
 * El recordatorio de nivel, en los mensajes que abren Claude.
 *
 * El contrato ya lleva la dirección de arte entera, pero se lee después de abrir el
 * chat y no todo el mundo llega hasta ahí. Las primeras páginas de prueba salieron
 * correctas y planas, así que el nivel se pide desde la primera frase.
 */
const NIVEL_DE_DISENO = `NIVEL: no quiero una plantilla. Un gesto visual protagonista por página, animación SVG de verdad (trazos que se dibujan con stroke-dashoffset, formas que se transforman, degradados en movimiento, grano con feTurbulence), aparición al hacer scroll con el estado final visible, profundidad por capas y micro-interacciones en botones y tarjetas. Respeta prefers-reduced-motion y anima solo transform y opacity. La dirección de arte completa está en contrato_pagina — léela.`;

/** Rediseñar una página que ya se diseñó en Claude. */
export function claudeEditPagePrompt(input: {
  launchSlug: string;
  launchName: string;
  pageKey: string;
  pageLabel: string;
  publicUrl: string;
}): string {
  return `Con el conector de Botón Rojo, cambia la página "${input.pageLabel}" del lanzamiento ${input.launchSlug}.

1. ver_pagina con lanzamiento="${input.launchSlug}" y pagina="${input.pageKey}" para tener el HTML que está publicado ahora.
2. contrato_pagina, para no perder los atributos data-br ni los {{tokens}} al retocarlo.
3. Si es un retoque —un titular, un precio, un párrafo—, aplícalo con parchear_pagina: le pasas solo los trozos que cambian y tarda segundos. publicar_pagina obliga a reescribir el documento entero y son varios minutos.

Está en vivo en ${input.publicUrl}. Antes de tocar nada, dime qué ves y qué propones cambiar.

${NIVEL_DE_DISENO}

En cada publicar_pagina / publicar_email / guardar_identidad, manda también url_claude con el enlace de este proyecto de Claude Design —el de la barra del navegador, https://claude.ai/design/p/…—. Es lo que permite volver aquí desde el panel de Botón Rojo para cambiar algo, en vez de empezar un chat nuevo.`;
}

/** Diseñar desde cero una página del lanzamiento. */
export function claudeDesignPagePrompt(input: {
  launchSlug: string;
  launchName: string;
  pageKey: string;
  pageLabel: string;
  pageKind: string;
  publicUrl: string;
}): string {
  return `Con el conector de Botón Rojo, diseña la página "${input.pageLabel}" del lanzamiento ${input.launchSlug} y publícala.

1. contexto_lanzamiento con lanzamiento="${input.launchSlug}": marca, promesa, avatar, precios y fechas.
2. contrato_pagina: los atributos data-br y los {{tokens}} que tiene que llevar el HTML.
3. Diseña el documento completo en Claude Design, con la identidad visual del lanzamiento.
4. publicar_pagina con pagina="${input.pageKey}".

Es una página de tipo "${input.pageKind}" y quedará en ${input.publicUrl}. Las imágenes mándalas por url en "archivos", nunca en base64.

Empieza leyendo el contexto y proponme la idea antes de escribir el HTML.

${NIVEL_DE_DISENO}

En cada publicar_pagina / publicar_email / guardar_identidad, manda también url_claude con el enlace de este proyecto de Claude Design —el de la barra del navegador, https://claude.ai/design/p/…—. Es lo que permite volver aquí desde el panel de Botón Rojo para cambiar algo, en vez de empezar un chat nuevo.`;
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

Empieza enseñándome la lista de tareas y tu propuesta de identidad visual.

${NIVEL_DE_DISENO}

En cada publicar_pagina / publicar_email / guardar_identidad, manda también url_claude con el enlace de este proyecto de Claude Design —el de la barra del navegador, https://claude.ai/design/p/…—. Es lo que permite volver aquí desde el panel de Botón Rojo para cambiar algo, en vez de empezar un chat nuevo.`;
}

/**
 * Diseñar campañas de email del lanzamiento, tantas como haga falta.
 *
 * Dice explícitamente que empiece preguntando cuántas y de qué: pedirle "diseña las
 * campañas" a secas acabaría en una secuencia inventada, y las campañas son lo más
 * caro de rehacer porque cada una lleva su copy.
 */
export function claudeCampaignsPrompt(input: {
  launchSlug: string;
  launchName: string;
}): string {
  return `Con el conector de Botón Rojo, diseña campañas de email para el lanzamiento ${input.launchSlug}.

1. contexto_lanzamiento con lanzamiento="${input.launchSlug}": la identidad visual (paleta, tipografías, logo), la promesa, el avatar y las fechas. Los correos tienen que parecer de la misma casa que las páginas.
2. contrato_email: un email no es una página pequeña —CSS en línea, tablas, 600px, sin JavaScript— y ahí está todo lo que hay que cumplir.
3. listar_emails, para ver las que ya existen y no repetir nombre sin querer.
4. Cada campaña: la diseñas, me la enseñas, y la publicas con publicar_email dándole un nombre ("Bienvenida 1", "Carta del martes 3"), su asunto y su preencabezado.

Pregúntame primero cuántas quiero y de qué va cada una. No te inventes una secuencia entera sin preguntar.

En cada publicar_pagina / publicar_email / guardar_identidad, manda también url_claude con el enlace de este proyecto de Claude Design —el de la barra del navegador, https://claude.ai/design/p/…—. Es lo que permite volver aquí desde el panel de Botón Rojo para cambiar algo, en vez de empezar un chat nuevo.`;
}

/**
 * Diseñar los anuncios estáticos en Claude, en vez de componerlos con las
 * plantillas de la plataforma.
 *
 * El generador de Botón Rojo pone el copy sobre una foto con una de sus cuatro
 * plantillas: rápido y suficiente para tirar quince formatos de una tacada. Esto es
 * lo otro, un diseño hecho a mano para una campaña concreta. Los dos acaban en la
 * misma galería, que es de donde se descargan para subirlos a Meta o a Google.
 */
export function claudeAdsPrompt(input: {
  launchSlug: string;
  launchName: string;
}): string {
  return `Con el conector de Botón Rojo, diseña anuncios estáticos para el lanzamiento ${input.launchSlug}.

1. contexto_lanzamiento con lanzamiento="${input.launchSlug}": la identidad visual, la promesa y el avatar. Los anuncios tienen que parecer de la misma casa que las páginas.
2. contrato_anuncio: los formatos con sus medidas exactas y las reglas del HTML. Un anuncio es una foto fija del tamaño justo — lo que se sale, no aparece.
3. Cada anuncio: lo diseñas al tamaño exacto del formato, me lo enseñas, y lo publicas con publicar_anuncio dándole un nombre ("Testimonio Marta", "Oferta cierre") y su formato.

Pregúntame primero para qué canal son y cuántos quiero. Si quieres el mismo anuncio en varios tamaños, publícalo una vez por formato: cada medida necesita su composición, no vale escalar.

En cada publicar_pagina / publicar_email / guardar_identidad, manda también url_claude con el enlace de este proyecto de Claude Design —el de la barra del navegador, https://claude.ai/design/p/…—. Es lo que permite volver aquí desde el panel de Botón Rojo para cambiar algo, en vez de empezar un chat nuevo.`;
}

/** Crear una página que el lanzamiento todavía no tiene. */
export function claudeNewPageUrl(input: {
  launchSlug: string;
  launchName: string;
}): string {
  return claudeChatUrl(
    `Con el conector de Botón Rojo, quiero una página nueva en el lanzamiento ${input.launchSlug}.

1. contexto_lanzamiento con lanzamiento="${input.launchSlug}", para ver qué páginas tiene ya.
2. contrato_pagina.
3. crear_pagina con el nombre y el tipo que acordemos (registro, venta, contenido o afiliados).
4. Diséñala y publícala con publicar_pagina.

Pregúntame primero para qué es la página antes de crear nada.

${NIVEL_DE_DISENO}

En cada publicar_pagina / publicar_email / guardar_identidad, manda también url_claude con el enlace de este proyecto de Claude Design —el de la barra del navegador, https://claude.ai/design/p/…—. Es lo que permite volver aquí desde el panel de Botón Rojo para cambiar algo, en vez de empezar un chat nuevo.`,
  );
}
